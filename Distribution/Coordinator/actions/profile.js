// Distribution/Coordinator/actions/profile.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? '—'); }
function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '') + v.toLocaleString('en-US');
}

/**
 * PROFILE DASHBOARD — visually distinct from fan_gain.
 *
 * fan_gain has 6 inline fields. Profile puts ALL fan stats in ONE compact
 * "Fan Performance" field and adds 5+ profile-exclusive sections:
 *   Identity → Fan Performance → Team Stadium → Inheritance → Monthly History → Characters → Achievements
 */
function buildProfileEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta = fabricatorInput.meta ?? {};
  const fans = fabricatorInput.fans ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';
  const rankStr = fabricatorInput.rank != null ? `#${fabricatorInput.rank}` : '';

  // Icon — Gametora when available, Discord avatar as backup
  const thumbnailUrl = fabricatorInput.gametoraIconUrl
    ?? interaction.user?.displayAvatarURL({ dynamic: true, size: 256 })
    ?? null;

  // ── Description: Identity block ───────────────────────────────────────────
  let desc = '';
  if (meta.trainerId) desc += `**ID:** \`${meta.trainerId}\``;
  if (meta.circle)    desc += `\u00a0\u00a0\u00a0**Circle:** ${meta.circle}`;
  desc += `\n**Discord:** <@${interaction.user.id}>`;

  const fields = [];

  // ── 1. Fan Performance (ONE compact field — NOT 6 inline like fan_gain) ─
  const fpLines = [];
  fpLines.push(` Daily \`${fmtGain(fans.daily)}\``);
  fpLines.push(` Weekly \`${fmtGain(fans.weekly)}\``);
  fpLines.push(` Monthly \`${fmtGain(fans.monthly)}\``);
  fpLines.push(` Lifetime \`${fmtNum(fans.lifetime)}\``);
  
  const extraLines = [];
  if (fabricatorInput.rank != null)  extraLines.push(`\u2022 Rank #${fabricatorInput.rank}`);
  if (fabricatorInput.trend)         extraLines.push(`\u2022 Trend ${fabricatorInput.trend}`);
  const extra = extraLines.length > 0 ? `\n\n${extraLines.join('\u00a0\u00a0\u00a0')}` : '';

  fields.push({
    name: '\uD83D\uDCCA Fan Performance',
    value: fpLines.join(' │ ') + extra,
    inline: false,
  });

  // ── 2. Team Stadium ─────────────────────────────────────────────────────
  const tsClass  = fabricatorInput.teamClass;
  const tsBest   = fabricatorInput.bestTeamClass;
  const tsEval   = fabricatorInput.teamEvaluationPoint;
  const tsScore  = fabricatorInput.rankScore;
  const tsHorses = fabricatorInput.teamStadium;
  
  if (tsClass != null || tsEval != null || tsScore != null || (Array.isArray(tsHorses) && tsHorses.length > 0)) {
    let tsText = '';
    if (tsClass != null) {
      tsText += `**Class Lv.${tsClass}**`;
      if (tsBest != null) tsText += ` \u00a0 Best Lv.${tsBest}`;
      if (tsEval != null) tsText += ` \u00a0 Eval ${fmtNum(tsEval)}`;
      if (tsScore != null) tsText += ` \u00a0 Score ${fmtNum(tsScore)}`;
    }
    
    if (Array.isArray(tsHorses) && tsHorses.length > 0) {
      tsText += '\n';
      tsHorses.slice(0, 5).forEach((h, i) => {
        const s  = h.speed   ?? h.s  ?? '—';
        const p  = h.power   ?? h.p  ?? '—';
        const st = h.stamina ?? h.st ?? '—';
        const w  = h.wiz     ?? h.w  ?? '—';
        const g  = h.guts    ?? h.g  ?? '—';
        tsText += `\nH${i + 1} \`Sp${s}\` \`Pw${p}\` \`St${st}\` \`Wi${w}\` \`Gu${g}\``;
      });
    }
    
    fields.push({ name: '\uD83C\uDFDF\uFE0F Team Stadium', value: tsText, inline: false });
  }

  // ── 3. Inheritance ──────────────────────────────────────────────────────
  const inh = fabricatorInput.inheritance;
  if (inh && typeof inh === 'object') {
    const mainId  = inh.main_parent_id  ?? inh.mainParentId  ?? null;
    const leftId  = inh.parent_left_id  ?? inh.parentLeftId  ?? null;
    const rightId = inh.parent_right_id ?? inh.parentRightId ?? null;
    const inhRank = inh.parent_rank     ?? inh.parentRank    ?? null;
    const inhRare = inh.parent_rarity   ?? inh.parentRarity  ?? null;
    if (mainId || leftId || rightId) {
      const parts = [];
      if (mainId)  parts.push(`Main \`${mainId}\``);
      if (leftId)  parts.push(`Left \`${leftId}\``);
      if (rightId) parts.push(`Right \`${rightId}\``);
      const subParts = [];
      if (inhRank != null) subParts.push(`Rank ${inhRank}`);
      if (inhRare != null) subParts.push(`Rarity ${inhRare}`);
      const value = parts.join(' \u00a0 ') + (subParts.length > 0 ? `\n${subParts.join(' · ')}` : '');
      fields.push({ name: '\uD83E\uDDEC Inheritance', value: value, inline: false });
    }
  }

  // ── 4. Personal Records ─────────────────────────────────────────────────
  const pr = fabricatorInput.personalRecords;
  if (pr && typeof pr === 'object' && Object.keys(pr).length > 0) {
    const prLines = Object.entries(pr).map(([k, v]) =>
      `\u2022 **${k}:** ${typeof v === 'number' ? v.toLocaleString('en-US') : v}`
    );
    fields.push({ name: '\uD83C\uDFC5 Records', value: prLines.join('\n'), inline: false });
  }

  // ── 5. Milestones ───────────────────────────────────────────────────────
  const milestones = fabricatorInput.milestones;
  if (Array.isArray(milestones) && milestones.length > 0) {
    const mLines = milestones.slice(0, 5).map(m =>
      `\u2022 ${m.title ?? m.type ?? m.name ?? 'Milestone'} — ${m.crossedAt ?? m.date ?? ''}`
    );
    fields.push({ name: '\uD83C\uDFC6 Milestones', value: mLines.join('\n') || '—', inline: false });
  }

  // ── 6. Monthly History ──────────────────────────────────────────────────
  const history = fabricatorInput.monthlyHistory;
  if (Array.isArray(history) && history.length > 0) {
    const hLines = history.slice(0, 6).map(h => {
      const label = h.month ?? h.period ?? h.label ?? '';
      const gain  = h.gain ?? h.totalGain ?? h.monthlyFanGain ?? 0;
      return `\u2022 ${label}: ${fmtGain(gain)}`;
    });
    fields.push({ name: '\uD83D\uDCC8 Monthly History', value: hLines.join('\n') || '—', inline: false });
  }

  // ── 7. Characters ───────────────────────────────────────────────────────
  const characters = fabricatorInput.characters;
  if (Array.isArray(characters) && characters.length > 0) {
    const charPreview = characters.slice(0, 8).map(c =>
      typeof c === 'string' ? c : (c.name ?? c.id ?? '—')
    ).join(', ');
    fields.push({ name: '\uD83D\uDC34 Characters', value: charPreview, inline: false });
  }

  // ── 8. Achievements ─────────────────────────────────────────────────────
  const achievements = fabricatorInput.achievements;
  if (Array.isArray(achievements) && achievements.length > 0) {
    const achPreview = achievements.slice(0, 5).map(a =>
      typeof a === 'string' ? a : (a.name ?? a.title ?? a.id ?? '—')
    ).join('\n\u2022 ');
    if (achPreview) fields.push({ name: '\uD83C\uDF96\uFE0F Achievements', value: `\u2022 ${achPreview}`, inline: false });
  }

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title: `\uD83C\uDFC7 ${trainerName} \u00B7 ${rankStr} — UMAKRAFT PROFILE`,
      url: meta.trainerId ? `https://uma.moe/profile/${meta.trainerId}` : undefined,
      description: desc,
      thumbnail: thumbnailUrl ? { url: thumbnailUrl } : undefined,
      fields: fields.length > 0 ? fields : [{ name: 'Status', value: 'No data available.' }],
      color: 0xE91E63,
      footer: { text: 'UmaKraft Profile · uma.moe' },
      timestamp: meta.generatedAt ?? new Date().toISOString(),
    },
    interaction,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function profile(payload) {
  return runImagePipeline({
    payload,
    blueprintKey: 'profile',
    embedBuilder: buildProfileEmbed,
    forceProfileFetch: true,
    mapToFabricator: (cp, options, extra) => ({
      blueprintKey: 'profile',
      meta: {
        trainerId:   cp.id,
        trainerName: cp.name      ?? cp.id,
        avatarUrl:   cp.avatarUrl ?? null,
        generatedAt: new Date().toISOString(),
        circle:      parseCircleId(options.circle) ?? null,
      },
      fans: {
        lifetime: cp.fans           ?? 0,
        daily:    cp.dailyFanGain   ?? 0,
        weekly:   cp.weeklyFanGain  ?? 0,
        monthly:  cp.monthlyFanGain ?? 0,
      },
      rank:              cp.rank              ?? null,
      trend:             cp.trend             ?? null,
      characters:        cp.characters        ?? [],
      achievements:      cp.achievements      ?? [],
      personalRecords:   cp.personalRecords   ?? {},
      milestones:        cp.milestones        ?? [],
      monthlyHistory:    cp.monthlyHistory    ?? [],
      presentationHints: cp.presentationHints ?? {},
      gametoraIconUrl:   (extra?.leaderCharaDressId ?? cp.leader_chara_dress_id)
        ? `https://gametora.com/images/umamusume/characters/thumb/chara_stand_${Math.floor((extra?.leaderCharaDressId ?? cp.leader_chara_dress_id) / 100)}_${extra?.leaderCharaDressId ?? cp.leader_chara_dress_id}.png`
        : null,
      teamStadium:         extra?.teamStadium         ?? cp.team_stadium          ?? null,
      teamClass:           extra?.teamClass           ?? cp.team_class            ?? null,
      teamEvaluationPoint: extra?.teamEvaluationPoint ?? cp.team_evaluation_point  ?? null,
      bestTeamClass:       extra?.bestTeamClass       ?? cp.best_team_class       ?? null,
      rankScore:           extra?.rankScore           ?? cp.rank_score            ?? null,
      inheritance:         extra?.inheritance         ?? cp.inheritance           ?? null,
    }),
  });
}

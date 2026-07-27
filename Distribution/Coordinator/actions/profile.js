// Distribution/Coordinator/actions/profile.js
import { runImagePipeline } from '../utils/pipelineImage.js';
import { parseCircleId } from '../utils/parseCircle.js';

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n) { return typeof n === 'number' ? n.toLocaleString('en-US') : String(n ?? '—'); }
function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

/**
 * Rich profile embed matching the profile blueprint:
 *   Identity (avatar, name, IDs, circle, joined) → Fan Gain → Records → Milestones → History → Characters
 */
function buildProfileEmbed(fabricatorInput, blueprintKey, interaction) {
  const meta = fabricatorInput.meta ?? {};
  const fans = fabricatorInput.fans ?? {};
  const trainerName = meta.trainerName ?? meta.trainerId ?? 'Unknown';
  const rankStr  = fabricatorInput.rank != null ? ` · #${fabricatorInput.rank}` : '';

  const discordAvatar = interaction.user?.displayAvatarURL({ dynamic: true, size: 256 }) ?? null;

  // Prefer Gametora character icon over Discord avatar for the thumbnail.
  const thumbnailUrl = fabricatorInput.gametoraIconUrl ?? discordAvatar;

  // ── Header: identity info ────────────────────────────────────────────────
  let header = '';
  if (meta.trainerId)     header += `**Trainer ID:** \`${meta.trainerId}\`\n`;
  header += `**Discord:** <@${interaction.user.id}>`;
  if (meta.circle)        header += `\n**Circle:** ${meta.circle}`;

  const fields = [];

  // ── Fan Gain Summary ──────────────────────────────────────────────────────
  fields.push({ name: '📈 Daily',    value: fmtGain(fans.daily),    inline: true });
  fields.push({ name: '📈 Weekly',   value: fmtGain(fans.weekly),   inline: true });
  fields.push({ name: '📈 Monthly',  value: fmtGain(fans.monthly),  inline: true });
  if (fans.lifetime != null) fields.push({ name: '🏆 Lifetime', value: fmtNum(fans.lifetime), inline: true });
  if (fabricatorInput.rank != null)  fields.push({ name: '📊 Rank',  value: `#${fabricatorInput.rank}`, inline: true });
  if (fabricatorInput.trend)         fields.push({ name: '📉 Trend', value: fabricatorInput.trend,     inline: true });

  // ── Personal Records ──────────────────────────────────────────────────────
  const pr = fabricatorInput.personalRecords;
  if (pr && typeof pr === 'object' && Object.keys(pr).length > 0) {
    const prLines = Object.entries(pr).map(([k, v]) =>
      `**${k}**: ${typeof v === 'number' ? v.toLocaleString('en-US') : v}`
    );
    fields.push({ name: '🏅 Personal Records', value: prLines.join('\n'), inline: false });
  }

  // ── Milestones ────────────────────────────────────────────────────────────
  const milestones = fabricatorInput.milestones;
  if (Array.isArray(milestones) && milestones.length > 0) {
    const mLines = milestones.slice(0, 5).map(m =>
      `• ${m.title ?? m.type ?? m.name ?? 'Milestone'} — ${m.crossedAt ?? m.date ?? ''}`
    );
    fields.push({ name: '🏆 Recent Milestones', value: mLines.join('\n') || '—', inline: false });
  }

  // ── Monthly History ───────────────────────────────────────────────────────
  const history = fabricatorInput.monthlyHistory;
  if (Array.isArray(history) && history.length > 0) {
    const hLines = history.slice(0, 6).map(h => {
      const label = h.month ?? h.period ?? h.label ?? '';
      const gain  = h.gain ?? h.totalGain ?? h.monthlyFanGain ?? 0;
      return `• ${label}: ${fmtGain(gain)}`;
    });
    fields.push({ name: '📊 Monthly History', value: hLines.join('\n') || '—', inline: false });
  }

  // ── Team Stadium ──────────────────────────────────────────────────────────
  const tsClass = fabricatorInput.teamClass;
  const tsBest  = fabricatorInput.bestTeamClass;
  const tsEval  = fabricatorInput.teamEvaluationPoint;
  const tsScore = fabricatorInput.rankScore;
  const tsHorses = fabricatorInput.teamStadium;
  if (tsClass != null || (Array.isArray(tsHorses) && tsHorses.length > 0)) {
    let tsLines = [];
    if (tsClass != null) {
      const parts = [`**Class:** Lv.${tsClass}`];
      if (tsBest != null)  parts.push(`Best: Lv.${tsBest}`);
      if (tsEval != null)  parts.push(`Eval: ${fmtNum(tsEval)}`);
      if (tsScore != null) parts.push(`Score: ${fmtNum(tsScore)}`);
      tsLines.push(parts.join(' · '));
    }
    if (Array.isArray(tsHorses) && tsHorses.length > 0) {
      tsLines.push(''); // spacing
      tsHorses.slice(0, 5).forEach((h, i) => {
        const s = h.speed ?? h.s ?? '—';
        const p = h.power ?? h.p ?? '—';
        const st = h.stamina ?? h.st ?? '—';
        const w = h.wiz ?? h.w ?? '—';
        const g = h.guts ?? h.g ?? '—';
        tsLines.push(`• Horse ${i + 1}: Sp${s} Pw${p} St${st} Wi${w} Gu${g}`);
      });
    }
    fields.push({ name: '🏟️ Team Stadium', value: tsLines.join('\n') || '—', inline: false });
  }

  // ── Inheritance ───────────────────────────────────────────────────────────
  const inh = fabricatorInput.inheritance;
  if (inh && typeof inh === 'object') {
    const mainId  = inh.main_parent_id  ?? inh.mainParentId  ?? null;
    const leftId  = inh.parent_left_id  ?? inh.parentLeftId  ?? null;
    const rightId = inh.parent_right_id ?? inh.parentRightId ?? null;
    const inhRank = inh.parent_rank     ?? inh.parentRank    ?? null;
    const inhRare = inh.parent_rarity   ?? inh.parentRarity  ?? null;
    if (mainId || leftId || rightId) {
      const parts = [];
      if (mainId)  parts.push(`Main: \`${mainId}\``);
      if (leftId)  parts.push(`Left: \`${leftId}\``);
      if (rightId) parts.push(`Right: \`${rightId}\``);
      const metaParts = [];
      if (inhRank != null) metaParts.push(`Rank: ${inhRank}`);
      if (inhRare != null) metaParts.push(`Rarity: ${inhRare}`);
      const value = parts.join(' · ');
      const sub   = metaParts.length > 0 ? `\n${metaParts.join(' · ')}` : '';
      fields.push({ name: '🧬 Inheritance', value: value + sub, inline: false });
    }
  }

  // ── Characters ────────────────────────────────────────────────────────────
  const characters = fabricatorInput.characters;
  if (Array.isArray(characters) && characters.length > 0) {
    const charPreview = characters.slice(0, 8).map(c =>
      typeof c === 'string' ? c : (c.name ?? c.id ?? '—')
    ).join(', ');
    fields.push({ name: '🐴 Characters', value: charPreview, inline: false });
  }

  // ── Achievements ──────────────────────────────────────────────────────────
  const achievements = fabricatorInput.achievements;
  if (Array.isArray(achievements) && achievements.length > 0) {
    const achPreview = achievements.slice(0, 5).map(a =>
      typeof a === 'string' ? a : (a.name ?? a.title ?? a.id ?? '—')
    ).join('\n• ');
    if (achPreview) fields.push({ name: '🎖️ Achievements', value: `• ${achPreview}`, inline: false });
  }

  const description = meta.trainerId ? `Trainer ID: \`${meta.trainerId}\`` : '';

  return {
    success:   true,
    type:      'embed',
    ephemeral: false,
    result: {
      title:       `🏇 ${trainerName}${rankStr}`,
      description: header,
      thumbnail:   thumbnailUrl ? { url: thumbnailUrl } : undefined,
      fields:      fields.length > 0 ? fields : [{ name: 'Status', value: 'No data available.' }],
      footer:      { text: `${blueprintKey} · UmaKraft` },
      timestamp:   meta.generatedAt ?? new Date().toISOString(),
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
    forceProfileFetch: true,  // Always fetch full profile for icon/stadium/inheritance
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
      // Icon: live fetch (extra) → cached compiledProduct → null
      gametoraIconUrl:   (extra?.leaderCharaDressId ?? cp.leader_chara_dress_id)
        ? `https://gametora.com/images/umamusume/characters/thumb/chara_stand_${Math.floor((extra?.leaderCharaDressId ?? cp.leader_chara_dress_id) / 100)}_${extra?.leaderCharaDressId ?? cp.leader_chara_dress_id}.png`
        : null,
      // Team Stadium: live fetch → cached → null
      teamStadium:         extra?.teamStadium         ?? cp.team_stadium          ?? null,
      teamClass:           extra?.teamClass           ?? cp.team_class            ?? null,
      teamEvaluationPoint: extra?.teamEvaluationPoint ?? cp.team_evaluation_point  ?? null,
      bestTeamClass:       extra?.bestTeamClass       ?? cp.best_team_class       ?? null,
      rankScore:           extra?.rankScore           ?? cp.rank_score            ?? null,
      // Inheritance: live fetch → cached → null
      inheritance:         extra?.inheritance         ?? cp.inheritance           ?? null,
    }),
  });
}

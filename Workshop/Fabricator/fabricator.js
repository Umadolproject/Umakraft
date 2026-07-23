/**
 * Fabricator
 *
 * Authority: GOVERNANCE/ARCHITECTURE_AUTHORITY.md
 * Registry:  GOVERNANCE/PIPELINE_REGISTRY.md
 * Department: Fabricator — Stage 3, Workshop
 *
 * Sole responsibility: receive a compiled product from the Depot, resolve the
 * matching blueprint from the Draftsman registry, render an HTML document that
 * matches the blueprint layout, and produce a PNG image buffer via headless
 * Chromium (Puppeteer).
 *
 * Reads blueprint descriptors from:
 *   Workshop/Draftsman/Blueprint/blueprint.js
 *
 * Never fetches business data, performs calculations, or approves its own output.
 * Every deliverable it emits goes to the Validator unchanged.
 *
 * Dependency: puppeteer — install with `npm install puppeteer`
 */

import { existsSync } from 'node:fs';
import blueprints from '../Draftsman/Blueprint/blueprint.js';

const FABRICATOR_VERSION = 'v1.0';

// ─── Canvas widths (mirrors each blueprint .md Canvas section) ────────────────

const CANVAS_WIDTHS = {
  fanGain:            1200,
  profile:            1080,
  leaderboard:        1080,
  clubGain:           1080,
  totalFan:           1200,
  totalCircleFanGain: 1080,
  searchTrainer:      1200,
  circle:             1080,
  circleMaster:       1080,
  linkList:           1080,
  memberList:         1080,
  joinDate:            900,
  setFans:             900,
  greeting:            900,
  warning:             900,
  milestone:           900,
  link:                900,
  help:               1200,
};

// ─── Logging ──────────────────────────────────────────────────────────────────

function log(level, message, context = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    component: 'fabricator',
    message,
    ...context,
  };
  if (level === 'error') console.error(JSON.stringify(entry));
  else if (level === 'warn')  console.warn(JSON.stringify(entry));
  else console.log(JSON.stringify(entry));
}

function failure(error, message, context = {}) {
  return {
    success:   false,
    error,
    message,
    timestamp: new Date().toISOString(),
    context,
  };
}

// ─── Puppeteer — lazy load so module imports cleanly without puppeteer ────────

let _puppeteer = null;

async function getPuppeteer() {
  if (_puppeteer) return _puppeteer;
  try {
    const mod = await import('puppeteer');
    _puppeteer = mod.default;
    return _puppeteer;
  } catch {
    throw new Error(
      'FABRICATOR_DEPENDENCY_MISSING: puppeteer is not installed. ' +
      'Run: npm install puppeteer'
    );
  }
}

// ─── Blueprint resolution ─────────────────────────────────────────────────────

/**
 * Resolve a blueprint descriptor from the Draftsman registry.
 *
 * @param {string} blueprintKey  — camelCase key matching blueprint.js export
 * @returns {object}             — descriptor: { name, trigger, type, layout }
 * @throws  if key is not registered
 */
function resolveBlueprint(blueprintKey) {
  const descriptor = blueprints[blueprintKey];
  if (!descriptor) {
    throw new Error(
      `FABRICATOR_UNKNOWN_BLUEPRINT: no blueprint registered for key "${blueprintKey}". ` +
      `Available keys: ${Object.keys(blueprints).join(', ')}`
    );
  }
  return descriptor;
}

/**
 * Return the canvas pixel width for a blueprint key.
 * Falls back to 1080 for unregistered keys.
 */
function resolveCanvasWidth(blueprintKey) {
  return CANVAS_WIDTHS[blueprintKey] ?? 1080;
}

// ─── Avatar fetch — Base64 embed ──────────────────────────────────────────────

/**
 * Fetch an image URL and return a Base64 data URI.
 * Returns null gracefully on any failure — card render must not depend on it.
 *
 * @param {string|null|undefined} url
 * @returns {Promise<string|null>}
 */
async function fetchAvatarAsBase64(url) {
  if (!url || typeof url !== 'string') return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) {
      log('warn', `avatar fetch returned HTTP ${res.status}`, { url });
      return null;
    }
    const buffer = await res.arrayBuffer();
    const mime   = res.headers.get('content-type') ?? 'image/png';
    return `data:${mime};base64,${Buffer.from(buffer).toString('base64')}`;
  } catch (err) {
    log('warn', `avatar fetch failed — ${err.message}`, { url });
    return null;
  }
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function fmt(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('en-US');
}

function fmtGain(n) {
  if (n == null) return '—';
  const v = Number(n);
  return (v >= 0 ? '+' : '−') + Math.abs(v).toLocaleString('en-US');
}

function fmtTs(iso) {
  if (!iso) return '—';
  return iso.replace('T', ' ').substring(0, 16);
}

// ─── Shared CSS design system ─────────────────────────────────────────────────

function baseStyles(canvasWidth) {
  return `
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: transparent; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

    #card {
      width: ${canvasWidth}px;
      background: #FFF8FB;
      border: 2px solid #E7D8F5;
      border-radius: 20px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
    }

    /* ── Section shells ── */
    .s-header {
      background: #FF5AA5;
      color: #fff;
      padding: 20px 40px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-shrink: 0;
    }
    .s-header .title  { font-size: 20px; font-weight: 700; letter-spacing: 0.5px; }
    .s-header .ts     { font-size: 13px; opacity: 0.88; white-space: nowrap; }

    .s-body {
      padding: 28px 40px;
      background: #FFFFFF;
      border-bottom: 1px solid #E7D8F5;
    }
    .s-body:last-of-type { border-bottom: none; }

    .s-footer {
      padding: 14px 40px;
      background: #FFF8FB;
      border-top: 1px solid #E7D8F5;
    }
    .s-footer .footer-text { color: #9E9E9E; font-size: 13px; }

    /* ── Section titles ── */
    .section-title {
      font-size: 12px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      color: #9E9E9E;
      margin-bottom: 16px;
    }

    /* ── Identity row (avatar left, info right) ── */
    .identity-row {
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .avatar {
      width: 80px; height: 80px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #E7D8F5;
      flex-shrink: 0;
    }
    .avatar-placeholder {
      width: 80px; height: 80px;
      border-radius: 50%;
      background: #E7D8F5;
      flex-shrink: 0;
    }
    .identity-info .name   { font-size: 20px; font-weight: 700; color: #3A3552; }
    .identity-info .sub    { font-size: 14px; color: #8A7CF7; margin-top: 4px; }

    /* ── Identity centered (greeting, milestone) ── */
    .identity-center {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      text-align: center;
    }
    .avatar-lg {
      width: 100px; height: 100px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #E7D8F5;
    }
    .avatar-lg-placeholder {
      width: 100px; height: 100px;
      border-radius: 50%;
      background: #E7D8F5;
    }
    .identity-center .name { font-size: 22px; font-weight: 700; color: #3A3552; }
    .identity-center .sub  { font-size: 14px; color: #8A7CF7; }

    /* ── Metric cards row ── */
    .metric-row { display: flex; gap: 16px; }
    .metric-card {
      flex: 1;
      background: #FFF8FB;
      border: 1px solid #E7D8F5;
      border-radius: 12px;
      padding: 16px 20px;
    }
    .metric-card .m-label { font-size: 12px; color: #9E9E9E; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    .metric-card .m-value { font-size: 26px; font-weight: 700; color: #FF5AA5; }
    .metric-card .m-value.secondary { color: #8A7CF7; }
    .metric-card .m-value.dark      { color: #3A3552; }

    /* ── Hero value (large centered number) ── */
    .hero-card {
      background: #FFF8FB;
      border: 1px solid #E7D8F5;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
    }
    .hero-card .h-label { font-size: 14px; color: #9E9E9E; margin-bottom: 8px; }
    .hero-card .h-value { font-size: 40px; font-weight: 700; color: #FF5AA5; }

    /* ── Label-value rows (set_fans, warning, joindate) ── */
    .lv-row {
      display: flex;
      gap: 8px;
      margin-bottom: 10px;
      align-items: baseline;
    }
    .lv-row:last-child { margin-bottom: 0; }
    .lv-label { font-size: 13px; color: #9E9E9E; min-width: 160px; flex-shrink: 0; }
    .lv-value { font-size: 16px; font-weight: 700; color: #3A3552; }

    /* ── Status badge ── */
    .status-row {
      text-align: center;
      padding: 16px 0;
      font-size: 17px;
      font-weight: 700;
      color: #3A3552;
    }
    .status-check { color: #55C271; margin-right: 8px; }

    /* ── Severity badge (warning) ── */
    .severity-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 14px 40px;
      background: rgba(255,90,165,0.08);
      border-bottom: 1px solid #E7D8F5;
    }
    .severity-badge { display: flex; align-items: center; gap: 8px; }
    .severity-dot   { width: 10px; height: 10px; border-radius: 50%; }
    .severity-dot.critical { background: #FF5AA5; }
    .severity-dot.warning  { background: #FFD54F; }
    .severity-dot.info     { background: #8A7CF7; }
    .severity-text  { font-size: 14px; font-weight: 700; color: #3A3552; letter-spacing: 1px; }
    .alert-title    { font-size: 15px; font-weight: 700; color: #3A3552; }
    .alert-id-label { font-size: 11px; color: #9E9E9E; text-align: right; }

    /* ── Bullet list (warning actions, greeting flags) ── */
    .bullet-list { list-style: none; display: flex; flex-direction: column; gap: 8px; }
    .bullet-list li { font-size: 15px; color: #3A3552; }
    .bullet-list li::before { content: '•'; color: #FF5AA5; margin-right: 10px; font-weight: 700; }

    /* ── Context table (warning) ── */
    .ctx-table { width: 100%; border-collapse: collapse; }
    .ctx-table td { padding: 6px 0; font-size: 14px; vertical-align: top; }
    .ctx-table .ctx-label { color: #9E9E9E; width: 44%; }
    .ctx-table .ctx-value { color: #3A3552; font-weight: 600; text-align: right; }

    /* ── Achievement block (milestone) ── */
    .achievement-block { text-align: center; padding: 12px 0; }
    .achievement-label { font-size: 12px; letter-spacing: 2px; color: #9E9E9E; text-transform: uppercase; margin-bottom: 12px; }
    .achievement-value { font-size: 32px; font-weight: 700; color: #FF5AA5; margin-bottom: 12px; }
    .achievement-meta  { font-size: 14px; color: #8A7CF7; }

    /* ── Message body ── */
    .message-body { font-size: 15px; color: #3A3552; line-height: 1.6; }

    /* ── Metadata pairs (greeting) ── */
    .meta-grid { display: flex; flex-direction: column; gap: 12px; }
    .meta-pair .meta-label { font-size: 11px; color: #9E9E9E; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 3px; }
    .meta-pair .meta-value { font-size: 15px; font-weight: 700; color: #3A3552; text-transform: capitalize; }

    /* ── Footer attribution ── */
    .attr { color: #9E9E9E; font-size: 13px; }
  `;
}

function wrapHtml(canvasWidth, body) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8" />
<style>${baseStyles(canvasWidth)}</style>
</head>
<body>
<div id="card">
${body}
</div>
</body>
</html>`;
}

// ─── Per-blueprint HTML templates ─────────────────────────────────────────────

function tmplFanGain(p, avatarDataUri, w) {
  const img = avatarDataUri
    ? `<img class="avatar" src="${avatarDataUri}" />`
    : `<div class="avatar-placeholder"></div>`;

  return wrapHtml(w, `
    <div class="s-header">
      <span class="title">🏇 Fangain Statistics</span>
    </div>
    <div class="s-body">
      <div class="identity-row">
        ${img}
        <div class="identity-info">
          <div class="name">${p.meta?.trainerName ?? '—'}${p.meta?.discriminator ? '#' + p.meta.discriminator : ''}</div>
          <div class="sub">${p.meta?.discordUsername ? '@' + p.meta.discordUsername : ''}</div>
        </div>
        <div style="flex:1"></div>
        <div class="hero-card" style="min-width:300px">
          <div class="h-label">Lifetime Fangain</div>
          <div class="h-value">${fmt(p.fans?.lifetime)}</div>
        </div>
      </div>
    </div>
    <div class="s-body">
      <div class="metric-row">
        <div class="metric-card">
          <div class="m-label">Daily Fangain</div>
          <div class="m-value">${fmtGain(p.fans?.daily)}</div>
        </div>
        <div class="metric-card">
          <div class="m-label">Weekly Fangain</div>
          <div class="m-value">${fmtGain(p.fans?.weekly)}</div>
        </div>
        <div class="metric-card">
          <div class="m-label">Monthly Fangain</div>
          <div class="m-value">${fmtGain(p.fans?.monthly)}</div>
        </div>
      </div>
    </div>
    <div class="s-footer" style="display:flex;justify-content:space-between;align-items:center">
      <span class="footer-text">Last Updated: ${fmtTs(p.meta?.generatedAt)}</span>
      ${p.meta?.rank ? `<span class="attr">Rank #${p.meta.rank}</span>` : ''}
    </div>
  `);
}

function tmplWarning(p, w) {
  const sev    = (p.meta?.severity ?? 'warning').toLowerCase();
  const dotCls = ['critical', 'warning', 'info'].includes(sev) ? sev : 'warning';

  const contextRows = (p.alert?.context ?? [])
    .map(c => `<tr><td class="ctx-label">${c.label}</td><td class="ctx-value">${c.value}</td></tr>`)
    .join('');

  const actionItems = (p.alert?.remediation ?? [])
    .map(a => `<li>${a}</li>`)
    .join('');

  const targetRows = [
    p.meta?.targetName && `<div class="lv-row"><span class="lv-label">Trainer</span><span class="lv-value">${p.meta.targetName}</span></div>`,
    p.meta?.circleName && `<div class="lv-row"><span class="lv-label">Circle</span><span class="lv-value">${p.meta.circleName}</span></div>`,
    p.meta?.targetId   && `<div class="lv-row"><span class="lv-label">Target ID</span><span class="lv-value">${p.meta.targetId}</span></div>`,
  ].filter(Boolean).join('');

  return wrapHtml(w, `
    <div class="s-header">
      <span class="title">⚠ WARNING SYSTEM</span>
      <span class="ts">${fmtTs(p.meta?.generatedAt)} UTC</span>
    </div>
    <div class="severity-row">
      <div class="severity-badge">
        <div class="severity-dot ${dotCls}"></div>
        <span class="severity-text">${sev.toUpperCase()}</span>
      </div>
      <div style="flex:1;padding:0 16px">
        <div class="alert-title">${p.alert?.title ?? ''}</div>
      </div>
      <div class="alert-id-label">ALERT ID<br/>${p.meta?.alertId ?? '—'}</div>
    </div>
    <div class="s-body">
      <div class="lv-row"><span class="lv-label" style="font-weight:700;color:#3A3552;font-size:11px;letter-spacing:1px;text-transform:uppercase">ERROR CODE</span></div>
      <div style="font-size:17px;font-weight:700;color:#FF5AA5;margin-bottom:16px">${p.meta?.errorCode ?? '—'}</div>
      <div class="lv-row"><span class="lv-label" style="font-weight:700;color:#3A3552;font-size:11px;letter-spacing:1px;text-transform:uppercase">DESCRIPTION</span></div>
      <div style="font-size:15px;color:#3A3552;line-height:1.5">${p.alert?.description ?? '—'}</div>
    </div>
    ${targetRows ? `<div class="s-body"><div class="section-title">Affected Target</div>${targetRows}</div>` : ''}
    ${contextRows ? `<div class="s-body"><div class="section-title">Context</div><table class="ctx-table">${contextRows}</table></div>` : ''}
    ${actionItems ? `<div class="s-body"><div class="section-title">Recommended Actions</div><ul class="bullet-list">${actionItems}</ul></div>` : ''}
    <div class="s-footer">
      <div class="footer-text">Source: ${p.alert?.source ?? '—'}</div>
      <div class="footer-text">Delivered via ${p.alert?.deliveredVia ?? '—'}</div>
      <div class="footer-text">Monitoring Channel: ${p.alert?.monitoringChannel ?? '—'}</div>
    </div>
  `);
}

function tmplSetFans(p, w) {
  return wrapHtml(w, `
    <div class="s-header" style="justify-content:center;flex-direction:column;align-items:flex-start">
      <span class="title">SET FANS CONFIRMATION</span>
      <span class="ts" style="margin-top:4px">${fmtTs(p.meta?.generatedAt)}</span>
    </div>
    <div class="s-body">
      <div class="status-row">
        <span class="status-check">✓</span>FAN COUNT UPDATED SUCCESSFULLY
      </div>
    </div>
    <div class="s-body">
      <div class="section-title">Target Trainer</div>
      <div class="lv-row"><span class="lv-label">Trainer Name</span><span class="lv-value">${p.meta?.trainerName ?? '—'}</span></div>
      <div class="lv-row"><span class="lv-label">Trainer ID</span><span class="lv-value">${p.meta?.trainerId ?? '—'}</span></div>
      <div class="lv-row"><span class="lv-label">Circle</span><span class="lv-value">${p.meta?.circleName ?? '—'}</span></div>
    </div>
    <div class="s-body">
      <div class="section-title">Fan Count Update</div>
      <div class="lv-row"><span class="lv-label">Previous Fans</span><span class="lv-value">${p.update?.previousFans != null ? fmt(p.update.previousFans) : '—'}</span></div>
      <div class="lv-row"><span class="lv-label">New Fans</span><span class="lv-value">${fmt(p.update?.newFans)}</span></div>
      <div class="lv-row"><span class="lv-label">Change</span><span class="lv-value" style="color:#55C271">${fmtGain(p.update?.delta)}</span></div>
    </div>
    <div class="s-body">
      <div class="section-title">Administrator</div>
      <div class="lv-row"><span class="lv-label">Updated By</span><span class="lv-value">${p.meta?.administratorName ?? '—'}</span></div>
      <div class="lv-row"><span class="lv-label">Discord ID</span><span class="lv-value">${p.meta?.administratorDiscordId ?? '—'}</span></div>
    </div>
    <div class="s-body">
      <div class="section-title">Notes</div>
      ${p.notes?.statusLine ? `<div style="font-size:14px;color:#3A3552;margin-bottom:6px"><span style="color:#55C271;margin-right:6px">✓</span>${p.notes.statusLine}</div>` : ''}
      ${p.notes?.warningLine ? `<div style="font-size:14px;color:#9E9E9E">${p.notes.warningLine}</div>` : ''}
    </div>
    <div class="s-footer">
      <div class="footer-text">Source    : ${p.notes?.source ?? '—'}</div>
      <div class="footer-text">Generated : ${fmtTs(p.meta?.generatedAt)} UTC</div>
      <div class="footer-text">Delivery  : Ephemeral Response</div>
    </div>
  `);
}

function tmplGreeting(p, avatarDataUri, w) {
  const titles = {
    welcome:     '🌸 WELCOME TO UMAKRAFT!',
    anniversary: '🎉 CIRCLE ANNIVERSARY!',
    milestone:   '🏆 MILESTONE GREETING!',
  };
  const headerTitle = titles[p.meta?.template] ?? '🌸 WELCOME TO UMAKRAFT!';
  const accentColor = p.accent?.color ?? '#FF5AA5';

  const img = avatarDataUri
    ? `<img class="avatar-lg" src="${avatarDataUri}" />`
    : `<div class="avatar-lg-placeholder"></div>`;

  const circleName = p.meta?.circleName
    ? (p.meta.circleName.endsWith('Circle') ? p.meta.circleName : p.meta.circleName + ' Circle')
    : null;

  return wrapHtml(w, `
    <style>#card .s-header { background: ${accentColor}; }</style>
    <div class="s-header">
      <span class="title">${headerTitle}</span>
      <span class="ts">${fmtTs(p.meta?.generatedAt)}</span>
    </div>
    <div class="s-body">
      <div class="identity-center">
        ${img}
        <div class="name">${p.meta?.targetName ?? '—'}</div>
        ${circleName ? `<div class="sub">${circleName}</div>` : ''}
      </div>
    </div>
    <div class="s-body">
      <div class="section-title" style="text-align:center">Personal Message</div>
      <div class="message-body">${p.message?.body ?? '—'}</div>
    </div>
    <div class="s-body">
      <div class="meta-grid">
        <div class="meta-pair">
          <div class="meta-label">Template</div>
          <div class="meta-value">${p.meta?.template ?? '—'}</div>
        </div>
        <div class="meta-pair">
          <div class="meta-label">Target Type</div>
          <div class="meta-value">${p.meta?.targetType ?? '—'}</div>
        </div>
        <div class="meta-pair">
          <div class="meta-label">Generated</div>
          <div class="meta-value" style="font-size:13px;text-transform:none">${fmtTs(p.meta?.generatedAt)} UTC</div>
        </div>
      </div>
    </div>
    <div class="s-footer">
      <div class="footer-text">${p.branding?.footer ?? 'UmaKraft • Distribution Pipeline • Workshop Fabricator'}</div>
    </div>
  `);
}

function tmplMilestone(p, avatarDataUri, w) {
  const img = avatarDataUri
    ? `<img class="avatar-lg" src="${avatarDataUri}" />`
    : `<div class="avatar-lg-placeholder"></div>`;

  return wrapHtml(w, `
    <div class="s-header">
      <span class="title">🏆 MILESTONE REACHED!</span>
      <span class="ts">${p.meta?.generatedAt ? p.meta.generatedAt.substring(0, 10) : '—'}</span>
    </div>
    <div class="s-body">
      <div class="identity-center">
        ${img}
        <div class="name">${p.meta?.trainerName ?? '—'}</div>
        ${p.meta?.circleName ? `<div class="sub">Circle: ${p.meta.circleName}</div>` : ''}
      </div>
    </div>
    <div class="s-body">
      <div class="achievement-block">
        <div class="achievement-label">Achievement</div>
        <div class="achievement-value">${p.milestone?.title ?? '—'}</div>
        <div class="achievement-meta">
          Milestone Type: ${p.milestone?.type ?? '—'}&nbsp;&nbsp;•&nbsp;&nbsp;Crossed: ${p.milestone?.crossedAt ?? '—'}
        </div>
      </div>
    </div>
    ${p.message?.body ? `
    <div class="s-body">
      <div class="message-body" style="text-align:center;font-style:italic">"${p.message.body}"</div>
    </div>` : ''}
    <div class="s-footer">
      <div class="footer-text">${p.branding?.footer ?? 'UmaKraft • Broadcast Pipeline • Workshop Fabricator'}</div>
    </div>
  `);
}

function tmplJoinDate(p, avatarDataUri, w) {
  const img = avatarDataUri
    ? `<img class="avatar" src="${avatarDataUri}" />`
    : `<div class="avatar-placeholder"></div>`;

  const flags = (p.flags ?? [])
    .map(f => `<div class="lv-row">
      <span class="lv-label" style="color:#FF5AA5;font-weight:700">${f.label}</span>
      <span class="lv-value" style="font-weight:400;color:#3A3552">${f.description}</span>
    </div>`)
    .join('');

  return wrapHtml(w, `
    <div class="s-header">
      <span class="title">📅 TRAINER JOIN DATE</span>
      <span class="ts">${fmtTs(p.meta?.generatedAt)}</span>
    </div>
    <div class="s-body">
      <div class="identity-row">
        ${img}
        <div class="identity-info">
          <div class="name">${p.meta?.trainerName ?? '—'}</div>
          <div class="sub">Circle : ${p.meta?.circleName ?? '—'}</div>
        </div>
      </div>
    </div>
    <div class="s-body">
      <div class="lv-row"><span class="lv-label">Joined</span><span class="lv-value">${p.joindate?.date ?? '—'}</span></div>
      <div class="lv-row"><span class="lv-label">Membership</span><span class="lv-value">${p.joindate?.durationDisplay ?? '—'}</span></div>
      <div class="lv-row"><span class="lv-label">Days Active</span><span class="lv-value">${fmt(p.joindate?.daysActive)}</span></div>
    </div>
    ${flags ? `<div class="s-body"><div class="section-title">Presence Flags</div>${flags}</div>` : ''}
    <div class="s-footer" style="display:flex;justify-content:space-between">
      <div class="footer-text">Source : Vault Historical Records</div>
      <div class="footer-text">uma.moe</div>
    </div>
  `);
}

// ─── Generic fallback template ────────────────────────────────────────────────
// Used for any blueprint that does not yet have a dedicated template.
// Renders the blueprint name, trigger, and all top-level product fields.

function tmplGeneric(descriptor, p, w) {
  const fields = Object.entries(p)
    .filter(([k]) => k !== 'blueprintKey' && k !== 'avatarDataUri')
    .map(([k, v]) => {
      const display = typeof v === 'object' && v !== null
        ? `<pre style="font-size:12px;color:#8A7CF7;white-space:pre-wrap;word-break:break-all">${JSON.stringify(v, null, 2)}</pre>`
        : `<span class="lv-value">${v ?? '—'}</span>`;
      return `<div class="lv-row"><span class="lv-label">${k}</span>${display}</div>`;
    })
    .join('');

  return wrapHtml(w, `
    <div class="s-header">
      <span class="title">${descriptor.name}</span>
      <span class="ts">${fmtTs(p.meta?.generatedAt)}</span>
    </div>
    <div class="s-body">
      <div class="section-title">Blueprint</div>
      <div class="lv-row"><span class="lv-label">Trigger</span><span class="lv-value">${descriptor.trigger}</span></div>
      <div class="lv-row"><span class="lv-label">Type</span><span class="lv-value">${descriptor.type}</span></div>
    </div>
    <div class="s-body">
      <div class="section-title">Compiled Product</div>
      ${fields || '<div class="lv-row"><span class="lv-label">—</span><span class="lv-value">No fields</span></div>'}
    </div>
    <div class="s-footer">
      <div class="footer-text">UmaKraft • Workshop Fabricator ${FABRICATOR_VERSION} • generic template</div>
    </div>
  `);
}

// ─── Template dispatcher ──────────────────────────────────────────────────────

/**
 * Build the HTML string for a given blueprint key and compiled product.
 *
 * Dispatches to a dedicated template when one exists, falls back to the
 * generic template. Additional template builders are registered by adding
 * a case here as each blueprint card is implemented.
 *
 * @param {string} blueprintKey
 * @param {object} descriptor    — from blueprint.js
 * @param {object} product       — compiled product data
 * @param {string|null} avatarDataUri
 * @param {number} canvasWidth
 * @returns {string} html
 */
function buildHtml(blueprintKey, descriptor, product, avatarDataUri, canvasWidth) {
  switch (blueprintKey) {
    case 'fanGain':   return tmplFanGain(product, avatarDataUri, canvasWidth);
    case 'warning':   return tmplWarning(product, canvasWidth);
    case 'setFans':   return tmplSetFans(product, canvasWidth);
    case 'greeting':  return tmplGreeting(product, avatarDataUri, canvasWidth);
    case 'milestone': return tmplMilestone(product, avatarDataUri, canvasWidth);
    case 'joinDate':  return tmplJoinDate(product, avatarDataUri, canvasWidth);
    default:          return tmplGeneric(descriptor, product, canvasWidth);
  }
}

// ─── Puppeteer render ─────────────────────────────────────────────────────────

const PUPPETEER_ARGS = [
  '--no-sandbox',
  '--disable-setuid-sandbox',
  '--disable-dev-shm-usage',
  '--disable-gpu',
];

// Use the Nix-managed system Chromium when available (resolves all shared-lib
// dependencies automatically). Falls back to Puppeteer's own bundled Chrome.
const CHROMIUM_CANDIDATES = [
  '/nix/store/qa9cnw4v5xkxyip6mb9kxqfq1z4x2dx1-chromium-138.0.7204.100/bin/chromium',
  process.env.PUPPETEER_EXECUTABLE_PATH,
];
const CHROMIUM_PATH = CHROMIUM_CANDIDATES.find(p => p && existsSync(p)) ?? undefined;

/**
 * Render an HTML string to a PNG Buffer via headless Chromium.
 *
 * @param {string} html
 * @param {number} canvasWidth
 * @returns {Promise<Buffer>}
 */
async function renderToPng(html, canvasWidth) {
  const puppeteer = await getPuppeteer();

  const browser = await puppeteer.launch({
    headless: 'new',
    args: PUPPETEER_ARGS,
    ...(CHROMIUM_PATH ? { executablePath: CHROMIUM_PATH } : {}),
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({
      width:             canvasWidth,
      height:            2400,
      deviceScaleFactor: 2,
    });

    await page.setContent(html, { waitUntil: 'networkidle0', timeout: 10_000 });

    const cardHandle = await page.$('#card');
    if (!cardHandle) {
      throw new Error('FABRICATOR_LAYOUT_ERROR: #card element not found in rendered HTML');
    }

    const box = await cardHandle.boundingBox();
    if (!box || box.width === 0 || box.height === 0) {
      throw new Error('FABRICATOR_LAYOUT_ERROR: #card bounding box is empty');
    }

    const png = await page.screenshot({
      type: 'png',
      clip: {
        x:      box.x,
        y:      box.y,
        width:  box.width,
        height: box.height,
      },
    });

    if (!png || png.length === 0) {
      throw new Error('FABRICATOR_EMPTY_OUTPUT: screenshot returned empty buffer');
    }

    return png;

  } finally {
    await browser.close();
  }
}

// ─── Input validation ─────────────────────────────────────────────────────────

function validateInput(compiledProduct) {
  if (compiledProduct === null || typeof compiledProduct !== 'object') {
    return 'compiledProduct must be a non-null object';
  }
  if (!compiledProduct.blueprintKey || typeof compiledProduct.blueprintKey !== 'string') {
    return 'compiledProduct.blueprintKey must be a non-empty string';
  }
  return null; // valid
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fabricate a PNG deliverable from a compiled product.
 *
 * Reads the blueprint descriptor from the Draftsman registry (blueprint.js),
 * builds the HTML layout, renders via Puppeteer/Chromium, and returns an
 * unvalidated deliverable object for the Validator.
 *
 * @param {object} compiledProduct
 * @param {string} compiledProduct.blueprintKey  — registry key from blueprint.js
 * @param {object} [compiledProduct.meta]        — product metadata including generatedAt, avatarUrl
 * @param {*}      [...fields]                   — blueprint-specific data fields
 *
 * @returns {Promise<FabricatorResult>}
 *
 * @example
 * const result = await fabricate({
 *   blueprintKey: 'fanGain',
 *   meta: { trainerId: '123', trainerName: 'SMART Falcon', avatarUrl: '...', generatedAt: '...' },
 *   fans: { lifetime: 12458224, daily: 125000, weekly: 870000, monthly: 3240000 },
 * });
 * if (result.success) {
 *   // result.png is a Buffer → pass to Validator
 * }
 */
export async function fabricate(compiledProduct) {
  // ── Input validation ───────────────────────────────────────────────────────
  const inputError = validateInput(compiledProduct);
  if (inputError) {
    log('error', `FABRICATOR_INVALID_INPUT: ${inputError}`);
    return failure('FABRICATOR_INVALID_INPUT', inputError, { received: compiledProduct });
  }

  const { blueprintKey } = compiledProduct;
  log('info', `fabricating — blueprintKey=${blueprintKey}`);

  // ── Blueprint resolution (wired to Draftsman) ──────────────────────────────
  let descriptor;
  try {
    descriptor = resolveBlueprint(blueprintKey);
  } catch (err) {
    log('error', err.message, { blueprintKey });
    return failure('FABRICATOR_UNKNOWN_BLUEPRINT', err.message, { blueprintKey });
  }

  log('info', `blueprint resolved — name="${descriptor.name}" trigger="${descriptor.trigger}"`);

  // ── Avatar fetch (graceful — never blocks render) ──────────────────────────
  const avatarDataUri = await fetchAvatarAsBase64(compiledProduct.meta?.avatarUrl);
  if (compiledProduct.meta?.avatarUrl && !avatarDataUri) {
    log('warn', 'avatar unavailable — rendering placeholder', { blueprintKey });
  }

  // ── HTML build ─────────────────────────────────────────────────────────────
  const canvasWidth = resolveCanvasWidth(blueprintKey);
  let html;
  try {
    html = buildHtml(blueprintKey, descriptor, compiledProduct, avatarDataUri, canvasWidth);
  } catch (err) {
    log('error', `FABRICATOR_TEMPLATE_ERROR: ${err.message}`, { blueprintKey });
    return failure('FABRICATOR_TEMPLATE_ERROR', err.message, { blueprintKey });
  }

  // ── Render via Puppeteer / Chromium ────────────────────────────────────────
  let png;
  try {
    png = await renderToPng(html, canvasWidth);
  } catch (err) {
    const errorCode = err.message.startsWith('FABRICATOR_')
      ? err.message.split(':')[0]
      : 'FABRICATOR_RENDER_ERROR';
    log('error', `${errorCode}: ${err.message}`, { blueprintKey });
    return failure(errorCode, err.message, { blueprintKey });
  }

  log('info', `fabricated — blueprintKey=${blueprintKey} bytes=${png.length}`);

  // ── Emit unvalidated deliverable ───────────────────────────────────────────
  return {
    success:       true,
    blueprintKey,
    blueprintName: descriptor.name,
    trigger:       descriptor.trigger,
    type:          descriptor.type,
    png,
    meta:          compiledProduct.meta ?? {},
    fabricatorVersion: FABRICATOR_VERSION,
    renderedAt:    new Date().toISOString(),
  };
}

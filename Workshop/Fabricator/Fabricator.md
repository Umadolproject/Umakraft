# Fabricator

**Authority:** `GOVERNANCE/ARCHITECTURE_AUTHORITY.md`
**Registry:** `GOVERNANCE/PIPELINE_REGISTRY.md`
**Version:** v3.0.0
**Stage:** 3 — Workshop (Generate Presentation Artifacts)
**Last Updated:** 2026-07-22

---

## Purpose

The **Fabricator** department is responsible for manufacturing final deliverables from compiled products and Draftsman specifications.

It transforms structured data into rendered image cards using a headless Chromium browser driven by Puppeteer. Every card is built from an HTML template that is hydrated with compiled product data and styled to match the layout defined in `blueprint.js`.

---

## Responsibilities

- Consume compiled products from the Depot
- Resolve the correct blueprint layout from `blueprint.js` using the product's blueprint key
- Build an HTML document that matches the blueprint layout exactly
- Launch a headless Chromium instance via Puppeteer
- Render the HTML to a PNG image buffer
- Fetch and embed avatar images at render time
- Emit the unvalidated deliverable to the Validator
- Keep rendering logic entirely separate from business logic

## Must Not

The Fabricator must **never**:

- Retrieve external data or call APIs for business information
- Perform business or domain calculations
- Determine product content, achievements, or ranking
- Compile raw information into data products
- Create or modify Draftsman specifications
- Approve its own completed work
- Distribute finalized deliverables to external systems
- Embed business logic into rendering templates

Those responsibilities belong to other departments.

---

## Rendering Engine

| Property | Value |
|----------|-------|
| Engine | Chromium (headless) via Puppeteer |
| Output format | PNG |
| Viewport | Matches canvas width defined in blueprint |
| Clip | Content bounding box (auto height unless fixed in blueprint) |
| Font | System sans-serif; loaded at render time from local assets |
| Image embed | Avatar and card art fetched via HTTP and embedded as Base64 |
| Timeout | 10 seconds per render |

---

## Blueprint Resolution

Before rendering, the Fabricator resolves the correct layout using `blueprint.js`.

### Import

```js
// Workshop/Fabricator/fabricator.js
import blueprints from '../Draftsman/Blueprint/blueprint.js';
```

### Resolution

Every compiled product carries a `blueprintKey` field set by the Compiler. The Fabricator uses this key to look up the matching descriptor from the registry:

```js
function resolveBlueprint(blueprintKey) {
  const descriptor = blueprints[blueprintKey];
  if (!descriptor) {
    throw new Error(`FABRICATOR_UNKNOWN_BLUEPRINT: no blueprint registered for key "${blueprintKey}"`);
  }
  return descriptor;
}
```

### Blueprint Descriptor Shape

```js
{
  name:    'Fan Gain',       // human-readable name — used in output metadata
  trigger: '/fan_gain',      // command or broadcast event
  type:    'command',        // "command" | "broadcast"
  layout:  `...ASCII art...` // layout reference — used for section order verification
}
```

The `layout` string is the authoritative section order reference. The Fabricator verifies that its HTML template renders sections in the same order before passing the output to the Validator.

---

## Render Pipeline

```text
Compiled Product (from Depot)
        │
        ▼
1. Resolve Blueprint
   blueprints[product.blueprintKey]
        │
        ▼
2. Validate Input Fields
   Required fields present and typed correctly
        │
        ▼
3. Fetch Remote Assets
   Avatar URL → HTTP GET → Base64 string
        │
        ▼
4. Build HTML Document
   Inject data into section template
   Apply color palette, typography, sizing from blueprint .md
        │
        ▼
5. Launch Puppeteer
   const browser = await puppeteer.launch({ ... })
        │
        ▼
6. Load HTML into Page
   await page.setContent(html, { waitUntil: 'networkidle0' })
        │
        ▼
7. Screenshot
   await page.screenshot({ type: 'png', clip: boundingBox })
        │
        ▼
8. Close Browser
        │
        ▼
9. Emit Unvalidated Deliverable
   { blueprintKey, png: Buffer, meta: { ... }, renderedAt }
        │
        ▼
Validator
```

---

## Puppeteer Configuration

```js
import puppeteer from 'puppeteer';

const PUPPETEER_CONFIG = {
  headless: 'new',
  args: [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
  ],
};

async function launchBrowser() {
  return puppeteer.launch(PUPPETEER_CONFIG);
}
```

### Page setup

```js
async function preparePage(browser, canvasWidth) {
  const page = await browser.newPage();
  await page.setViewport({
    width: canvasWidth,
    height: 2400,       // generous height; clipped to content bounding box
    deviceScaleFactor: 2, // retina-quality output
  });
  return page;
}
```

### Rendering a card

```js
async function renderCard(html, canvasWidth) {
  const browser = await launchBrowser();
  try {
    const page = await preparePage(browser, canvasWidth);
    await page.setContent(html, { waitUntil: 'networkidle0' });

    // Clip to the actual rendered card element, not the full viewport
    const cardHandle = await page.$('#card');
    const boundingBox = await cardHandle.boundingBox();

    const png = await page.screenshot({
      type: 'png',
      clip: {
        x: boundingBox.x,
        y: boundingBox.y,
        width: boundingBox.width,
        height: boundingBox.height,
      },
    });
    return png;
  } finally {
    await browser.close();
  }
}
```

The root HTML element must use `id="card"` so the bounding box clip is always scoped to the card, not the viewport.

---

## HTML Template Structure

Each blueprint has a dedicated HTML template. All templates follow the same skeleton:

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <style>
    /* ── Reset ── */
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: transparent; font-family: sans-serif; }

    /* ── Card shell ── */
    #card {
      width: {{canvasWidth}}px;
      background: #FFF8FB;
      border-radius: 20px;
      border: 1px solid #E7D8F5;
      overflow: hidden;
      padding: 40px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    /* ── Section styles ── */
    .section-header   { background: {{accentColor}}; color: #fff; ... }
    .section-body     { background: #FFFFFF; border: 1px solid #E7D8F5; ... }
    .section-footer   { color: #9E9E9E; font-size: 13px; ... }
    /* Blueprint-specific overrides applied per template */
  </style>
</head>
<body>
  <div id="card">
    <!-- Sections injected here by the template builder -->
    {{sections}}
  </div>
</body>
</html>
```

The `{{canvasWidth}}`, `{{accentColor}}`, and `{{sections}}` placeholders are replaced by the template builder before the HTML is passed to Puppeteer.

---

## Avatar Fetching

Avatars are fetched at render time and embedded as Base64 data URIs so Puppeteer does not need to make network requests during screenshot capture.

```js
import https from 'https';
import http from 'http';

async function fetchAvatarAsBase64(url) {
  if (!url) return null;
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => {
        const buffer = Buffer.concat(chunks);
        const mime = res.headers['content-type'] ?? 'image/png';
        resolve(`data:${mime};base64,${buffer.toString('base64')}`);
      });
      res.on('error', () => resolve(null)); // graceful fallback
    });
  });
}
```

If the fetch fails or the URL is absent, the avatar slot renders a placeholder circle using CSS — the card render does not fail.

```html
<!-- Avatar element in HTML template -->
<div class="avatar-wrapper">
  {{#if avatarDataUri}}
    <img class="avatar" src="{{avatarDataUri}}" />
  {{else}}
    <div class="avatar avatar-placeholder"></div>
  {{/if}}
</div>
```

---

## Reading blueprint.js for Design

The Fabricator uses `blueprint.js` at two points:

### 1. At startup — build the template map

```js
import blueprints from '../Draftsman/Blueprint/blueprint.js';
import { buildTemplate } from './templates/index.js';

// Pre-build HTML template functions for every registered blueprint
const templateMap = {};
for (const [key, descriptor] of Object.entries(blueprints)) {
  templateMap[key] = buildTemplate(key, descriptor);
}
```

`buildTemplate(key, descriptor)` returns a function `(compiledProduct) => htmlString`.

### 2. At render time — resolve and invoke

```js
async function fabricate(compiledProduct) {
  const { blueprintKey } = compiledProduct;

  // Resolve descriptor
  const descriptor = blueprints[blueprintKey];
  if (!descriptor) {
    throw new Error(`FABRICATOR_UNKNOWN_BLUEPRINT: "${blueprintKey}"`);
  }

  // Fetch remote assets
  const avatarDataUri = await fetchAvatarAsBase64(compiledProduct.meta?.avatarUrl);

  // Build HTML
  const templateFn = templateMap[blueprintKey];
  const html = templateFn({ ...compiledProduct, avatarDataUri });

  // Render
  const canvasWidth = resolveCanvasWidth(blueprintKey); // from blueprint .md
  const png = await renderCard(html, canvasWidth);

  // Emit unvalidated deliverable
  return {
    blueprintKey,
    blueprintName: descriptor.name,
    trigger:       descriptor.trigger,
    type:          descriptor.type,
    png,
    meta:          compiledProduct.meta,
    renderedAt:    new Date().toISOString(),
  };
}
```

### Canvas width resolution

Canvas widths are defined in each blueprint's `.md` file and mirrored here as constants:

```js
const CANVAS_WIDTHS = {
  fanGain:             1200,
  profile:             1080,
  leaderboard:         1080,
  clubGain:            1080,
  totalFan:            1200,
  totalCircleFanGain:  1080,
  searchTrainer:       1200,
  circle:              1080,
  circleMaster:        1080,
  linkList:            1080,
  memberList:          1080,
  joinDate:             900,
  setFans:              900,
  greeting:             900,
  warning:              900,
  milestone:            900,
  link:                 900,
  help:                1200,
};

function resolveCanvasWidth(blueprintKey) {
  return CANVAS_WIDTHS[blueprintKey] ?? 1080;
}
```

---

## Deliverable Output Shape

```js
{
  blueprintKey:  'fanGain',               // registry key from blueprint.js
  blueprintName: 'Fan Gain',             // human-readable from descriptor
  trigger:       '/fan_gain',            // command or broadcast event
  type:          'command',              // "command" | "broadcast"
  png:           Buffer,                 // PNG image buffer
  meta: {
    trainerId:   '...',
    generatedAt: '...',
    // ...fields from compiled product meta
  },
  renderedAt:    '2026-07-22T14:32:00.000Z',
}
```

This object is passed to the Validator unchanged. The Fabricator does not modify or approve it.

---

## Error Handling

| Condition | Behaviour |
|-----------|-----------|
| Unknown `blueprintKey` | Throw `FABRICATOR_UNKNOWN_BLUEPRINT` — do not render |
| Missing required field | Throw `FABRICATOR_INVALID_INPUT` with field name |
| Avatar fetch failure | Log warning; render placeholder — do not throw |
| Puppeteer timeout (> 10s) | Throw `FABRICATOR_RENDER_TIMEOUT` |
| `#card` element not found | Throw `FABRICATOR_LAYOUT_ERROR` — template is malformed |
| `page.screenshot` returns empty buffer | Throw `FABRICATOR_EMPTY_OUTPUT` |

All errors propagate to the Coordinator. The Coordinator decides whether to retry or return an error response to the Dispatcher.

---

## Performance Requirements

- Cold browser launch: < 3 seconds
- Per-card render (hot browser): < 2 seconds
- Avatar fetch: < 1 second (timeout after 2 seconds; fall back to placeholder)
- Browser instance closed immediately after each render — no persistent browser pool at this stage

---

## Input

- Compiled products from the Depot
- Blueprint descriptors from `Workshop/Draftsman/Blueprint/blueprint.js`
- Avatar images fetched via HTTP at render time

## Output

- Unvalidated PNG deliverable object (see Deliverable Output Shape above)
- Passed directly to the Validator

---

## Workflow

```text
Depot
   │
   ├──────────────► Compiled Product (blueprintKey + data)
   │
blueprint.js
   │
   ├──────────────► Blueprint Descriptor (name, trigger, type, layout)
   │
Avatar URL
   │
   ├──────────────► Base64 data URI (or null)
   │
         │
         ▼
     Fabricator
         │
         ├── Resolve blueprint from registry
         ├── Validate input fields
         ├── Fetch avatar as Base64
         ├── Build HTML from template
         ├── Launch Puppeteer / Chromium
         ├── Load HTML → screenshot → PNG buffer
         └── Close browser
         │
         ▼
 Unvalidated Deliverable
         │
         ▼
     Validator
```

---

## Design Principle

The Fabricator builds according to specification.

It does not decide what a product should contain, calculate the information inside it, or determine whether the completed product meets the required standard.

Its only responsibility is to read the compiled product, resolve the matching blueprint from `blueprint.js`, render the HTML layout with Puppeteer/Chromium, and emit the resulting PNG buffer to the Validator.

---

## Related Files

| File | Role |
|------|------|
| `Workshop/Draftsman/Blueprint/blueprint.js` | Blueprint registry — all layout descriptors |
| `Workshop/Draftsman/Blueprint/*.md` | Per-blueprint canvas dimensions, sections, color palettes, typography |
| `Workshop/Validator/` | Receives and inspects Fabricator output |
| `Workshop/Terminal/` | Departure point for approved deliverables |

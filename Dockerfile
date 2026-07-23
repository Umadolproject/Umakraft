# Dockerfile
# UmaKraft — Railway production image
#
# Uses system Chromium (not Puppeteer's bundled binary) so the image stays
# lean and Chromium sandbox permissions are handled cleanly.
#
# Build variables:
#   PUPPETEER_SKIP_DOWNLOAD=true          — skip bundled Chromium download
#   PUPPETEER_EXECUTABLE_PATH             — point Puppeteer at system Chromium

FROM node:20-slim

# ── System dependencies ────────────────────────────────────────────────────────
# Chromium + all shared libraries it needs for headless rendering.
# Noto fonts cover CJK / Japanese characters used in Uma Musume card renders.
RUN apt-get update && apt-get install -y --no-install-recommends \
    chromium \
    fonts-liberation \
    fonts-noto \
    fonts-noto-cjk \
    fonts-noto-color-emoji \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libxss1 \
    libxtst6 \
    xdg-utils \
    && rm -rf /var/lib/apt/lists/*

# ── Puppeteer — use system Chromium ───────────────────────────────────────────
ENV PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium \
    HF_HOME=/data/.cache/huggingface

# ── App ────────────────────────────────────────────────────────────────────────
WORKDIR /app

# Install dependencies first (better layer caching — only re-runs on package.json change).
# Note: package-lock.json is excluded via .dockerignore because Replit's lockfile
# contains internal mirror URLs (package-firewall.replit.local) that are unreachable
# on Railway. We use npm install with the public registry instead of npm ci.
COPY package.json ./
RUN npm install --omit=dev --registry https://registry.npmjs.org

# Copy the rest of the source
COPY . .

# Run as non-root for security (node user is built into the node base image)
RUN mkdir -p /data/.cache/huggingface \
    && chown -R node:node /data
USER node

CMD ["node", "Distribution/Discord/index.js"]

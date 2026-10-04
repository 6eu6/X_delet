#!/usr/bin/env bash
# تثبيت الوركر على Ubuntu (AMD أو ARM) — شغّله من داخل مجلد worker/
set -euo pipefail
cd "$(dirname "$0")"
if ! command -v node >/dev/null || [ "$(node -v | cut -d. -f1 | tr -d v)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi
npm install --omit=dev
sudo npx playwright install --with-deps chromium
if [ ! -f .env ]; then cp .env.example .env && chmod 600 .env && echo ">> عدّل worker/.env ثم أعد تشغيل السكربت"; exit 0; fi
sudo tee /etc/systemd/system/x-worker.service >/dev/null <<UNIT
[Unit]
Description=X Manager Worker
After=network-online.target
[Service]
WorkingDirectory=$(pwd)
EnvironmentFile=$(pwd)/.env
ExecStart=$(command -v node) index.js
Restart=always
RestartSec=20
User=$(whoami)
[Install]
WantedBy=multi-user.target
UNIT
sudo systemctl daemon-reload && sudo systemctl enable --now x-worker
echo ">> الوركر يعمل. السجل: journalctl -u x-worker -f"

#!/bin/bash

# SolAgent Vault: Persistent VPS Deployment Script
# This script installs Node.js, pnpm, pm2, builds the monorepo, and starts the daemons.

set -e

echo "🚀 Starting SolAgent Vault VPS Deployment..."

# 1. Update system packages
echo "📦 Updating system packages..."
sudo apt-get update && sudo apt-get upgrade -y
sudo apt-get install -y curl git build-essential

# 2. Install Node.js 20.x (LTS)
if ! command -v node &> /dev/null; then
    echo "⚙️ Installing Node.js..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt-get install -y nodejs
else
    echo "✅ Node.js is already installed: $(node -v)"
fi

# 3. Install core global tools (pnpm and pm2)
echo "🛠️ Installing pnpm and pm2..."
sudo npm install -g pnpm pm2

# 4. Install dependencies and build the monorepo
echo "🏗️ Installing dependencies and compiling TypeScript..."
pnpm install
pnpm build

# 5. Start the API and Orchestrator managed by PM2
echo "🔥 Booting daemons..."

# Stop them if they are already running to allow for updates
pm2 stop vault-api 2>/dev/null || true
pm2 stop orchestrator 2>/dev/null || true

# Start Vault API
pm2 start pnpm --name "vault-api" -- run vault-api
# Start AI Orchestrator
pm2 start pnpm --name "orchestrator" -- run orchestrator

# 6. Save PM2 state to restart on server reboot
echo "💾 Saving PM2 process list for auto-resurrection..."
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME 2>/dev/null || true

echo ""
echo "==========================================================="
echo "✅ DEPLOYMENT COMPLETE!"
echo ""
echo "Your API is running on port 3001."
echo "Your AI Orchestrator is running in the background."
echo ""
echo "Monitor logs with:"
echo "  pm2 logs vault-api"
echo "  pm2 logs orchestrator"
echo "==========================================================="

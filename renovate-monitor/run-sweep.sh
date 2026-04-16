#!/bin/bash
# Renovate Monitor - Morning Sweep (6:30 AM)
# Searches for new Renovate/Dependabot PRs and categorizes them

cd "$(dirname "$0")"

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

echo "[$(date)] Starting morning sweep..." >> logs/cron.log
node orchestrator.js sweep >> logs/cron.log 2>&1
echo "[$(date)] Morning sweep complete" >> logs/cron.log

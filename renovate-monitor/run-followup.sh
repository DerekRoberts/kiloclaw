#!/bin/bash
# Renovate Monitor - Follow-up Check (7:30 AM)
# Re-checks pending PRs and hands failing ones to Kilo Cloud

cd "$(dirname "$0")"

export PATH="$HOME/.local/bin:$HOME/bin:/usr/local/bin:$PATH"

echo "[$(date)] Starting follow-up check..." >> logs/cron.log
node orchestrator.js followup >> logs/cron.log 2>&1
echo "[$(date)] Follow-up check complete" >> logs/cron.log

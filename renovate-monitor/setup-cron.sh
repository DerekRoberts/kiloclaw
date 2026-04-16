#!/bin/bash
# Setup cron jobs for Renovate Monitor
# Run this after configuring Gmail and GitHub auth

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CRON_SWEEP="30 6 * * 1-5 cd $SCRIPT_DIR && ./run-sweep.sh"
CRON_FOLLOWUP="30 7 * * 1-5 cd $SCRIPT_DIR && ./run-followup.sh"

echo "Setting up Renovate Monitor cron jobs..."
echo "Script directory: $SCRIPT_DIR"

# Remove existing renovate-monitor entries
(crontab -l 2>/dev/null | grep -v "renovate-monitor") | crontab -

# Add new entries
(crontab -l 2>/dev/null; echo "$CRON_SWEEP"; echo "$CRON_FOLLOWUP") | crontab -

echo "Cron jobs installed:"
echo "  6:30 AM weekdays - Morning sweep"
echo "  7:30 AM weekdays - Follow-up check"
echo ""
crontab -l | grep renovate-monitor

echo ""
echo "Make sure you have:"
echo "  1. Gmail auth configured: gog auth list"
echo "  2. GitHub auth configured: gh auth status"
echo "  3. Made scripts executable: chmod +x *.sh"

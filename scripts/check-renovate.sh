#!/bin/bash
# Check for failing Renovate PRs at 6 AM PDT (13:00 UTC)
# Run via: gog gmail search -> filter -> diagnose

set -euo pipefail

LOG_FILE="/tmp/renovate-check-$(date +%Y%m%d).log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== Renovate Check: $(date) ==="

# Search Gmail for Renovate notifications from last 24 hours
echo "Searching Gmail..."
EMAILS=$(gog gmail search --account derek.roberts.bot@gmail.com \
  --query "from:notifications@github.com subject:renovate newer_than:1d" \
  --format json 2>/dev/null | jq -r '.[] | select(.subject | contains("renovate")) | "\(.id)\t\(.subject)"' || true)

if [ -z "$EMAILS" ]; then
  echo "No Renovate emails found in last 24h"
  exit 0
fi

REPORT=""

while IFS=$'\t' read -r MSG_ID SUBJECT; do
  echo ""
  echo "Checking: $SUBJECT"
  
  # Get email body
  BODY=$(gog gmail get --account derek.roberts.bot@gmail.com "$MSG_ID" --format json 2>/dev/null | jq -r '.snippet' || true)
  
  # Check if it's about a PR (not just a notification)
  if ! echo "$SUBJECT" | grep -qE "\(#[0-9]+\)|pull request"; then
    echo "  → Not a PR notification, skipping"
    continue
  fi
  
  # Check for failure indicators
  if echo "$BODY" | grep -qiE "failing|failed|error|build.*broken|tests.*fail"; then
    echo "  → FAILURE DETECTED"
    
    # Extract repo and PR number
    REPO=$(echo "$BODY" | grep -oE "[a-zA-Z0-9_-]+/[a-zA-Z0-9_-]+" | head -1)
    PR_NUM=$(echo "$SUBJECT" | grep -oE "#([0-9]+)" | head -1 | tr -d '#')
    
    if [ -n "$REPO" ] && [ -n "$PR_NUM" ]; then
      echo "  → Repo: $REPO, PR: $PR_NUM"
      
      # Check GitHub PR status
      PR_DATA=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
        "https://api.github.com/repos/$REPO/pulls/$PR_NUM" 2>/dev/null || true)
      
      STATE=$(echo "$PR_DATA" | jq -r '.state // "unknown"')
      MERGED=$(echo "$PR_DATA" | jq -r '.merged // "unknown"')
      HTML_URL=$(echo "$PR_DATA" | jq -r '.html_url // ""')
      
      if [ "$STATE" = "open" ] && [ "$MERGED" = "false" ]; then
        echo "  → Status: OPEN, NOT MERGED"
        
        # Get failing checks
        CHECKS=$(curl -s -H "Authorization: Bearer $GITHUB_TOKEN" \
          "https://api.github.com/repos/$REPO/pulls/$PR_NUM/checks" 2>/dev/null | \
          jq -r '.check_runs[]? | select(.conclusion=="failure") | .name' | head -3 | tr '\n' ', ' || true)
        
        REPORT="${REPORT}
🔴 FAILING: $SUBJECT
   URL: $HTML_URL
   Failing checks: ${CHECKS:-unknown}
"
      else
        echo "  → Status: $STATE, merged=$MERGED (not actionable)"
      fi
    fi
  else
    echo "  → No failure indicators found"
  fi
done <<< "$EMAILS"

# Send report if there are failures
if [ -n "$REPORT" ]; then
  echo ""
  echo "=== FAILING RENOVATE PRs ==="
  echo "$REPORT"
  
  # Send Telegram notification
  # telegram send --target "@derekroberts" --message "Renovate Report:\n$REPORT"
else
  echo ""
  echo "=== No failing Renovate PRs found ==="
fi

echo ""
echo "=== Check complete: $(date) ==="
echo "Log saved to: $LOG_FILE"

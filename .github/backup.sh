#!/bin/bash
# Workspace backup script - pushes to DerekRoberts/kiloclaw

set -e

REPO_URL="https://github.com/DerekRoberts/kiloclaw.git"
WORKSPACE_DIR="/root/.openclaw/workspace"
BACKUP_BRANCH="main"
TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")

echo "Starting backup at $TIMESTAMP"

cd "$WORKSPACE_DIR"

# Configure git
git config user.name "KiloClaw Backup Bot"
git config user.email "derek.roberts.bot@gmail.com"

# Check if remote exists, add if not
if ! git remote | grep -q "origin"; then
    git remote add origin "$REPO_URL"
fi

# Pull latest to avoid conflicts
git pull origin "$BACKUP_BRANCH" --rebase || true

# Stage all changes
git add -A

# Check if there are changes to commit
if git diff --cached --quiet; then
    echo "No changes to backup"
    exit 0
fi

# Commit with timestamp
git commit -m "Backup: $TIMESTAMP [automated]"

# Push to main (per DEREK_RULES.md - no PR needed for backups)
git push origin "$BACKUP_BRANCH"

echo "Backup complete: $TIMESTAMP"

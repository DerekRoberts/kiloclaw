# Renovate Monitor Spawn Fix

## Problem
The orchestrator was trying to use `openclaw sessions spawn` which doesn't exist as a CLI command. The error log showed:
```
Command failed: openclaw sessions spawn --runtime subagent --agent-id main --mode run --task-file ...
Error: error: unknown option '--runtime'
```

## Root Cause
The `sessions_spawn` functionality is an **agent tool**, not a CLI command. When the orchestrator runs via `exec` from a cron job, it cannot directly spawn sub-agents.

## Solution Options

### Option 1: Use `openclaw cron add` (Recommended)
Instead of trying to spawn directly, schedule a one-time cron job:

```javascript
async function spawnKiloCloud(prInfo, status, checkResults) {
  const permissions = getPermissions(prInfo.owner);
  const taskMessage = `Fix Renovate PR ${prInfo.fullRepo}#${prInfo.prNumber}...`;
  
  const cronJob = {
    name: `renovate-fix-${prInfo.repo}-${prInfo.prNumber}`,
    schedule: { kind: "at", at: new Date(Date.now() + 60000).toISOString() },
    sessionTarget: "isolated",
    wakeMode: "now",
    deleteAfterRun: true,
    payload: {
      kind: "agentTurn",
      message: taskMessage,
      timeoutSeconds: 3600
    },
    delivery: { mode: "announce", channel: "last" }
  };
  
  // Write to file and use: openclaw cron add --file <path>
}
```

### Option 2: Fix Email Notifications (Current)
The orchestrator currently uses `notifyKiloCloud()` which sends an email. The delete command has wrong syntax though.

Fix for delete command in orchestrator.js line 225:
```javascript
// Current (broken):
runCommand(`gog gmail messages modify --account ${config.gmailAccount} ${messageId} --add TRASH --remove INBOX`);

// Should be (check gog CLI for correct syntax):
runCommand(`gog gmail modify --account ${config.gmailAccount} ${messageId} --trash`);
// or use Google API directly via curl
```

### Option 3: Keep Current Flow
The current flow works:
1. Morning sweep identifies failing PRs
2. Follow-up sends email notification with task details
3. You manually trigger the fix or handle via email rules

## Current Status (2026-04-14 06:44 UTC)
- bcgov/quickstart-openshift-backends#463 is queued with 2 failing checks:
  - "Deploys / Stack" (FAILURE)
  - "PR Results" (FAILURE)
- Status: `with_kilo` (notification sent)

## Recommended Immediate Fix
Update the orchestrator to use `openclaw cron add` for actual sub-agent spawning instead of email notifications.

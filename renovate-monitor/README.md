# Renovate Monitor

Automated monitoring of Renovate and Dependabot PRs with intelligent routing.

## How It Works

```
6:30 AM (weekdays) - Morning Sweep
  ├─ Scan Gmail for Renovate/Dependabot PR emails
  ├─ Check CI status on each PR
  ├─ All passing → Delete email ✓
  ├─ Failing → Queue for Kilo Cloud
  └─ Pending → Watch list

7:30 AM (weekdays) - Follow-up Check
  ├─ Re-check pending PRs
  ├─ Now passing → Delete email ✓
  └─ Still failing → Spawn Kilo Cloud to fix

9:00 AM - You get summary email with results
```

## Permission Boundaries

| Organization | Kilo Cloud Can |
|--------------|----------------|
| `DerekRoberts/*` | Full write: checkout, fix, push commits |
| `bcgov/*`, `bcgov-c/*`, `bcgov-nr/*`, `bcdevops/*` | Read-only: analyze, report findings |
| Other | Defaults to read-only |

## Setup

### 1. Prerequisites

Ensure you have authenticated with:

```bash
# Gmail (for reading PR emails, sending summaries)
gog auth login derek.roberts@gmail.com

# GitHub (for checking PR status)
gh auth login
```

### 2. Configure

Edit `config.json` to customize:

```json
{
  "gmailAccount": "derek.roberts@gmail.com",
  "summaryEmailTo": "derek.roberts@gmail.com",
  "readonlyOrgs": ["bcgov", "bcgov-c", "bcgov-nr", "bcdevops"],
  "monitoredAuthors": ["Mend Renovate", "Dependabot"]
}
```

### 3. Install Cron Jobs

```bash
./setup-cron.sh
```

This creates:
- 6:30 AM weekday sweep
- 7:30 AM weekday follow-up

### 4. Test

```bash
# Test morning sweep
./run-sweep.sh

# Test follow-up (run after sweep)
./run-followup.sh

# Or run both for testing
node orchestrator.js full
```

## Files

| File | Purpose |
|------|---------|
| `orchestrator.js` | Main logic |
| `run-sweep.sh` | Morning sweep wrapper |
| `run-followup.sh` | Follow-up check wrapper |
| `setup-cron.sh` | Install cron jobs |
| `config.json` | Configuration |
| `state.json` | Pending PR tracking (auto-generated) |
| `logs/` | Execution logs |

## Logs

Check `logs/` directory for daily execution logs:

```bash
tail -f logs/$(date +%Y-%m-%d).log
tail -f logs/cron.log
```

## Manual Override

To manually trigger:

```bash
# Morning sweep only
node orchestrator.js sweep

# Follow-up only (uses state.json from sweep)
node orchestrator.js followup

# Both (test mode)
node orchestrator.js full
```

## Troubleshooting

### No emails found
- Check Gmail filters aren't auto-archiving
- Verify `gog` auth: `gog gmail search --account derek.roberts@gmail.com --query "from:Mend Renovate" --limit 5`

### PR status check fails
- Verify `gh` auth: `gh auth status`
- Check repo access: `gh repo view bcgov/myrepo`

### Kilo Cloud not spawning
- Verify OpenClaw is running: `openclaw status`
- Check agent availability: `openclaw agents_list`

## Uninstall

Remove cron jobs:

```bash
crontab -l | grep -v renovate-monitor | crontab -
```

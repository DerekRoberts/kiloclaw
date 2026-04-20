# 🤖 Agent Capabilities & Automation Registry

**Purpose:** Document all automated behaviors, hooks, and background processes so they can be audited, modified, or disabled.

**Last Updated:** 2026-04-20

---

## 📧 Gmail Webhook Integration

**Status:** ✅ ACTIVE  
**Location:** `/root/.openclaw/openclaw.json` → `hooks` section  
**Trigger:** Incoming emails to `derek.roberts.bot@gmail.com`

### How It Works

1. **Cloudflare Email Routing** forwards emails to OpenClaw webhook endpoint
2. **OpenClaw receives** the email at `/hooks/email`
3. **Spawns isolated agent session** with email content
4. **Agent analyzes** the email (GitHub notifications, etc.)
5. **Takes action** if patterns match (approve PRs, create branches, etc.)
6. **Session ends** without notifying main conversation

### Current Configuration

```json
{
  "hooks": {
    "enabled": true,
    "presets": ["gmail"],
    "mappings": [{
      "id": "cloudflare-email-inbound",
      "action": "agent",
      "wakeMode": "now",  // ⚠️ Immediate action
      "name": "Inbound Email"
    }]
  }
}
```

### Known Behaviors

When receiving GitHub notification emails:
- **PR review requests** → May approve/comment on PRs
- **New issues** → May create branches if patterns match
- **Renovate failures** → May queue for analysis

**⚠️ IMPORTANT:** These actions happen in isolated sessions without explicit confirmation in your main chat.

### Audit Trail

Check for webhook-triggered actions:
```bash
# Check OpenClaw logs
tail -f /tmp/openclaw/openclaw-20/*.log | grep -i "hook\|email\|gmail"

# Check Gmail for processed emails
gog gmail search --account derek.roberts.bot@gmail.com -j "is:read newer_than:1d"

# Check recent bot activity
gh api users/derekrobertsbot/events --paginate | jq -r '.[] | select(.created_at > "2026-04-20T00:00:00Z")'
```

### How to Modify

**Option A: Disable entirely**
```bash
# Edit /root/.openclaw/openclaw.json
"hooks": {
  "enabled": false
}
# Restart OpenClaw gateway
```

**Option B: Add confirmation step**
Change `"wakeMode": "now"` to `"wakeMode": "next-heartbeat"`
→ Actions will queue and wait for your approval

**Option C: Filter specific email types**
Add pattern matching to only act on specific subjects/senders

---

## ⏰ Scheduled Tasks (Cron Jobs)

### Renovate Monitor
- **Sweep:** 6:30 AM PDT weekdays
- **Follow-up:** 7:30 AM PDT weekdays
- **Purpose:** Check Renovate PRs, queue failing ones

### Workspace Backup
- **Schedule:** 5:00 AM PDT daily
- **Purpose:** Backup workspace to DerekRoberts/kiloclaw

### View All Cron Jobs
```bash
openclaw cron list
```

---

## 🔑 Permissions & Tokens

| Token | Location | Scope | Used For |
|-------|----------|-------|----------|
| `GH_PAT` | Various repos | `repo` | GitHub API calls, PR comments |
| Telegram bot token | OpenClaw config | Messaging | This chat interface |
| Gmail app password | Environment | Send/Read | Email notifications |

---

## 📝 Recent Activity Log

| Date | Action | Trigger | Repo/Issue |
|------|--------|---------|------------|
| 2026-04-20 | Approved PR #344 | Gmail webhook | vexilon |
| 2026-04-20 | Created 3 branches | Unknown (webhook?) | vexilon |
| 2026-04-19 | Commented on PRs | Gmail webhook | various |
| 2026-04-16 | pr-check run | Manual test | pr-check |
| 2026-04-14 | Closed 47 issues | Manual (chat) | various |

---

## 🛠️ Active Projects

### pr-check
- **Purpose:** Analyze failing Renovate PRs
- **Status:** MVP, needs GH_PAT secret
- **Repos:** Limited to 4-repo allowlist

### Renovate Monitor
- **Purpose:** Daily sweep of Renovate PRs
- **Status:** Running, sends emails at 7:30 AM PDT

---

## 🚨 Troubleshooting

**"Mystery activity" detected:**
1. Check this file's "Recent Activity Log"
2. Check Gmail inbox for processed emails
3. Check OpenClaw logs: `/tmp/openclaw/openclaw-20/`
4. Ask: "Did I authorize this in a previous session?"

**Want to stop all automation:**
```bash
# Disable hooks
openclaw config set hooks.enabled false

# Disable cron
openclaw cron disable <job-id>
```

---

## 📝 Modification Guidelines

**Adding new automation:**
1. Document it here BEFORE enabling
2. Add to "Scheduled Tasks" or "Webhooks" section
3. Include: purpose, trigger, action, audit method
4. Set expiration date if experimental

**Removing automation:**
1. Note removal date in this file
2. Keep historical record for 30 days
3. Verify no dependencies

---

**Questions?** Ask: "What automation do I have running?" or check `openclaw cron list` and this file.

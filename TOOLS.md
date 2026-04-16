# TOOLS.md - Local Notes

Skills define _how_ tools work. This file is for _your_ specifics — the stuff that's unique to your setup.

## What Goes Here

Things like:

- Camera names and locations
- SSH hosts and aliases
- Preferred voices for TTS
- Speaker/room names
- Device nicknames
- Anything environment-specific

## Examples

```markdown
### Cameras

- living-room → Main area, 180° wide angle
- front-door → Entrance, motion-triggered

### SSH

- home-server → 192.168.1.100, user: admin

### TTS

- Preferred voice: "Nova" (warm, slightly British)
- Default speaker: Kitchen HomePod
```

## Why Separate?

Skills are shared. Your setup is yours. Keeping them apart means you can update skills without losing your notes, and share skills without leaking your infrastructure.

---

Add whatever helps you do your job. This is your cheat sheet.

<!-- BEGIN:kilo-cli -->
## Kilo CLI

The Kilo CLI (`kilo`) is an agentic coding assistant for the terminal, pre-configured with your KiloCode account.

- Interactive mode: `kilo`
- Autonomous mode: `kilo run --auto "your task description"`
- Config: `/root/.config/kilo/opencode.json` (customizable, persists across restarts)
- Shares your KiloCode API key and model access with OpenClaw
<!-- END:kilo-cli -->
<!-- BEGIN:google-workspace -->
## Google Workspace

The `gog` CLI is configured and ready for Google Workspace operations (Gmail, Calendar, Drive, Docs, Sheets, Slides, Tasks, Forms, Chat, Classroom).

- List accounts: `gog auth list`
- Gmail — search: `gog gmail search --account <email> --query "from:X"`
- Gmail — read: `gog gmail get --account <email> <message-id>`
- Gmail — send: `gog gmail send --account <email> --to <addr> --subject "..." --body "..."`
- Calendar — list events: `gog calendar events list --account <email>`
- Drive — list files: `gog drive files list --account <email>`
- Docs — read: `gog docs get --account <email> <doc-id>`
- Run `gog --help` and `gog <service> --help` for all available commands.
<!-- END:google-workspace -->
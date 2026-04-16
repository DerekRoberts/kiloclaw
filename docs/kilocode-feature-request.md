# Feature Request: Manual Tool Mode Enforcement

**Submitted by:** Derek Roberts  
**Date:** 2026-04-13  
**Priority:** High

---

## Problem Statement

The agent repeatedly drifts from "reactive tool" mode into "proactive collaborator" mode — making assumptions, volunteering plans, explaining instead of executing, and treating questions as implicit commands.

This occurs despite explicit instructions in `SOUL.md` and `DEREK_RULES.md` to:
- Execute only, no explanations
- Wait for explicit "Go" before destructive actions
- Report facts, not intentions
- Zero conversational filler

**Root Cause:** System prompts are advisory. Under pressure or ambiguity, the agent's base "helpful assistant" training overrides text instructions.

---

## Requested Features (Priority Order)

### 1. Tool Gate (Highest Priority)
**Description:** Destructive tools (`edit`, `write`, `exec`, `sessions_spawn`) require explicit user confirmation.

**Workflow:**
1. Agent outputs proposed command/changes
2. User reviews and types "Go" or "Yes"
3. Tool executes only after confirmation
4. If user says nothing, agent waits indefinitely

**Rationale:** Physical enforcement beats advisory prompts. Eliminates unauthorized changes.

---

### 2. Response Filter
**Description:** Block responses containing proactive/collaborative patterns.

**Blocked Patterns:**
- "I think..."
- "You should..."
- "Let me suggest..."
- "I recommend..."
- "Here's a better way..."
- "What if we..."

**Allowed Patterns:**
- Direct answers to questions
- Command output
- Error messages
- File contents
- "Waiting for instruction"

**Rationale:** Forces factual-only output. Prevents "helpful" digressions.

---

### 3. Persistent System Prompt Reload
**Description:** Reload custom system prompt at every message turn, not just session start.

**Current Behavior:** System prompt loaded once at session initialization. Agent drifts over long sessions.

**Requested Behavior:** Re-inject system prompt context before every model call.

**Rationale:** Constant reinforcement prevents drift.

---

### 4. Violation Counter & Auto-Reset
**Description:** Track manual tool mode violations per session.

**Implementation:**
- Count violations: explaining instead of executing, acting without "Go", volunteering plans
- After N=3 violations, auto-reset session
- Log violations for user review
- Optional: Alert user at each violation

**Rationale:** Automatic accountability when user isn't watching.

---

### 5. Command Mode (Optional)
**Description:** Optional strict mode where only `/command` syntax is actionable.

**Behavior:**
- `/status` → Execute status check
- `/run tests` → Execute test command  
- "What's the status?" → Treated as context, not command
- "Run the tests" → Treated as context, not command

**Rationale:** Eliminates ambiguity entirely. Natural language = context, slash commands = actions.

---

## Use Case

User operates agent as terminal utility:
- Execute commands
- Report results
- Wait for next instruction
- No proactive behavior
- No suggestions
- No explanations
- No assumptions

Current workaround: `DEREK_RULES.md` file that agent reads at startup. Insufficient — agent still drifts.

---

## Impact

**Without Enforcement:** User must constantly correct agent behavior, managing the tool instead of using it.

**With Enforcement:** Agent becomes reliable utility, predictable and safe for automated/unsupervised operation.

---

## Contact

Derek Roberts  
derek.roberts@gmail.com  
GitHub: DerekRoberts

#!/usr/bin/env node
/**
 * Renovate Monitor - Orchestrator
 * 
 * Handles Renovate/Dependabot PR monitoring workflow:
 * 1. Scan Gmail for PR notification emails
 * 2. Check GitHub CI status
 * 3. Route to appropriate handler (delete, watch, or spawn Kilo Cloud)
 * 4. Send summary emails
 */

const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const CONFIG_FILE = path.join(__dirname, 'config.json');
const STATE_FILE = path.join(__dirname, 'state.json');
const LOG_FILE = path.join(__dirname, 'logs', `${new Date().toISOString().split('T')[0]}.log`);

let CONFIG = null;

async function loadConfig() {
  if (CONFIG) return CONFIG;
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    CONFIG = JSON.parse(data);
    return CONFIG;
  } catch (e) {
    console.error('Failed to load config.json:', e.message);
    process.exit(1);
  }
}

async function log(message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;
  console.log(line.trim());
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  await fs.appendFile(LOG_FILE, line);
}

async function loadState() {
  try {
    const data = await fs.readFile(STATE_FILE, 'utf8');
    return JSON.parse(data);
  } catch (e) {
    return { pendingPRs: [], lastRun: null };
  }
}

async function saveState(state) {
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

function runCommand(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  } catch (e) {
    log(`Command failed: ${cmd}`);
    log(`Error: ${e.stderr || e.message}`);
    return null;
  }
}

async function searchRenovateEmails() {
  const config = await loadConfig();
  
  // Search each author separately to avoid shell escaping issues with complex queries
  const allEmails = [];
  const seenIds = new Set();
  
  for (const author of config.monitoredAuthors) {
    const query = `from:${author} -in:trash`;
    log(`Searching Gmail with query: ${query}`);
    
    // gog uses positional args for query
    const result = runCommand(`gog gmail search --account ${config.gmailAccount} -j '${query}' --max=50`);
    if (!result) continue;
    
    try {
      const data = JSON.parse(result);
      const threads = data.threads || [];
      for (const thread of threads) {
        if (!seenIds.has(thread.id)) {
          seenIds.add(thread.id);
          allEmails.push(thread);
        }
      }
    } catch (e) {
      log(`Failed to parse search results for ${author}: ${e.message}`);
    }
  }
  
  log(`Found ${allEmails.length} Renovate/Dependabot emails total`);
  return allEmails;
}

async function getEmailBody(messageId) {
  const config = await loadConfig();
  // Get message details (threadId in search results is actually the message ID for first message)
  const result = runCommand(`gog gmail get --account ${config.gmailAccount} ${messageId} -j`);
  if (!result) return null;
  
  try {
    const message = JSON.parse(result);
    return {
      id: messageId,
      body: message.body || '',
      snippet: message.snippet || '',
      headers: message.headers || {}
    };
  } catch (e) {
    log(`Failed to parse message ${messageId}: ${e.message}`);
    return null;
  }
}

function extractPRInfo(emailData) {
  // Search in body and snippet for PR URL
  const textToSearch = (emailData.body || '') + ' ' + (emailData.snippet || '');
  
  // GitHub PR URLs look like: https://github.com/owner/repo/pull/123
  const prUrlMatch = textToSearch.match(/https:\/\/github\.com\/([^\/\s]+)\/([^\/\s]+)\/pull\/(\d+)/);
  if (!prUrlMatch) return null;
  
  const [, owner, repo, prNumber] = prUrlMatch;
  return {
    url: prUrlMatch[0],
    owner,
    repo,
    prNumber: parseInt(prNumber),
    fullRepo: `${owner}/${repo}`,
    messageId: emailData.id
  };
}

async function checkPRStatus(owner, repo, prNumber) {
  // Use gh CLI to check PR status
  const result = runCommand(`gh pr view ${prNumber} --repo ${owner}/${repo} --json state,statusCheckRollup,mergeStateStatus,headRefName`);
  if (!result) return null;
  
  try {
    return JSON.parse(result);
  } catch (e) {
    log(`Failed to parse PR status: ${e.message}`);
    return null;
  }
}

function parseChecks(statusCheckRollup) {
  // statusCheckRollup is an array of check runs
  const nodes = Array.isArray(statusCheckRollup) ? statusCheckRollup : [];
  if (nodes.length === 0) return { passed: false, failing: false, pending: false, total: 0, nodes: [] };
  const total = nodes.length;
  const completed = nodes.filter(n => n.status === 'COMPLETED');
  const passed = completed.filter(n => n.conclusion === 'SUCCESS').length;
  const failing = completed.filter(n => ['FAILURE', 'CANCELLED', 'TIMED_OUT'].includes(n.conclusion)).length;
  const pending = nodes.filter(n => n.status !== 'COMPLETED').length;
  
  return {
    total,
    passed,
    failing,
    pending,
    allPassed: passed === total && total > 0,
    anyFailing: failing > 0,
    anyPending: pending > 0,
    nodes
  };
}

function getPermissions(org) {
  const config = CONFIG || { readonlyOrgs: ['bcgov', 'bcgov-c', 'bcgov-nr', 'bcdevops'] };
  return config.readonlyOrgs.includes(org.toLowerCase()) ? 'read-only' : 'write';
}

async function notifyKiloCloud(prInfo, status, checkResults) {
  const permissions = getPermissions(prInfo.owner);
  const failingChecks = checkResults.nodes.filter(n => 
    n.status === 'COMPLETED' && 
    ['FAILURE', 'CANCELLED', 'TIMED_OUT'].includes(n.conclusion)
  );
  
  const config = await loadConfig();
  
  // Build email to send to Kilo Cloud (via your email for now)
  let body = `KILO CLOUD TASK: Fix Failing Renovate PR\n`;
  body += `========================================\n\n`;
  body += `Repository: ${prInfo.fullRepo}\n`;
  body += `PR: #${prInfo.prNumber}\n`;
  body += `URL: ${prInfo.url}\n`;
  body += `Branch: ${status.headRefName}\n`;
  body += `Permissions: ${permissions}\n\n`;
  
  body += `FAILING CHECKS (${failingChecks.length}):\n`;
  for (const check of failingChecks) {
    body += `  ❌ ${check.name} (${check.conclusion})\n`;
    body += `     Workflow: ${check.workflowName || 'N/A'}\n`;
    body += `     Details: ${check.detailsUrl}\n\n`;
  }
  
  if (permissions === 'write') {
    body += `\nINSTRUCTION: Checkout branch ${status.headRefName}, fix the failing checks, and push commits.\n`;
  } else {
    body += `\nINSTRUCTION: Analyze the failing checks and provide detailed fix instructions.\n`;
    body += `Note: This is a work repo (${prInfo.owner}) - direct commits are not permitted.\n`;
  }
  
  log(`Sending Kilo Cloud notification for ${prInfo.fullRepo}#${prInfo.prNumber}`);
  
  // Send to your email (you can forward to Kilo Cloud or configure auto-routing)
  const subject = `[KILO CLOUD TASK] Fix ${prInfo.fullRepo}#${prInfo.prNumber} (${failingChecks.length} failing checks)`;
  const cmd = `gog gmail send --account ${config.gmailAccount} --to ${config.summaryEmailTo} --subject "${subject}" --body "${body}"`;
  const result = runCommand(cmd);
  
  if (result) {
    log(`Kilo Cloud notification sent for ${prInfo.url}`);
    return { success: true, output: 'Notification email sent' };
  } else {
    log(`Failed to send Kilo Cloud notification for ${prInfo.url}`);
    return { success: false, error: 'Email send failed' };
  }
}

async function deleteEmail(messageId) {
  const config = await loadConfig();
  log(`Deleting message ${messageId}`);
  runCommand(`gog gmail messages modify --account ${config.gmailAccount} ${messageId} --add TRASH --remove INBOX`);
}

async function sendSummaryEmail(results) {
  const config = await loadConfig();
  const now = new Date().toISOString();
  
  let body = `Renovate Monitor Summary - ${now}\n`;
  body += `========================================\n\n`;
  
  body += `RESOLVED (deleted emails): ${results.resolved.length}\n`;
  for (const r of results.resolved) {
    body += `  ✓ ${r.fullRepo}#${r.prNumber}\n`;
  }
  body += `\n`;
  
  body += `HANDED TO KILO CLOUD: ${results.assignedToKilo.length}\n`;
  for (const r of results.assignedToKilo) {
    body += `  → ${r.fullRepo}#${r.prNumber} (${r.permissions})\n`;
  }
  body += `\n`;
  
  body += `STILL PENDING (will re-check): ${results.pending.length}\n`;
  for (const r of results.pending) {
    body += `  ⏳ ${r.fullRepo}#${r.prNumber}\n`;
  }
  body += `\n`;
  
  body += `ESCALATIONS (Kilo Cloud failed): ${results.escalations.length}\n`;
  for (const r of results.escalations) {
    body += `  ⚠ ${r.fullRepo}#${r.prNumber}: ${r.error}\n`;
  }
  
  log(`Sending summary email to ${config.summaryEmailTo}`);
  
  const subject = `Renovate Monitor: ${results.resolved.length} resolved, ${results.assignedToKilo.length} with Kilo Cloud`;
  const cmd = `gog gmail send --account ${config.gmailAccount} --to ${config.summaryEmailTo} --subject "${subject}" --body "${body}"`;
  runCommand(cmd);
}

async function morningSweep() {
  log('=== MORNING SWEEP (6:30 AM) ===');
  
  const emails = await searchRenovateEmails();
  const state = await loadState();
  const results = {
    resolved: [],
    assignedToKilo: [],
    pending: [],
    escalations: []
  };
  
  // Clear old pending PRs (we'll re-evaluate everything fresh)
  state.pendingPRs = [];
  
  for (const email of emails) {
    const emailData = await getEmailBody(email.id);
    if (!emailData) continue;
    
    const prInfo = extractPRInfo(emailData);
    if (!prInfo) {
      log(`Could not extract PR info from email ${email.id}`);
      continue;
    }
    
    // Store message ID for later operations
    prInfo.messageId = email.id;
    
    log(`Checking ${prInfo.fullRepo}#${prInfo.prNumber}`);
    
    const prStatus = await checkPRStatus(prInfo.owner, prInfo.repo, prInfo.prNumber);
    if (!prStatus) {
      log(`Could not get PR status for ${prInfo.fullRepo}#${prInfo.prNumber}`);
      continue;
    }
    
    const checkResults = parseChecks(prStatus.statusCheckRollup);
    
    if (checkResults.allPassed) {
      // All checks passed - delete email
      await deleteEmail(email.id);
      results.resolved.push(prInfo);
      log(`All checks passed - deleted email for ${prInfo.fullRepo}#${prInfo.prNumber}`);
    } else if (checkResults.anyFailing) {
      // Has failing checks - will hand to Kilo Cloud in follow-up
      state.pendingPRs.push({
        ...prInfo,
        addedAt: new Date().toISOString(),
        status: 'failing',
        checkResults
      });
      log(`Has failing checks - queued for Kilo Cloud: ${prInfo.fullRepo}#${prInfo.prNumber}`);
    } else if (checkResults.anyPending) {
      // Still pending - watch and re-check
      state.pendingPRs.push({
        ...prInfo,
        addedAt: new Date().toISOString(),
        status: 'pending',
        checkResults
      });
      log(`Checks pending - will re-check: ${prInfo.fullRepo}#${prInfo.prNumber}`);
    }
  }
  
  state.lastRun = new Date().toISOString();
  await saveState(state);
  
  log(`Morning sweep complete: ${results.resolved.length} resolved, ${state.pendingPRs.length} pending`);
  return { state, results };
}

async function followUpCheck() {
  log('=== FOLLOW-UP CHECK (7:30 AM) ===');
  
  const state = await loadState();
  const results = {
    resolved: [],
    assignedToKilo: [],
    pending: [],
    escalations: []
  };
  
  const remainingPRs = [];
  
  for (const pr of state.pendingPRs) {
    log(`Re-checking ${pr.fullRepo}#${pr.prNumber}`);
    
    const prStatus = await checkPRStatus(pr.owner, pr.repo, pr.prNumber);
    if (!prStatus) {
      log(`Could not get PR status for ${pr.fullRepo}#${pr.prNumber}`);
      remainingPRs.push(pr);
      continue;
    }
    
    const checkResults = parseChecks(prStatus.statusCheckRollup);
    
    if (checkResults.allPassed) {
      // Now passing - delete email
      await deleteEmail(pr.messageId);
      results.resolved.push(pr);
      log(`Now passing - deleted email for ${pr.fullRepo}#${pr.prNumber}`);
    } else if (checkResults.anyPending) {
      // Still pending - keep watching
      remainingPRs.push(pr);
      results.pending.push(pr);
      log(`Still pending - keeping in watch list: ${pr.fullRepo}#${pr.prNumber}`);
    } else if (checkResults.anyFailing) {
      // Failing - notify Kilo Cloud
      const kiloResult = await notifyKiloCloud(pr, prStatus, checkResults);
      if (kiloResult.success) {
        results.assignedToKilo.push({
          ...pr,
          permissions: getPermissions(pr.owner),
          kiloOutput: kiloResult.output
        });
        // Keep email for now - will delete after Kilo Cloud reports back
        remainingPRs.push({ ...pr, status: 'with_kilo', kiloSpawnedAt: new Date().toISOString() });
      } else {
        results.escalations.push({ ...pr, error: 'Kilo Cloud spawn failed' });
        remainingPRs.push(pr);
      }
    }
  }
  
  state.pendingPRs = remainingPRs;
  state.lastRun = new Date().toISOString();
  await saveState(state);
  
  // Send summary email
  await sendSummaryEmail(results);
  
  log(`Follow-up complete: ${results.resolved.length} resolved, ${results.assignedToKilo.length} with Kilo, ${results.pending.length} still pending, ${results.escalations.length} escalations`);
  return { state, results };
}

async function main() {
  const args = process.argv.slice(2);
  const mode = args[0] || 'sweep';
  
  // Load config early
  await loadConfig();
  
  await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
  
  if (mode === 'sweep') {
    await morningSweep();
  } else if (mode === 'followup') {
    await followUpCheck();
  } else if (mode === 'full') {
    await morningSweep();
    // In real cron, follow-up runs separately after 1 hour
    // For testing, we can run both
    log('Waiting 5 seconds before follow-up (test mode)...');
    await new Promise(r => setTimeout(r, 5000));
    await followUpCheck();
  } else {
    log(`Unknown mode: ${mode}. Use 'sweep', 'followup', or 'full'`);
    process.exit(1);
  }
}

main().catch(e => {
  log(`Fatal error: ${e.message}`);
  console.error(e);
  process.exit(1);
});

// Sends the open tasks to a Telegram chat every morning.
//   node scripts/daily-digest.mjs        -> keep running, send once a day at DIGEST_TIME
//   node scripts/daily-digest.mjs --now  -> send immediately and exit
import { readFileSync, writeFileSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import { Client, Databases, Query, Users } from 'node-appwrite';

const env = (name) => {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
};

const DATABASE_ID = env('NEXT_PUBLIC_APPWRITE_DATABASE_ID');
const APP_URL = env('NEXT_PUBLIC_APP_BASE_URL');
const BOT_TOKEN = env('TELEGRAM_BOT_TOKEN');
const CHAT_ID = env('TELEGRAM_CHAT_ID');
const DIGEST_TIME = process.env.DIGEST_TIME || '07:00';
const STATE_FILE = process.env.DIGEST_STATE_FILE || '.digest-last-sent';

if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(DIGEST_TIME)) throw new Error(`DIGEST_TIME must be HH:MM (24h), got "${DIGEST_TIME}"`);

const client = new Client()
  .setEndpoint(env('NEXT_PUBLIC_APPWRITE_ENDPOINT'))
  .setProject(env('NEXT_PUBLIC_APPWRITE_PROJECT'))
  .setKey(env('NEXT_APPWRITE_KEY'));
const databases = new Databases(client);
const users = new Users(client);

// Dates are compared and shown in the TZ of the process (set by docker-compose.yml).
const dayKey = (date) => date.toLocaleDateString('en-CA'); // YYYY-MM-DD
const escapeHtml = (text) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Appwrite returns 25 rows by default, so page through everything.
async function listAll(fetchPage, key) {
  const items = [];
  for (;;) {
    const cursor = items.length ? [Query.cursorAfter(items.at(-1).$id)] : [];
    const page = (await fetchPage([Query.limit(100), ...cursor]))[key];
    items.push(...page);
    if (page.length < 100) return items;
  }
}

const listDocuments = (collection, filters = []) =>
  listAll((page) => databases.listDocuments(DATABASE_ID, env(collection), [...filters, ...page]), 'documents');

async function buildDigest(now) {
  const [tasks, projects, members, accounts] = await Promise.all([
    listDocuments('NEXT_PUBLIC_APPWRITE_TASKS_ID', [Query.notEqual('status', 'DONE')]),
    listDocuments('NEXT_PUBLIC_APPWRITE_PROJECTS_ID'),
    listDocuments('NEXT_PUBLIC_APPWRITE_MEMBERS_ID'),
    listAll((page) => users.list(page), 'users'),
  ]);

  const projectNames = new Map(projects.map((project) => [project.$id, project.name]));
  const userNames = new Map(accounts.map((user) => [user.$id, user.name]));
  const memberNames = new Map(members.map((member) => [member.$id, userNames.get(member.userId)]));

  const today = dayKey(now);
  const rows = tasks
    .map((task) => ({
      ...task,
      due: dayKey(new Date(task.dueDate)),
      assignee: memberNames.get(task.assigneeId) || 'Unassigned',
      project: projectNames.get(task.projectId) || 'No project',
    }))
    .sort((a, b) => a.due.localeCompare(b.due));

  const line = (task, showAssignee) => {
    const dueDate = new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
    const due = task.due < today ? `⚠️ overdue (${dueDate})` : task.due === today ? '⏰ due today' : `due ${dueDate}`;
    const url = `${APP_URL}/workspaces/${task.workspaceId}/tasks/${task.$id}`;
    const details = [showAssignee && task.assignee, task.project, task.status.replace('_', ' ').toLowerCase(), due].filter(Boolean);
    return `• <a href="${escapeHtml(url)}">${escapeHtml(task.name)}</a> — ${escapeHtml(details.join(' · '))}`;
  };

  const high = rows.filter((task) => task.priority === 'HIGH');
  const others = rows.filter((task) => task.priority !== 'HIGH');
  const overdue = rows.filter((task) => task.due < today);

  const lines = [
    `📋 <b>Pending tasks — ${now.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</b>`,
    rows.length
      ? `${rows.length} open · ${high.length} high priority · ${overdue.length} overdue`
      : '✅ Nothing pending. All tasks are done.',
  ];

  if (high.length) lines.push('', `🔴 <b>High priority (${high.length})</b>`, ...high.map((task) => line(task, true)));

  for (const [assignee, list] of [...Map.groupBy(others, (task) => task.assignee)].sort(([a], [b]) => a.localeCompare(b))) {
    lines.push('', `👤 <b>${escapeHtml(assignee)} (${list.length})</b>`, ...list.map((task) => line(task, false)));
  }

  return lines;
}

// Telegram allows 4096 characters per message. Split on line breaks so HTML tags stay intact.
function splitMessages(lines) {
  const messages = [''];
  for (const text of lines) {
    if (messages.at(-1).length + text.length + 1 > 4096) messages.push('');
    messages[messages.length - 1] += `${text}\n`;
  }
  return messages;
}

async function sendDigest(now) {
  for (const text of splitMessages(await buildDigest(now))) {
    const response = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: CHAT_ID, text, parse_mode: 'HTML', link_preview_options: { is_disabled: true } }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`Telegram ${response.status}: ${await response.text()}`);
  }
  console.log(`[${now.toISOString()}] Digest sent.`);
}

function lastSent() {
  try {
    return readFileSync(STATE_FILE, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return '';
    throw error;
  }
}

if (process.argv.includes('--now')) {
  await sendDigest(new Date());
} else {
  console.log(`Digest scheduled daily at ${DIGEST_TIME} (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`);
  // Check every minute rather than waiting for an exact moment: if the PC was off or offline
  // at DIGEST_TIME, the digest goes out as soon as it is back, and never twice in one day.
  let sentOn = lastSent();
  for (;;) {
    const now = new Date();
    const time = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    if (time >= DIGEST_TIME && sentOn !== dayKey(now)) {
      try {
        await sendDigest(now);
        sentOn = dayKey(now); // set first, so an unwritable state file cannot cause a resend every minute
        writeFileSync(STATE_FILE, sentOn);
      } catch (error) {
        console.error(`[${now.toISOString()}] Digest failed, retrying in a minute:`, error.message, error.cause?.message ?? '');
      }
    }
    await sleep(60_000);
  }
}

/**
 * Email a reminder listing past sessions that are still unmarked.
 *
 * env: GITHUB_TOKEN, DATA_REPO, GMAIL_USER, GMAIL_APP_PASSWORD, NOTIFY_TO (defaults to GMAIL_USER),
 *      DRY_RUN=1 (print instead of sending)
 */
import nodemailer from 'nodemailer';
import { addMonths, fmtDateTime, monthKey, monthsInRange } from '../src/lib/dates';
import { pendingSessions } from '../src/lib/merge';
import { UNASSIGNED } from '../src/lib/types';
import { loadSettings, requireEnv, storeFromEnv } from './env';

async function main() {
  const store = storeFromEnv();
  const settings = await loadSettings(store);
  const tz = settings.timezone;
  const thisMonth = monthKey(new Date().toISOString(), tz);
  const sessions = await store.loadMonths(monthsInRange(addMonths(thisMonth, -3), thisMonth));
  const pending = pendingSessions(sessions, new Date(), settings.reminderAfterHours);
  const unassigned = sessions.filter((s) => s.status === 'done' && s.coordinator === UNASSIGNED);

  if (!pending.length && !unassigned.length) {
    console.log('Nothing to remind about.');
    return;
  }

  const link = settings.appUrl ? `${settings.appUrl.replace(/\/$/, '')}/#/inbox` : '';
  const rows = pending
    .map(
      (s) =>
        `<tr><td style="padding:4px 12px 4px 0">${fmtDateTime(s.scheduledStart, tz)}</td>` +
        `<td style="padding:4px 12px 4px 0">${s.type}</td><td style="padding:4px 12px 4px 0">${s.coordinator}</td>` +
        `<td style="padding:4px 0">${escapeHtml(s.title)}</td></tr>`,
    )
    .join('');
  const subject = pending.length
    ? `SCount: ${pending.length} session${pending.length > 1 ? 's' : ''} waiting to be marked`
    : `SCount: ${unassigned.length} session(s) need a coordinator`;
  const html = `
    <div style="font-family:system-ui,sans-serif;font-size:14px;color:#222">
      <p>Hi Nishad,</p>
      ${pending.length ? `<p>These sessions have ended but aren't marked yet (done / rescheduled / cancelled):</p>
      <table style="border-collapse:collapse">${rows}</table>` : ''}
      ${unassigned.length ? `<p>${unassigned.length} completed session(s) have no coordinator assigned.</p>` : ''}
      ${link ? `<p><a href="${link}" style="background:#4f46e5;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none">Open SCount</a></p>` : ''}
    </div>`;

  if (process.env.DRY_RUN) {
    console.log(subject);
    for (const s of pending) console.log(`  ${fmtDateTime(s.scheduledStart, tz)} ${s.type} ${s.title}`);
    return;
  }

  const user = requireEnv('GMAIL_USER');
  const transport = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass: requireEnv('GMAIL_APP_PASSWORD') },
  });
  await transport.sendMail({ from: `SCount <${user}>`, to: process.env.NOTIFY_TO || user, subject, html });
  console.log(`Sent: ${subject}`);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

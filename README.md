# SCount: teaching session counter

Tracks Google Meet teaching sessions from Google Calendar, turns them into **counts** and works out the payout.

| Session length | Count |
|---|---|
| under 45 min | 1 |
| 45 min to under 1h 15m | 2 |
| 1h 15m or more | 3 (maximum) |

**Payout:** counts × ₹300 = gross, minus 10% TDS = net. Both the rate and the TDS % can be changed in Settings.

## How it works

```
Google Calendar ──(secret iCal link)──► GitHub Action in br_scount_data (private)
                                          • syncs sessions every 3 hours
                                          • emails you at 9 pm IST if sessions are unmarked
                                          ▼
                               data/sessions/YYYY-MM.json  (private repo)
                                          ▲
                        GitHub API + your token (kept only in your browser)
                                          │
br_scount (this repo, public) ── GitHub Pages ──► the web app
```

- **This repo (`br_scount`) is public and holds no personal data.** It contains only the app code.
- **Your data lives in a separate private repo (`br_scount_data`).** The app reads and writes it with a fine-grained token that stays in your browser's local storage. Without the token, the public site shows nothing.

### Features
- **To mark**: every past calendar session still waiting for a status. Choose *Done as scheduled*, *Done with a different time or a direct count*, *Rescheduled* or *Cancelled*. Pick or change the coordinator.
- **+ Add session**: add a session that was never put on the calendar.
- **Month**: every session in the month with totals. Click a row to edit it.
- **Reports**: filter by month range (This month, Last month, Last 3 months, This FY), type, coordinator (Rubeena, Sajitha…), status and source. Shows gross, TDS and net, with breakdowns, a monthly chart, CSV export and Print/PDF.
- **Reminders**: a daily email from GitHub Actions, plus browser notifications and a tab badge while the app is open.
- **Calendar changes**: if a session's time changes or it moves to another day, the sync updates it and keeps whatever you already marked. A deleted event is dropped if it was still unmarked. If it was already marked, it stays and is flagged "removed from calendar".

### How sessions are recognised
- **Type**: an event is a teaching session when its title contains `review`, `mentor` or `lectur`. Other events (dentist, personal) are ignored. You can edit the keywords in Settings.
- **Coordinator**: matched by the organizer's or a guest's email, which you add per coordinator in Settings. Failing that, by the name appearing in the guest list, the title or the description. If nothing matches, the session shows as *Unassigned* and you pick the coordinator when you mark it.

---

## One-time setup (about 15 minutes)

### 1. Publish the app (public repo)
1. Public repo: <https://github.com/nishadshanid/br_scount>. Push this folder to it.
2. Repo → **Settings → Pages → Source: GitHub Actions**.
3. The *Deploy app to GitHub Pages* workflow runs on every push. The app is then at <https://nishadshanid.github.io/br_scount/>.

### 2. Create the private data repo
1. Private repo: <https://github.com/nishadshanid/br_scount_data> (default branch `main`).
2. Copy everything from `templates/data-repo/` into it, including the hidden `.github` folder:
   ```sh
   git clone https://github.com/nishadshanid/br_scount_data.git
   cp -r templates/data-repo/. br_scount_data/
   cd br_scount_data && git add -A && git commit -m "Initial setup" && git push
   ```
3. The workflow checks out `nishadshanid/br_scount` by default. If the app repo is ever renamed, add an Actions **variable** `APP_REPO` = `<owner>/<name>` in `br_scount_data`.

### 3. Connect Google Calendar (read-only, no Google Cloud setup)
1. Open Google Calendar (logged in as nishadshanid4@gmail.com) → ⚙ **Settings** → under *Settings for my calendars*, click your calendar.
2. Scroll to **Integrate calendar** → copy **Secret address in iCal format**.
3. In `br_scount_data` → Settings → Secrets and variables → Actions → **New repository secret**: `GCAL_ICAL_URL` = that link.

> The secret address gives read-only access to your calendar. Store it only as a GitHub secret. If it ever leaks, use *Reset* next to it in Google Calendar.

### 4. Email reminders (Gmail)
1. Turn on 2-Step Verification on the Google account → <https://myaccount.google.com/apppasswords> → create an app password named "SCount".
2. Add these secrets to `br_scount_data`:
   - `GMAIL_USER` = `nishadshanid4@gmail.com`
   - `GMAIL_APP_PASSWORD` = the 16-character app password
   - `NOTIFY_TO` (optional) = where to send reminders. Defaults to `GMAIL_USER`.

### 5. Create the token for the app
1. GitHub → Settings → Developer settings → **Fine-grained tokens → Generate new token**.
2. Set these options:
   - **Repository access**: *Only select repositories* → `br_scount_data`
   - **Permissions**: *Contents*: Read and write; *Actions*: Read and write
   - Expiry: up to 1 year. Set a reminder to renew it.
3. Open the app → **Settings** → enter `nishadshanid/br_scount_data` and the token → **Save & connect**.
4. Still in Settings:
   - add Rubeena's and Sajitha's emails (the ones they send invites from)
   - check the app link, then press **Save settings**
   - press **Enable** under browser notifications
5. Press **Sync now**. After about a minute press **Refresh**, and your sessions appear.

### 6. Test the reminder email
Go to `br_scount_data` → Actions → *Sync calendar & remind* → **Run workflow** → tick *Also send the reminder email*. You'll only get an email if a past session is still unmarked.

---

## Development

```sh
npm install
npm run dev        # app at http://localhost:5173
npm test           # unit tests (count rule, payout, calendar parsing, merge)
npm run build
```

Run the scripts locally against your data repo:

```sh
GITHUB_TOKEN=<token> DATA_REPO=nishadshanid/br_scount_data GCAL_ICAL_URL='<secret ical url>' DRY_RUN=1 npm run sync
GITHUB_TOKEN=<token> DATA_REPO=nishadshanid/br_scount_data DRY_RUN=1 npm run remind
```

`ICS_FILE=path/to/file.ics` can be used in place of `GCAL_ICAL_URL`. `DRY_RUN=1` prints the result instead of writing data or sending email.

### Code map
- `src/lib/count.ts`: the 30/45/75-minute count rule
- `src/lib/payout.ts`: gross / TDS / net
- `src/lib/classify.ts`: session type and coordinator detection
- `src/lib/merge.ts`: merges calendar events into stored sessions without losing what you marked
- `src/lib/github.ts`: JSON storage on the GitHub Contents API (shared by the app and the scripts)
- `scripts/sync.ts`, `scripts/remind.ts`: run by the Action in `br_scount_data`
- `templates/data-repo/`: starter files for the private repo

### Notes
- GitHub pauses scheduled workflows in repos with no activity for 60 days. The sync commits normally keep the repo active. If the schedule is ever paused, re-enable it from the Actions tab.
- Sessions are grouped into months in IST (`timezone` in settings).

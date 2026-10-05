# br_scount_data (PRIVATE)

Private storage for SCount. Keep this repository **private**.

- `data/settings.json`: rate, TDS, coordinators, type keywords
- `data/sessions/YYYY-MM.json`: one file per month, edited by the app and the sync job
- `.github/workflows/sync-remind.yml`: calendar sync every 3 hours plus a daily reminder email

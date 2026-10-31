# NFL Wins & Losses Pool

A small website that tracks the pool. It's plain HTML, CSS and JavaScript with no build step, so it runs on GitHub Pages as is.

## Editing picks

Edit **`picks.txt`**. It's the only file you need to change by hand. Instructions are at the top of the file:

```
Matt:
Vikings wins
Giants losses
```

Put each name on its own line ending with a colon. Under it, list the picks in draft order: the first line is Round 1, the second is Round 2, and so on. If you mistype a team, the website shows a red box saying which line is wrong.

## Turning on the website (one time)

1. On GitHub, open the repo and go to **Settings → Pages**.
2. Under "Build and deployment", set **Source** to *Deploy from a branch*. Pick the `main` branch and the `/ (root)` folder, then click **Save**.
3. After a minute or two, the site is live at `https://<your-username>.github.io/<repo-name>/`.

## How scores update

- **Usually:** each time someone opens the page, their browser asks ESPN for the latest scores. While the page is open, it asks again every 5 minutes.
- **Backup:** if ESPN doesn't answer, the page falls back to `data/scores.json`, a saved copy in the repo. A GitHub Action (`.github/workflows/update-scores.yml`) refreshes that copy every 3 hours.

The line at the top of the page shows when the scores were last updated and which source they came from.

## If it stops working

1. **Open the site and read the line at the top.**
   - "live from ESPN" means everything is fine.
   - "from the saved copy" means ESPN isn't answering the browser right now, but the backup still works. Check that the time shown is recent.
   - "Couldn't load any scores" means both sources failed. Continue with step 2.
2. **Check the backup job:** go to the repo's **Actions** tab, then **Update scores**.
   - A red ✗ on recent runs means the job failed. Click a run to see the error.
   - If GitHub shows a banner saying the workflow was disabled, click **Enable workflow**. GitHub turns scheduled jobs off after 60 days with no activity in the repo, which can happen in the offseason.
   - To update right away, click **Run workflow**.
3. **If ESPN changed its API** and both sources fail, the code that reads ESPN's data is in `js/espn.js`. That file is where a fix would go.

## Files

| File | What it is |
| --- | --- |
| `picks.txt` | Everyone's picks (**edit this**) |
| `index.html`, `css/style.css`, `js/app.js` | The web page |
| `js/espn.js` | Downloads and simplifies ESPN scores (used by the page and the Action) |
| `js/teams.js` | The 32 teams and the names you can use for them |
| `data/scores.json` | Backup copy of scores, written by the Action |
| `scripts/update-scores.js` | Script the Action runs |
| `.github/workflows/update-scores.yml` | The Action's schedule |

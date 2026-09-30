# Prize photos

This folder holds the prize catalog: photos of musicians (or anything else) that get awarded automatically as a random surprise when a streak milestone is hit. She never edits this — it's managed here, in the repo.

## The two tiers

Every on-time day, the app checks the current streak length against these tiers, from most to least significant, and awards a prize from the **highest** one that matches (so day 30, a multiple of both 3 and 30, gets a high-tier prize):

| Folder | Awarded every... |
|---|---|
| `low/` | 3 or 7 days |
| `high/` | 30 or 180 days (~6 months) |

## Adding a prize

1. Drop an image file into the right tier folder (e.g. `low/freddie-mercury.jpg`). Keep it reasonably small (a few hundred KB — these are served directly, not resized by the app).
2. Add an entry to `manifest.json` under that tier's `prizes` array:
   ```json
   { "file": "low/freddie-mercury.jpg", "title": "פרדי מרקורי" }
   ```
3. Commit, push, and **bump `CACHE_NAME` in `sw.js` and `APP_VERSION` in `js/version.js`** like any other change — the manifest and images are cached offline the same as the rest of the app, so a new prize won't show up on her phone until that happens.

When a tier's milestone is hit, one prize from that tier's list is picked at random. The `placeholder.jpg` entries are stand-ins — replace them (or add alongside them and delete the placeholder) with real photos whenever you like.

The app keeps a permanent history of which prize was awarded on which day (visible on the Prizes tab), so it's fine for the same photo to be picked again another time — nothing here needs to stay unique.

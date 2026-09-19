# Prize photos

This folder holds the prize catalog: photos of musicians (or anything else) that get awarded automatically as a random surprise when a streak milestone is hit. She never edits this — it's managed here, in the repo.

## The four tiers

Every on-time day, the app checks the current streak length against these tiers, from most to least significant, and awards a prize from the **highest** one that matches (so a day that happens to be both a multiple of 3 and of 7, for instance, gets the tier-2 prize, not tier-1):

| Folder | Awarded every... |
|---|---|
| `tier1/` | 3 days |
| `tier2/` | 7 days |
| `tier3/` | 30 days |
| `tier4/` | 180 days (~6 months) |

## Adding a prize

1. Drop an image file into the right tier folder (e.g. `tier2/freddie-mercury.jpg`). Keep it reasonably small (a few hundred KB — these are served directly, not resized by the app).
2. Add an entry to `manifest.json` under that tier's `prizes` array:
   ```json
   { "file": "tier2/freddie-mercury.jpg", "title": "פרדי מרקורי" }
   ```
3. Commit, push, and **bump `CACHE_NAME` in `sw.js` and `APP_VERSION` in `js/version.js`** like any other change — the manifest and images are cached offline the same as the rest of the app, so a new prize won't show up on her phone until that happens.

When a tier's milestone is hit, one prize from that tier's list is picked at random. The `placeholder.jpg` entries are stand-ins — replace them (or add alongside them and delete the placeholder) with real photos whenever you like.

The app keeps a permanent history of which prize was awarded on which day (visible on the Prizes tab), so it's fine for the same photo to be picked again another time — nothing here needs to stay unique.

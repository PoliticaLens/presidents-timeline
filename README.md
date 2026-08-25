# American Ledger — Presidents Timeline
 
An interactive timeline of the U.S. presidents: full lifespan, military
service, civilian career, elected/appointed offices, and the presidency
itself, all layered on one line per person. Wars run behind everyone as
background bands; shared moments show as small diamonds on the rows of
everyone who was there.
 
## Structure
 
```
index.html            the page shell (markup only)
style.css              all styling, incl. light/dark mode variables
script.js               the rendering engine — no content, just logic
data/
  presidents.json      one entry per president: life, terms, positions, etc.
  wars.json             background war bands
  events.json            shared-moment diamonds
  parties.json          party name → color
  pos-labels.json        position-type → display label
```
 
The idea: **script.js and style.css are the reusable engine** — you
shouldn't need to touch them to add a president, correct a date, or add a
war. All of that lives in `data/*.json`, which is plain JSON any GitHub web
editor (or a text editor) can open directly.
 
When you get to the House/Senate version, the plan is to reuse `script.js`
and `style.css` as-is and just point them at a different set of JSON files.
 
## Important: this needs to be served, not opened directly
 
`index.html` loads its data with `fetch()`, which browsers block on
`file://` URLs (double-clicking the file locally will show a load error).
Two ways to view it:
 
**GitHub Pages** (recommended, matches your RCV simulator setup):
1. Push this folder to a GitHub repo (a new one, or a folder inside
   PoliticaLens if you'd rather keep it there).
2. Repo Settings → Pages → set the source branch (e.g. `main`) and folder
   (`/` root, or `/docs` if you put it there).
3. GitHub gives you a URL like `https://<org>.github.io/<repo>/`.
**Locally, without GitHub**, from a terminal in this folder:
```
python3 -m http.server 8000
```
then open `http://localhost:8000` in a browser.
 
## Editing data
 
Every file in `data/` is plain JSON — quoted keys, no comments, no trailing
commas. The easiest way to add or correct a president is to edit
`data/presidents.json` directly in GitHub's web editor and commit; GitHub
Pages will pick up the change on the next visit.
 
Each president entry looks like:
 
```json
{
  "num": [1],
  "name": "George Washington",
  "party": "Unaffiliated",
  "born": "1732-02-22",
  "died": "1799-12-14",
  "terms": [{ "start": "1789-04-30", "end": "1797-03-04" }],
  "positions": [
    { "type": "military", "label": "Commander-in-Chief, Continental Army", "start": "1775-06-15", "end": "1783-12-23" }
  ],
  "career": ["Free-text bullets shown in the tooltip"],
  "accomplishments": ["Bullets shown under Presidency highlights"]
}
```
 
`positions[].type` must be one of: `military`, `career`, `elected-federal`,
`elected-state`, `appointed` — these map to the lane colors defined in
`data/parties.json` (party colors) and the CSS variables in `style.css`
(`--mil-color`, `--career-color`, `--fed-color`, `--state-color`,
`--appt-color`).
 
`party` must match a key in `data/parties.json`.
 
Dates are `"YYYY-MM-DD"`. A `null` for `died` means still living; a `null`
for a term's `end` means still in office.
 

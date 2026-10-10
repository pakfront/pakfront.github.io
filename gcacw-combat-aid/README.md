# GCACW Combat Aid

A dependency-free static web application containing the combat worksheet and visual flanking/ZOC calculator.

## Open in VS Code

1. Extract the ZIP.
2. Open the `gcacw-combat-aid` folder in VS Code.
3. Start a local web server using either:
   - the VS Code **Live Server** extension; or
   - `python3 -m http.server 8000` in the project folder.
4. If using Python, open <http://localhost:8000>.

No package installation or build step is required.

## Project files

- `index.html` — interface markup
- `styles.css` — responsive layout and map styling
- `app.js` — combat calculations and UI behavior
- `flank-rules.js` — ZOC and flank-attack rules engine

Worksheet selections are saved in the browser's local storage.

Click **Share worksheet**, then **Copy link**, and paste the link into Discord or
another chat. Opening it loads all combat inputs, defender rows, and flank hexes
(including terrain, units, ZOC, and hexside settings). The link is a snapshot;
later edits need a new link. Shared values take precedence over the recipient's
saved worksheet and are saved locally like other edits.

Use the hosted website when sharing with another player. A `file://` or
`localhost` link only works on your own computer. Values are compactly encoded
in the URL fragment; no account or server storage is needed.

## Export for GitHub Pages

Run `./export_site.sh` from WSL/Linux to replace
`../pakfront.github.io/gcacw-combat-aid/` with the committed site files from
`HEAD` and a `version.txt` identifying the exported revision. Uncommitted site
changes are excluded with a warning.

Use `./export_site.sh <git-ref>` to export another revision, or
`PAGES_DIR=/path/to/pages ./export_site.sh` to choose another Pages repository.
The script does not commit or push; review the exported folder before publishing.

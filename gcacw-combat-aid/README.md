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

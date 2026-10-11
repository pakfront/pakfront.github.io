# Kriegsspiel map room

Open `index.html` in a current desktop browser. No installation or server is required. The exported app includes `default-map.js`, an embedded copy of the local JPEG that allows PNG/PDF export and scenario saving when opened directly from disk. Both export scripts generate it from `fake-pea-ridge-map.jpg`. In a source checkout without that generated file, use **Import map** to select the JPEG before publishing or saving.

Dark mode is the default. The header switch remembers your preference when browser local storage is available. Map colors and publications are independent of the interface theme.

## Information views

The tree organizes information audiences, independently of military organization:

```text
Game                         universal information
├── Truth                    private truth objects
├── Red                      information shared with Red descendants
│   ├── Northern sector      information shared with this subgroup
│   │   ├── Commander A
│   │   └── Commander B
│   └── Commander C
└── Blue
    └── Commander D
```

Each object belongs to one view. A selected view shows its own objects and those owned by every ancestor. Commander A sees Game, Red, Northern sector, and A; Truth sees Game and Truth. Siblings and descendants do not contribute information. Root objects appear everywhere; put truth-only information in Truth.

Groups can contain groups and commanders. Commanders are leaves. Red and Blue are ordinary named groups; counter side colors are independent of group ownership. Game and Truth stay in place.

Select a view in the tree to work with it. Expand or collapse its rows using the arrows. Its owned objects also appear in the tree, and the right-hand roster separates **Owned here** from **Inherited** objects. Select an object from the map, tree, or roster to inspect it. Inherited objects show their owner and are read-only; **Edit at owner** selects that owner so a change updates every descendant draft. There are no local visibility overrides.

Use **Add group**, **Add commander view**, and **View name** to organize views. When a commander or Truth is selected, additions go beneath its parent. A view can be deleted only after its children and owned objects have been removed. Undo restores changes during the current session.

## Order of battle and operational command

The **Workspace** selector switches between Information views, Order of battle, Operational command, and Commanders. Military selection is independent of the active map view, which is shown in the military editor.

The OOB holds permanent membership: **force → formations → units**. A formation can contain other formations and units; a unit is a leaf. Echelon is a free-text label, so you can use division, brigade, regiment, battery, or another level without imposing a fixed military hierarchy. Add, rename, and edit these records through the military sidebar. The starter scenario links the sample truth units to Red and Blue division records.

Operational command uses the **same military records**, with one operational parent per unit or formation. By default, each record follows its OOB parent. In Operational command, drag a record onto a formation or use **Attach operationally** to establish an explicit temporary attachment. Its OOB membership remains unchanged. **Follow OOB parent** removes the override. Both OOB and operational paths are shown, and explicit attachments are labeled in the tree.

Moving a formation carries its subordinates that follow it; explicit attachments retain their specified destinations. Moves within either military tree are confined to the same force. Cycles are rejected, including cycles caused by the combination of defaults and explicit attachments. Force roots stay at the top. Operational assignments currently describe organization only; they do not deliver orders or simulate command delays.

**Commanders** has its own workspace for creating, renaming, and deleting people and editing their private notes. Its command-assignment and information-view lists link directly to the relevant editors. A `!` beside the commander indicates multiple military command assignments; hover for the list. Assignment selectors remain in the OOB/operational editors and in information views, where **Commander identity** links a view to a person. A person can hold several assignments or have several views. Replacing a commander, moving a military unit, or changing an attachment does not move information views or change information inheritance. Names of people, military records, and information views are independently editable.

Map counters and markers can refer to a military record through **Represents military record**. A truth counter and several independent reports can represent the same unit; copying an object preserves this private link. The link does not update labels, estimates, side colors, or coordinates from truth. Gameplay markers may remain unlinked. A formation's **Place truth counter** action creates an HQ counter; a unit's action uses its unit kind. The **Map representations** list navigates to linked objects at their owners.

Military records and commander identities are private umpire information and are excluded from published snapshots and exports. Records with subordinates, operational attachments, or map references cannot be deleted until those references are removed. Commanders with assignments or linked views must be unassigned before deletion. Military edits and attachments support Undo and portable scenario saves.

See `oob-structure.md` for the data boundaries and future extensions.

## Moving branches and copying objects

- Drag a group or commander onto Game or another group to move the entire branch. Descendant commanders immediately inherit from their new ancestors. Drop between sibling node rows to reorder them. Cyclic moves and moves beneath Truth or commanders are blocked.
- Drag an object row from the tree or roster onto a view to make an independent copy. The source stays in place; the copy keeps its current position and receives a new ID. Private source notes and false-contact flags are cleared. Truth counters become linked contacts when copied into player views, but later truth movement never automatically updates them.
- Inherited objects can also be copied. Copying an ancestor object into a descendant creates another object; it does not override the inherited original. Objects with the same truth link remain independent.
- **Move branch to** and **Copy object to** provide keyboard alternatives. **Position** chooses sibling order without dragging. Arrow keys navigate the tree; Enter selects a row. Moving a map counter changes its coordinates only when it is owned by the selected view. **Duplicate here** makes a copy within that owner, offset for selection.

## Map workflow

1. Select Truth, a group, or a commander. **+ Counter**, **+ Marker**, and **Visible area** create objects owned by the selected view. Counters in Truth represent true positions; counters in other views are reported or confirmed contacts.
2. Calibrate: choose **Calibrate**, click both ends of the printed one-mile scale, enter `1609.344` meters, then **Apply calibration**. The initial scale is provisional.
3. Select or drag owned counters; edit labels, symbols, facing, strength estimates, activity, observed times, and uncertainty radius. Private notes and false-contact flags stay in the umpire workspace.
4. Draw a visible-area polygon and choose **Finish drawing**. Regions describe observation areas; they do not calculate terrain LOS or automatically reveal counters. Select an owned region and use **Delete object** to remove it.
5. Choose **Compare with Truth** for an umpire overlay, with adjustable draft opacity and displacement links. Universal objects render once. Select **Draft** to return to the effective information view.
6. Enter a **Situation summary** for the selected view. Ancestor summaries appear separately with their source names in the draft UI. Publication combines summaries in root-to-commander order.
7. Save a scenario JSON before closing. Open it to resume the full tree, ownership, objects, and publications. This app uses **version 3** scenarios; old version 1 and 2 saves are not supported.

Ruler / route supports multiple points followed by **Finish drawing**. **Speed (km/h)** gives cumulative distance and estimated travel time at each point. Estimates assume constant speed without terrain or rest allowances and depend on calibration. Range circle uses center and radius clicks. Wheel zooms; Pan drags the map; Fit map restores its full extent. Measurements are workspace tools and are not saved or published. Replacing the map retains existing object coordinates.

## Publishing and exporting

Select a commander and **Publish commander view**. This freezes the complete inherited view: objects, Situation summary, commander name, scenario title/time, map image, dimensions, and calibration. The status shows the last publication time and whether the current public draft differs. Private-only edits do not change that status.

**Published** displays the frozen snapshot. PNG and printable PDF also use only that snapshot, even if you later move the commander, edit a shared object, rename a view, replace the map, or recalibrate. Republish to release those changes. PDF opens a map and object-summary page with a **Situation summary** section; use its Print / Save as PDF button.

Truth links, private notes, false-contact flags, and unrelated objects do not enter publications or player exports. Scenario JSON contains the complete umpire workspace and secrets; it is not a player export. This remains a single-umpire local tool without accounts, live connections, terrain LOS calculation, messaging, or replay.

## Sharing the app

Run `export_site.bat` to create `kriegsspiel-map-room.zip`. It includes `index.html`, `forces.js`, `model.js`, `app.js`, `military-ui.js`, styles, this README, the local map, and its generated embedded copy. Extract the ZIP and open `index.html`. Git files, scenario saves, and browser data are excluded. The placeholder JPEG must exist locally even though it is ignored by Git.

From WSL/Linux, `./export_site.sh` exports committed assets from `HEAD` and the local map to `../pakfront.github.io/kriegsspiel-map-room/`. Uncommitted changes are excluded with a warning. Select another revision with `./export_site.sh <git-ref>` or another repository with `PAGES_DIR=/path/to/pages`. The script replaces only this app's folder and does not commit or push.

## Verification and next steps

Serve the folder locally and open `checks.html` for inheritance, branch movement, copy independence, undo, private-field filtering, scenario validation, frozen PNG encoding, and measurement checks. Browser automation in `tests/browser_checks.py` additionally exercises actual dragging, keyboard controls, saves, PDF, direct disk export, OOB editing, operational attachments, and military link privacy; it requires Python Playwright and its Chromium browser.

The implementation decisions and acceptance criteria are in `view-hierarchy-plan.md`. Future work can add saved line geometry and editable polygon vertices, automatic local recovery, and unsaved-change indication. Multiple group memberships, local visibility overrides, and automatic contact synchronization remain separate features.

# Kriegsspiel map room

Open `index.html` for the Map Room, or `map-maker/index.html` for the Map Maker, in a current desktop browser. The navigation bar links the two applications. No installation or server is required. The exported app includes `default-map.js`, an embedded copy of the local JPEG that allows PNG/PDF export and scenario saving when opened directly from disk. Both export scripts generate it from `fake-pea-ridge-map.jpg`. In a source checkout without that generated file, use **Import background image** to select the JPEG before publishing or saving.

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
7. Save a scenario JSON before closing. Open it to resume the full tree, ownership, objects, masks, and publications. This app saves **version 5** scenarios with an embedded vector map document. Version 3 and 4 saves migrate when opened, including their independently frozen publications. Version 1 and 2 saves are not supported.

Visibility regions and scenario annotations support whole-object dragging and vertex handles. Select an owned area or annotation, then use **Insert vertex** to add a vertex on its nearest segment. Selected vertex coordinates can be edited numerically or removed from the inspector. Inherited geometry and publications are read-only.

Ruler / route supports multiple points followed by **Finish drawing**. **Speed (km/h)** gives cumulative distance and estimated travel time at each point. Estimates assume constant speed without terrain or rest allowances and depend on calibration. Range circle uses center and radius clicks. Wheel zooms; Pan drags the map; Fit map restores its full extent. Measurements are workspace tools and are not saved or published. Replacing the background image retains existing object coordinates. With vector terrain present, it also retains the canvas extent. Importing a complete battlefield map uses the compatibility checks described below.

## Map Maker and reusable battlefields

The sibling Map Maker creates maps independently of scenarios, units, and commanders. Open `map-maker/example.kriegsspiel-map.json` for a worked example with overlapping elevations, woods, a road/creek crossing, and a lake containing an island. Its files contain the background image, calibration, layers, and vector features; both applications use shared geometry and SVG rendering code.

1. Start a blank map or **Import background** with a PNG/JPEG. Set the map title and extent, and calibrate two known points or enter meters per map unit.
2. Select a layer, a drawing tool, and a preset. **Terrain area** covers woods, town, marsh, open ground, and lakes; **Elevation area** creates raised areas and depressions; **Route** includes roads, trails, and railroads; **Obstacle** includes creeks, fences, hedges, and walls; **Point** places bridges, fords, gates, buildings, and landmarks; **Annotation** draws labels, arrows, boundaries, and shaded areas.
3. Click vertices, then **Finish drawing**, double-click, or Enter. Points and labels finish immediately. Escape cancels unfinished drawing or a drag.
4. Select features from the canvas or feature list. Move a feature or its vertex handles, **Insert vertex**, edit vertex coordinates, duplicate, or delete. Arrow keys move the selection, with Shift for ten map units. Undo/redo restores complete editing transactions. Optional snapping targets visible vertices, segments, or a grid; hold Ctrl to bypass it.
5. Layers can be reordered, hidden while editing, or locked. **Include layer in exports** independently controls inclusion in map PNG/PDF and player publications. Saving a map preserves all layers, including excluded ones. Features are listed for the selected layer.
6. Edit physical width/height in meters and descriptive movement, crossing, cover, and sight characteristics. Bridge, ford, and gate points can reference roads and obstacles. These records support manual adjudication; they do not compute movement, crossings, or LOS.
7. **Save map** downloads a `.kriegsspiel-map.json`; **Open map** resumes editing. Export PNG or printable PDF for map-only distribution. The unsaved-change indicator and navigation guard protect unfinished work.

Elevation is the baseline plus the polygon's signed relative height. Overlapping elevation polygons use the highest priority; later features break ties. Heights do not add. The first version models constant elevation areas; slopes and continuous elevation are future work. Polygon files support holes, which render and can have their existing vertices edited; creating new holes is a future tool.

Map geometry uses local image/canvas coordinates rather than geographic latitude/longitude. Recalibration changes physical distance estimates while retaining coordinates. Images, styles, layers, and feature properties are validated on open; malformed documents leave the current map intact.

Map saves use **version 2**, adding numeric sight rules; version 1 maps still open. Select a physical feature in Map Maker to configure **Sight obstruction**, obstruction height above ground, and penetration distance. Point blockers use physical width and footprint depth; line blockers use physical width. **Fill unset Eastern US defaults** fills missing sight rules, zero/missing dimensions, and blank descriptive notes on existing features while retaining custom values. New features receive these defaults automatically. Review these before adjudication; free-text sight descriptions do not drive calculations.

### Eastern US feature defaults

New physical features use editable assumptions for a rural eastern U.S. battlefield. The sight values below use the shared visibility budget; movement and cover notes are descriptive and do not automatically move units or adjudicate combat.

| Preset | Obstruction height | Penetration distance |
| --- | --- | --- |
| Woods | 15 m | 30 m |
| Town / building | 8 m | 10 m |
| Marsh / tall reeds | 2 m | 30 m |
| Hedge | 2 m | 3 m |
| Farm fence / gate | 1.2 m | 3 m |
| Stone wall | 1.5 m | Opaque |
| Open ground, lake, creek, routes, bridge, ford, landmark | No added obstruction | Not consumed |

Default widths are 6 m for roads, 2 m for trails, 4 m for railroad corridors and creeks, 2 m for hedges, 0.3 m for fences, and 0.5 m for walls. Building footprints start at 12 × 8 m, bridges at 6 × 12 m, and fords at 6 × 8 m. Elevation areas retain an editable +20 m or −20 m offset. Polygon extent comes from the geometry you draw.

These are starting values for the abstract model, not regional measurements. Woodland height and density vary with terrain and understory ([US Forest Service research](https://research.fs.usda.gov/treesearch/56080)); adjust woods for season, regrowth, and local conditions. Opening an existing map retains its saved properties. Use the fill button deliberately to populate unset values, or edit an individual feature in the inspector.

### Importing a map into the Map Room

Use **Import battlefield map** and review its title, dimensions, scale, feature count, and revision. Maps with the same identity and canvas extent can update a scenario while retaining positioned objects. A different identity or extent requires explicitly clearing scenario placements; cancel preserves the scenario. Import is undoable, and existing commander publications remain intact even if placements are cleared.

The scenario embeds its own map copy. Later edits in Map Maker take effect only after another explicit import. **Terrain inspector** reads physical features without turning them into commander reports. Public map projections include exported geometry, appearance, labels, and elevation labels, while excluding movement/cover metadata, crossing references, extensions, and authoring revision/identity.

Use the Map Room's **Annotation** tool for scenario-specific labels, arrows, boundaries, and shaded areas. They belong to the selected information view, inherit through the existing tree, and use its copy/edit/privacy rules. A reusable map label is public; a Truth-owned scenario annotation stays private. Private notes are excluded from publications even when their annotation geometry is public.

## Line of sight and editable visibility masks

Map Maker also has **Test LOS** and **Visibility preview** in its toolbar. These open **Line of sight testing** above the feature inspector. Place or drag observer and target points, set heights and curvature/refraction, and inspect the shared budget and elevation profile against the current map. Point results update after terrain edits and undo/redo. Calculate a visibility preview and use reveal/hide/erase brushes to try manual adjustments. Stale previews hide until recalculated; same-grid recalculation retains overrides. **Clear LOS tests** removes the test overlays. Test settings and previews are temporary and do not dirty the map or enter battlefield JSON, PNG, or PDF exports. Persistent commander masks remain part of Map Room scenarios.

In Map Room, choose **Test LOS** or **Place observer** / **Place target** in the right-hand Line of sight panel. Enter or drag positions and set each endpoint's height above local ground. **Test point-to-point LOS** reports visibility, the first blocker, minimum clearance, and additional observer/target height needed where computable. The profile shows corrected ground (brown), obstruction tops (green), and the sight line (blue).

Limited obstructions share a visibility budget: each stretch consumes **distance inside / penetration distance**, and sight is blocked when the total exceeds 1. Clearings consume nothing; passage above obstacle tops consumes nothing. Overlapping obstructions use the strongest local density once. The rule applies equally inside woods and buildings: with 10-meter building penetration, a 6-meter interior path is visible and a 15-meter path is blocked. Opaque is an optional immediate-blocking setting for any feature. Illustrative presets use 30-meter woods penetration and 10-meter building/town penetration; existing explicit settings are retained.

Choose Flat Earth, Earth curvature, or curvature with refraction. Geometric curvature is the default; refraction uses a visible editable coefficient, with 0.13 as a conventional approximation. The local-coordinate model supports paths up to **100 km**. Scale, terrain shape, and refraction remain approximations; geographic coordinates and measured atmospheric conditions are not modeled. Uncalibrated scale, unspecified sight rules, and missing footprints are identified as incomplete inputs. Background images supply no inferred elevations or trees.

**Calculate / recalculate** creates a mask owned by the active information view. Set range, cell size, and mask target height: zero means visible ground; 1.7 meters tests visibility to a standing person's eye height. The cell estimate limits masks to 200,000 cells. Calculation can be cancelled and retains the previous mask until it finishes. Thin vector blockers are checked independently of output cell size.

Select the saved mask and use **Reveal**, **Hide**, or **Erase override**, with a brush radius in meters. Mask edit undo/redo is available, and the main Undo restores whole scenario transactions. Recalculation on the same grid preserves manual overrides. Changing grid resolution asks before clearing them; Undo restores the old mask. Inherited masks are read-only; **Copy independent mask** creates an editable copy in the chosen view.

Select **Mask for this view's export** and a Shade, Conceal, or Fade treatment. Publications freeze the final mask with their map and reported objects. Incomplete or stale results require explicit umpire acceptance or recalculation before publication. Terrain changes invalidate previous acceptance. Masks from the previous LOS algorithm remain loadable, but are stale and require recalculation or fresh umpire acceptance under the updated rules. Scenario JSON preserves masks and manual edits; public masks exclude observer records and diagnostic metadata.

The mask affects background images and reusable vector map features and labels. Existing permissions still control counters, reports, and scenario annotations: a mask does not discover Truth objects or erase a known contact outside current sight. All physical terrain participates in LOS, even when its layer is hidden in Map Maker or excluded from public map exports. Existing visible-area polygons remain manually authored annotations.

For a ready-made exercise, open `map-maker/pea-ridge-test.kriegsspiel-map.json` in Map Maker, fill and review Eastern US defaults, save it, then import that saved battlefield in Map Room.

## Publishing and exporting

Select a commander and **Publish commander view**. This freezes the complete inherited view: objects, Situation summary, commander name, scenario title/time, map background, exported vector terrain, dimensions, and calibration. The status shows the last publication time and whether the current public draft differs. Private-only edits do not change that status.

**Published** displays the frozen snapshot. PNG and printable PDF also use only that snapshot, even if you later move the commander, edit a shared object, rename a view, replace the map, or recalibrate. Republish to release those changes. PDF opens a map and object-summary page with a **Situation summary** section; use its Print / Save as PDF button.

Truth links, private notes, false-contact flags, and unrelated objects do not enter publications or player exports. Scenario JSON contains the complete umpire workspace and secrets; it is not a player export. This remains a single-umpire local tool without accounts, live connections, terrain LOS calculation, messaging, or replay.

## Sharing the app

Run `export_site.bat` to create `kriegsspiel-map-room.zip`. It includes both applications, their `shared/` code, styles, this README, the local map, and its generated embedded copy. `site-assets.txt` is the shared asset manifest used by both export scripts. Extract the ZIP and open `index.html` or `map-maker/index.html`. Keep the folder structure intact. Git files, scenario saves, and browser data are excluded. The placeholder JPEG must exist locally even though it is ignored by Git.

From WSL/Linux, `./export_site.sh` exports committed assets from `HEAD` and the local map to `../pakfront.github.io/kriegsspiel-map-room/`. Uncommitted changes are excluded with a warning. Select another revision with `./export_site.sh <git-ref>` or another repository with `PAGES_DIR=/path/to/pages`. The script replaces only this app's folder and does not commit or push.

## Verification and next steps

Serve the folder locally and open `checks.html` for inheritance, branch movement, copy independence, undo, private-field filtering, scenario validation, frozen PNG encoding, and measurement checks. Browser automation in `tests/browser_checks.py` additionally exercises actual dragging, keyboard controls, saves, PDF, direct disk export, OOB editing, operational attachments, and military link privacy; it requires Python Playwright and its Chromium browser.

The implementation decisions and acceptance criteria are in `view-hierarchy-plan.md`. The Map Maker implementation and extension boundaries are in `map-maker-plan.md`. LOS implementation details are in `line-of-sight-plan.md`; `tests/line_of_sight_checks.py` covers heights, geometry, curvature/refraction, masks, brush editing, ownership, migration, frozen concealment exports, and direct-disk operation. Map Maker browser checks in `tests/map_maker_checks.py` cover authoring, vertex edits, layers, geometry validation, map imports, annotation inheritance/privacy, frozen vector publications, version 3 migration, and direct-disk export. Future work can add hole creation, split/join tools, continuous elevation, a map library, and automatic local recovery. Geographic LOS, multiple observers, multiple group memberships, and automatic contact synchronization remain future work.

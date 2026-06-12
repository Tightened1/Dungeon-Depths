# Dungeon Depths

A turn-based roguelike that runs entirely in the browser. Six classes, branching
spec trees, relics, elite enemies, environmental hazards, bosses every 5 floors,
and a Doom-style first-person mode (press **F** in game).

## Play

Open `index.html` in any browser — or host it (below) and play from a URL.
Your run autosaves to the browser every turn; press **C** on the title screen
to continue. The save is wiped on death (it's a roguelike).

## Hosting on GitHub Pages (one-time, ~5 minutes)

1. Create a free account at github.com.
2. Click **New repository** → name it (e.g. `dungeon-depths`) → set it **Public** → Create.
3. Click **uploading an existing file**, drag ALL the files in this folder in, and **Commit changes**.
4. Go to **Settings → Pages** → under "Branch" pick `main` and `/ (root)` → **Save**.
5. After a minute, the page shows your link: `https://YOURNAME.github.io/dungeon-depths/`

Anyone with that link plays instantly in their browser — no downloads.

## Updating the game later

Replace the changed file(s) in the repository (drag-and-drop in the GitHub web
interface → Commit). The site republishes automatically in about a minute.
Players may need a hard refresh (Ctrl+Shift+R) to see the newest version.

## Files

| File           | What it is                                                        |
|----------------|-------------------------------------------------------------------|
| `index.html`   | Page shell — loads the stylesheet and scripts in order            |
| `style.css`    | All styling (layout, panels, overlays)                            |
| `core.js`      | Canvas setup, game state, save system, classes, items, relics     |
| `world.js`     | Dungeon generation, torches, hazards, elites, field of view       |
| `combat.js`    | Combat, abilities, the turn loop                                  |
| `interface.js` | Tooltips, floating numbers, themes, minimap, sidebar UI           |
| `render.js`    | Pixel-art sprites and top-down rendering helpers                  |
| `draw.js`      | First-person raycaster, textures, weapon viewmodel, main draws    |
| `shell.js`     | Title screen, mouse-look, menus, input handling, game loop        |

The scripts share one global scope and must load in the order listed in
`index.html` — don't reorder the `<script>` tags.

## Leaderboard (optional)

A free global "Hall of the Fallen" top-10 can be enabled in ~10 minutes —
see `SETUP_LEADERBOARD.md`. Until configured, the feature is fully dormant.

## Art credits

Monster, hero, tile, and item sprites are from **"16x16 DungeonTileset II" by 0x72**
(https://0x72.itch.io/dungeontileset-ii), released under CC0 1.0 (public domain).
Credit isn't required by the license, but the pack is wonderful — consider
supporting the artist. Boss sprites and effects are original to this game.
The sheet ships as `tileset.png`; if it's missing the game falls back to the
original code-drawn sprites automatically.

## Notes

- Saves live in the player's browser (localStorage): per-browser, per-device.
  Clearing site data deletes the save.
- The whole game is static — no server needed. A leaderboard/daily-run server
  can be added later without changing how this is hosted.

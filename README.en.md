[简体中文](./README.md) ｜ **English**

# Train Werewolf

> A speeding train, a journey hiding deadly intent. Can you make it to the station alive?

A multiplayer deduction-versus survival Addon for **Minecraft Bedrock Edition**. Players ride the same train, but a **Killer** is hidden among them — do tasks, earn coins, buy items, and hunt the murderer, until one side wins.

> Supports **5 ~ 15 players**, about **10 minutes** per round; comes with a dedicated train map.

---

## Table of Contents

- [Game Overview](#game-overview)
- [Features](#features)
- [Quick Start](#quick-start)
- [Two Branches: International / NetEase](#two-branches-international--netease)
- [Requirements](#requirements)
- [Admin Getting Started](#admin-getting-started)
- [Optional Feature: Voice Chat (VoiceCraft)](#optional-feature-voice-chat-voicecraft)
- [Common Commands](#common-commands)
- [Project Structure](#project-structure)
- [Development Guide](#development-guide)
- [Documentation](#documentation)
- [Credits](#credits)
- [License](#license)

---

## Game Overview

After boarding the train, the system randomly assigns you one of three roles:

| Role | Count | Objective |
|------|:--:|------|
| 🩸 **Killer** | 1 | Kill all passengers and stay hidden |
| 🔫 **Officer** | 1 | Protect passengers, find and kill the Killer |
| 🧑 **Civilian** | The rest | Survive and help the Officer find the Killer |

**Win Conditions**

- Killer dies → **Passengers win**
- All passengers die → **Killer wins**
- Time runs out with passengers still alive → **Passengers win**

**Round Flow**: Board → random role assignment → the system assigns timed tasks (overtime means death) → complete tasks to earn coins and buy items from the shop → a winner is decided → return to the platform to prepare for the next round.

For detailed player-facing instructions, see [PLAYER_GUIDE.md](./PLAYER_GUIDE.md) in this repository.

---

## Features

- **Full three-way conflict**: Killer / Officer / Civilian, each with unique mechanics and win conditions
- **Task system**: 6 task types (Ventilation / Toilet / Sleep / Eat / Hydrate / Social), with countdown timers — overtime means death
- **Economy and shops**: coins grow naturally + kill rewards; the **Killer's portable shop** + **vending machines** on the map
- **Rich item roster**: Dagger, Revolver / Derringer pistols and bullets, baseball-bat frenzy, poison and **plate poisoning**, grenades, blackout device, Magic Conch (reveals a role), Father's Pocket Watch (survive death once), and more
- **Custom blocks**: **key doors** (key / lockpick / crowbar interactions), **vending machines** (multiblock structures), **plates** (drop random food)
- **Corpse and name-tag system**: death leaves behind a named corpse, and a note's contents stay on the corpse
- **Full localization**: built-in Simplified Chinese / English (`zh_CN`, `en_US`)
- **Visual config panel**: admins right-click with a stick to configure map coordinates, task parameters, shop goods, and more
- **Dual-branch maintenance**: the same gameplay codebase supports both International and NetEase versions (only the script API version differs)
- **Optional voice integration**: install [VoiceCraft](https://gitlab.avion.team/voicecraft/VoiceCraft) and proximity voice chat turns on automatically (living players at 32 blocks, spectators talking freely among themselves yet fully isolated from the living); without it the addon behaves **exactly as before**, and not a single line of VoiceCraft has to be modified

---

## Quick Start

### Players / Server Owners

1. Get the Addon. The repository is currently maintained as **source directories** (`BP/` behavior pack + `RP/` resource pack), and does not yet include a packaging script.
2. Choose either installation method:
   - **Import**: package `BP/` and `RP/` into `.mcpack` files (or merge them into a `.mcaddon`) and import them in-game;
   - **Development-folder loading**: copy `BP/` and `RP/` into Minecraft's `development_behavior_packs` / `development_resource_packs` folders (see "Local Debug Loading" below).
3. Enable the behavior pack in world settings (the resource pack is pulled in automatically).
4. Use the dedicated **train map**, or build your own and configure it as described below.

### Developers

```bash
git clone https://github.com/xiaopa-baka/train-werewolf-addon.git
cd train-werewolf-addon

# 1) Choose a branch: main = International; netease = NetEase
git checkout main

# 2) Install the script type matching the current branch (always reinstall after switching branches)
npm install

# 3) Type check (this project only uses tsc for type checking, not compilation)
npx tsc --noEmit
```

### Local Debug Loading

Copy `BP/` and `RP/` into Minecraft's `development_behavior_packs` / `development_resource_packs` folders (located under the game's `com.mojang` data directory) to load them directly on a real device; after editing scripts, just re-enter the world for changes to take effect.

> **NetEase version**: copy `BP/` and `RP/` into MC Studio's AddOn working directory.
> It's recommended to write your own "clear first, then copy" local script to speed up iteration — this repository does not include such a script (it is not version-controlled).

---

## Two Branches: International / NetEase

Same scripts and text, only the script API version differs:

| Item | `main` (International) | `netease` (NetEase) |
|---|---|---|
| `min_engine_version` | `[1, 26, 50]` | `[1, 21, 120]` |
| `@minecraft/server` | `2.10.0` | `2.3.0` |
| `@minecraft/server-ui` | `2.2.0` | `2.0.0` |
| BP `capabilities` | `["script_eval"]` | none |
| `package.json` devDependencies | 2.10.0 / 2.2.0 | 2.3.0 / 2.0.0 |

**Conventions**

- `main` is the **long-term maintenance trunk for the International version**; features and bug fixes should be synced between the two branches (except for version-number differences), and `cherry-pick` is recommended to keep the scripts consistent.
- After switching branches, `node_modules` no longer matches the branch, so **you must run `npm install` again**.
- **Known NetEase limitation**: custom block interactions (key doors, multiblock vending machines) are **not yet specially adapted or tested on the NetEase side**; that part of the code is currently identical to the International version.

---

## Requirements

- **Minecraft Bedrock Edition**: International ≥ 1.26.50, or NetEase ≥ 1.21.120
- Development environment:
  - Node.js (for `npm install` and `tsc`)
  - TypeScript `^5.5.0` (installed as a devDependency, used only for type checking)

---

## Admin Getting Started

### 1. Configure the Map and Rules

After entering the game, obtain the config stick, Hold the stick and **right-click** to open the config panel, then set up in order:

1. **Global Game Config**: auto-start, start delay, minimum players, game duration, task parameters, coin growth rate, in-round stamina / jump toggles, weather toggle
2. **Map Region Config**: platform, train-head coordinates, train area, ventilation area, toilet spots, random teleport points
3. **Food & Drink Config**: the list of foods and drinks valid for tasks
4. **Shop Config**: goods and prices for the Killer shop and vending machines
5. **Optional: Voice settings** (this button only appears in the main menu when the world has VoiceCraft installed and connected): adjust the voice radius for living players, 32 blocks by default (4–128, step 4)

### 2. Starting the Game

- **Automatic**: once everyone is inside the train and the player count is met, a countdown starts and the train departs
- **Manual**: an admin runs `/lw_p1:start`

---

## Optional Feature: Voice Chat (VoiceCraft)

This addon can hook into [VoiceCraft](https://gitlab.avion.team/voicecraft/VoiceCraft) proximity voice chat, with three rules tailored to the werewolf gameplay:

| Situation | Behavior |
|---|---|
| Living ↔ living | Heard within the radius (**32 blocks** by default; admins can change it in the "Voice settings" panel) |
| Spectator ↔ spectator | **No distance limit at all**, and they hear each other across dimensions |
| Living ↔ spectator | **Completely muted both ways** (the audio packets are never even sent) |

- **Entirely optional**: without VoiceCraft installed the addon does **nothing at all** — no timers registered, no data sent, no gameplay or state touched, and no "Voice settings" button in the config menu.
- **Zero-modification integration**: all of the adaptation lives in this project (`BP/scripts/integration/voiceCraft.js`). VoiceCraft's addon and its server configuration **do not need a single change**, so upstream addon updates cannot break it.
- **Requirements** (all of them): ① every player installs the VoiceCraft client app; ② someone runs a VoiceCraft server reachable by both the players and the Minecraft world (public IP / UDP port mapping / the official hosted service); ③ the world loads the VoiceCraft addon (`Basic` plus the `Core.McWss` or `Core.McHttp` matching your transport). The first time you join you bind once with VoiceCraft's `/voicecraft:vcbind <binding key>`; after that **neither rejoining the world nor restarting the VoiceCraft client app needs another bind** (the binding record lives in a world dynamic property, and after a client app restart you are matched back via the UserGuid that the VoiceCraft client persists; only players who ran `/lw_p1:voice_forget` have to bind again).
- **International version only**: the NetEase branch has no `/connect` tunnel, so this feature does not apply there (see "Two Branches").

---

## Common Commands

| Command | Effect |
|---|---|
| `/lw_p1:start` | Start the game manually (requires permission level GameDirectors) |
| `/lw_p1:end` | Force-end the current round (runs the end flow at any time) |
| `/lw_p1:clear_corpses` | Remove all corpses and name tags |
| `/lw_p1:voice_status` | Show voice integration status: connection, channel bitmasks, voice radius and binding records (GameDirectors) |
| `/lw_p1:voice_resync [target]` | Resend channels and voice radius, and write binding records back into the world property (rejoining then auto-restores them). The target is a **player selector** (Tab completes): **omitting it writes back ALL records (offline players included)**, `@a` for everyone online, `@s`/`@p`/`@r`/an online player name for one player (GameDirectors) |
| `/lw_p1:voice_forget [target]` | Unbind voice: only the target's id is removed from the world property, **nothing is muted**; voice keeps working this session, and rejoining the world (or restarting the client app) needs `/vcbind` again. Same target syntax as above, but **omitting the target clears ALL records (offline players included)** — write `@s` to clear just yourself (GameDirectors) |
| `/give @s minecraft:stick` | Get the config admin stick |
| `/give @s lw_p1:keydoor_1` ~ `keydoor_10` | Get key doors |
| `/give @s lw_p1:key_1` ~ `key_8` | Get room keys |
| `/give @s lw_p1:lockpick` | Get a lockpick |
| `/give @s lw_p1:guide_book` | Get the guide book |

> The four `voice_*` commands only do something when VoiceCraft is installed; otherwise they simply report "VoiceCraft not detected" without erroring.

---

## Project Structure

```
demo/
├── BP/                         # Behavior pack
│   ├── manifest.json
│   ├── blocks/                 # Custom blocks (key doors / vending machines / plates)
│   ├── entities/               # Bullets / corpses / firecrackers / grenades / pistols / name tags
│   ├── items/                  # Custom items
│   ├── loot_tables/            # Empty loot tables
│   ├── texts/                  # BP pack-name localization
│   └── scripts/                # All logic scripts (ES Module)
│       ├── main.js             # Entry: only imports each module
│       ├── core/               # hud / state / i18n / itemIcons
│       ├── game/               # lobby / gameFlow / gameEnd / environment / corpse
│       ├── gameplay/           # tasks / props / shop / inGame / guideBook
│       ├── blocks/             # keydoor
│       ├── config/             # worldConfig (data) / configUI (interface) / configExtensions (optional-module registry)
│       └── integration/        # Optional modules (voiceCraft: VoiceCraft voice integration)
├── RP/                         # Resource pack (models / animations / textures / sounds / text)
├── package.json                # devDependencies only (type definitions + tsc)
├── tsconfig.json               # Type-checking config (noEmit)
├── 列车狼人杀游玩指南.md        # Player-facing instructions (Chinese)
├── PLAYER_GUIDE.md             # Player-facing instructions (English)
└── VoiceCraft联动调研.md       # Optional voice feature: research + implementation notes (Chinese)
```

> Scripts are layered by domain, and the entry `BP/scripts/main.js` only does imports, making it easy to locate feature modules.
> `config/` and `integration/` are wired in **reverse**: an optional module registers its config entry into `configExtensions.js`, and the config UI knows nothing about any specific module — deleting `integration/` will not affect the config UI or any other feature.

---

## Development Guide

### Type Checking

```bash
npx tsc --noEmit   # 0 error means it passes
```

All script files carry `// @ts-check` at the top, working with `allowJs + checkJs` in `tsconfig.json` for static validation.

### Notes

- **Relative imports must include the `.js` extension** (e.g. `import "./config/worldConfig.js"`), otherwise a runtime `ERR_MODULE_NOT_FOUND` occurs.
- Use **ScriptAPI 2.x** conventions: `world.afterEvents.worldLoad`, `world.getPlayers()`, `entity.isValid` (property), `runCommand`, etc., and avoid the old interfaces.
- The world cannot be reliably modified inside `beforeEvents` (dispatching items / deleting entities, etc.); defer to the next tick with `mc.system.run()`.
- All player-facing text must be output through `t()` in `core/i18n.js`, with matching keys completed in `RP/texts/zh_CN.lang` and `en_US.lang` (the two files must mirror each other exactly).

### Adding an Item

1. Add an item JSON under `BP/items/`;
2. Put a texture in `RP/textures/items/` and register it in `item_texture.json`;
3. Write the event-handling logic in the corresponding system (usually `BP/scripts/gameplay/props.js`);
4. If it should be sold, add an entry in the shop config in `BP/scripts/config/worldConfig.js`;
5. Add localized names in `RP/texts/zh_CN.lang` + `en_US.lang` (`item.lw_p1:<id>`);
6. Once `npx tsc --noEmit` passes, test on a real device.

### Adding a Door

1. Add a door block JSON modeled on `BP/blocks/keydoor_1.json`;
2. Add the corresponding key under `BP/items/`;
3. Register the mapping in `DOOR_KEY_MAP` in `BP/scripts/blocks/keydoor.js`;
4. Add the texture in RP and register it in `terrain_texture.json`;
5. Add the language entries; once `npx tsc --noEmit` passes, test on a real device.

### Commit Conventions

- Sync features / bug fixes to both the `main` and `netease` branches;
- Prefix commit messages with `feat: / fix: / chore:` and explain "why" the change was made.

---

## Documentation

- **Player Guide (English)**: [PLAYER_GUIDE.md](./PLAYER_GUIDE.md)
- **Player Guide (Chinese)**: [列车狼人杀游玩指南.md](./列车狼人杀游玩指南.md)
- **Developer Reference**: every script file has a one-line responsibility comment at the top; start reading at `BP/scripts/main.js`
- **Configuration Guide**: after entering the game, open the config panel with a stick — each option has an explanation

---

## Credits

**Author / Production**

- Xiaopa baka
- LW Realm Studio

**Contact email**: xiaopa1214@163.com

**Technology**

- Minecraft Bedrock ScriptAPI (`@minecraft/server`, `@minecraft/server-ui`)
- [TypeScript](https://www.typescriptlang.org/) (type checking)

---

## License

This repository currently **does not include an open-source license**. To repost, build on, or use it commercially, please contact the author at **xiaopa1214@163.com** for authorization first.

---

> Good luck — on this train, the one you should trust least is often the one who smiles the most naturally.
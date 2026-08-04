![MiniVTT Banner](https://samsterjam.com/minivtt_banner.png)

# MiniVTT

A lightweight web-based virtual tabletop for running tabletop RPG sessions. Built because I got tired of dealing with bloated VTTs that take forever to set up for simple encounters.

Everything in MiniVTT is a token - your maps, character pieces, monsters, items, whatever. Drag and drop images or videos onto the canvas and you're good to go. The DM gets full control over what players can see and interact with, and everything syncs in real-time across all connected clients.

The interface supports panning and zooming so players can focus on different parts of the scene. Scene switching is instant - click a scene in the DM panel and everyone transitions immediately. Most DM actions are either drag-and-drop or keyboard shortcuts to keep things fast.

<p align="center">
  <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_full_demo.webp?raw=true" alt="MiniVTT Demo Gif">
</p>

---

## Table of Contents

1. [Features](#features)
2. [To-Do](#to-do)
3. [Showcase](#showcase)
4. [Installation](#installation)
5. [Usage](#usage)
6. [Project Structure](#project-structure)
7. [Built With](#built-with)
8. [Security Disclaimer](#security-disclaimer)

---

## Features

**Real-time sync** - Token movements, scene changes, and music playback stay synchronized across all connected clients (DM and players).

**Scene management** - Create and switch between multiple scenes. Reorder them in the sidebar. Everyone sees the active scene instantly when you switch.

**Drag-and-drop everything** - Drop images or videos directly onto the canvas to create tokens. Drop audio files to add music tracks.

**Token controls** - Move, resize, and layer tokens. Toggle visibility to hide things from players. Give players permission to move specific tokens. Select several at once by shift-clicking or dragging a marquee, and every action applies to the whole group.

**Hidden tokens** - Keep tokens invisible to players until you're ready to reveal them. Good for surprises and fog of war.

**Music manager** - Upload and play background music. Volume controls sync across all clients.

**Pan and zoom** - Mouse wheel to zoom, middle-click to pan. Each player can navigate independently while viewing the same scene.

**Keyboard shortcuts** - Most common DM actions have hotkeys: hide tokens (H), toggle player movement (I), adjust z-index ([/]), duplicate (Ctrl+D), etc.

<p align="center">
  <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_scenebuild_demo.webp?raw=true" alt="MiniVTT Scene Building Demo Gif">
</p>

---

## To-Do

- [x] Render the scene through a single world transform instead of per-token pixel math
- [x] Give the server authority over scene and music state so late joiners are in sync
- [x] Sortable music order in DM panel
- [x] Better documented hotkeys
- [x] Update/Improve DM interface & Multiselect
- [ ] Token Rotation
- [ ] Snap tokens to grid options

---

## Showcase

**Live Synced Movement**
<img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_sync_demo.webp?raw=true" alt="Live Movement Demo">

**DM Tools & Hidden Tokens**
<img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_dmtools_demo.webp?raw=true" alt="DM Tools Demo">

**Music Manager**
<img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_music_demo.webp?raw=true" alt="Music Manager Demo">

---

## Installation

### Clone the Repository
```sh
git clone https://github.com/SamsterJam/MiniVTT.git
cd MiniVTT
```

### Install Dependencies
```sh
npm install
```

### Start the Server
```sh
npm start
```

Server runs on port 3000 by default. Navigate to `http://localhost:3000` to get started.

Share the URL with your players - one person connects as DM at `/dm`, everyone else connects as players at the root URL.

### Configuration

All optional. Without them the server picks a random DM password each start and prints it to the console.

| Variable | Purpose |
| --- | --- |
| `PORT` | Port to listen on (default `3000`) |
| `DM_PASSWORD` | Fixed DM password, so a restart doesn't rotate it |
| `SESSION_SECRET` | Fixed session secret, so a restart doesn't log the DM out |

```sh
DM_PASSWORD=hunter2 SESSION_SECRET=$(openssl rand -hex 32) npm start
```

---

## Usage

### DM View
Navigate to `http://your-host:3000/dm` to access the DM interface where you can manage scenes, tokens, and music.

### Player View
Players connect to `http://your-host:3000` and get a simplified view that only shows what the DM reveals.

Press `?` in the DM view for the full shortcut list. It is generated from the
same table that drives the keyboard and the selection bar, so it cannot go stale.

### Creating Scenes
Press `N` or the `+` on the toolbar. Scene tabs reorder by dragging, rename on
double click, and offer rename / duplicate / delete on right click.

### Adding Tokens
Drag and drop image or video files onto the canvas. Each file becomes a token
you can manipulate.

### Selecting (DM only)
- Click to select, `Shift`/`Ctrl` click to add or remove
- Drag on empty canvas to marquee select, `Ctrl+A` for everything, `Esc` to clear
- Dragging a token moves it without selecting it

### Token Controls (DM only)
- Drag to move, or nudge with the arrow keys (`Shift` for 10x)
- Drag an edge to resize, holding `Shift` to break the aspect ratio
- `[` / `]` - Move down/up in the layer order (z-index)
- `H` - Hide from players
- `I` - Toggle whether players can move it
- `Ctrl+D` - Duplicate
- `Delete` - Remove

All of these apply to the whole selection, and appear as buttons on the
selection bar whenever something is selected.

### Adding Music
Drag audio files onto the music panel, or click the drop area to browse. Tracks
reorder by their grip, rename in place on double click, and delete from the
right click menu. Renaming stores a label rather than touching the file.
Playback and volume sync across all clients.

### Other Shortcuts
- `T` - Toggle DM toolbar
- `M` - Toggle music panel
- `?` - Toggle the shortcut list
- `F2` - Rename current scene
- `Shift+D` - Delete current scene (with confirmation)

---

## Project Structure

```
.
├── server.js              // Entry point: loads scenes, starts HTTP + sockets
├── app.js                 // Express setup
├── config.js              // Port, DM password, session secret
├── session.js             // Session middleware, shared by Express and Socket.IO
├── routes.js              // DM authentication and uploads
├── socketHandler.js       // Socket events and role authorisation
├── controllers
│   ├── musicController.js
│   └── uploadController.js
├── data
│   ├── musicNames.json    // Track names the DM has chosen
│   └── scenes             // Stored scene data
├── middlewares
│   └── upload.js          // Shared upload handling for tokens and music
├── models
│   ├── musicModel.js      // Playback state, extrapolated from the server clock
│   └── sceneModel.js      // Scene state, persistence, and the trust boundary
└── public                 // Client-side files
    ├── css
    │   ├── dm.css         // DM chrome, all of it floating over the canvas
    │   ├── styles.css     // The canvas and the tokens on it
    │   └── theme.css      // Colors, radii, timings; the whole palette
    ├── dm-login.html
    ├── dm.html            // DM interface
    ├── index.html         // Player interface
    ├── js
    │   ├── commands.js    // Every DM action: key, icon, and what it runs
    │   ├── dm.js
    │   ├── icons.js
    │   ├── musicManager.js
    │   ├── musicPlayer.js
    │   ├── panZoomHandler.js
    │   ├── player.js
    │   ├── sceneManager.js
    │   ├── sceneRenderer.js
    │   ├── tokenManager.js
    │   ├── ui.js          // Dialogs, toasts, and context menus
    │   └── utils.js
    ├── music              // Uploaded audio files
    └── uploads            // Uploaded token images/videos
```

---

## Built With

- [Node.js](https://nodejs.org/) - Server runtime
- [Express](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Interact.js](https://interactjs.io/) - Drag, drop, and resize
- [SortableJS](https://github.com/SortableJS/Sortable) - Scene reordering
- [Multer](https://github.com/expressjs/multer) - File upload handling

Browser libraries are served from `node_modules`, not a CDN, so MiniVTT works
on a network with no internet access.

---

## Security Disclaimer

This is a hobby project and hasn't been security audited.

The DM/player split is enforced on the server. Socket connections are
authenticated from the same session Express uses, so a client cannot claim the
DM role; players never receive hidden tokens, and they can only move tokens the
DM has explicitly released to them. Token updates are checked against a field
allowlist rather than merged blindly.

What it still does *not* do:

- There is no per-player identity - every player is equivalent
- There is no rate limiting on uploads or socket events
- It speaks HTTP, not HTTPS, so the DM password crosses the network in the clear

Run it on a local network with people you trust. If you expose it to the
internet, put it behind a reverse proxy with TLS.

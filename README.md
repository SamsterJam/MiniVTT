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

**Token controls** - Move, resize, rotate, and layer tokens. Toggle visibility to hide things from players. Give players permission to move specific tokens. All controlled by keyboard shortcuts or mouse interactions.

**Hidden tokens** - Keep tokens invisible to players until you're ready to reveal them. Good for surprises and fog of war.

**Music manager** - Upload and play background music. Volume controls sync across all clients.

**Pan and zoom** - Mouse wheel to zoom, middle-click to pan. Each player can navigate independently while viewing the same scene.

**Keyboard shortcuts** - Most common DM actions have hotkeys: hide tokens (H), toggle player movement (I), adjust z-index ([/]), duplicate (Ctrl+D), etc.

<p align="center">
  <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_scenebuild_demo.webp?raw=true" alt="MiniVTT Scene Building Demo Gif">
</p>

---

## To-Do

- [ ] Security for websockets and overall application
- [ ] Sortable music order in DM panel
- [ ] Better documented hotkeys
- [ ] Update/Improve DM interface & Multiselect
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

---

## Usage

### DM View
Navigate to `http://your-host:3000/dm` to access the DM interface where you can manage scenes, tokens, and music.

### Player View
Players connect to `http://your-host:3000` and get a simplified view that only shows what the DM reveals.

### Creating Scenes
Click "Create Scene" in the DM panel, give it a name, and select it from the sidebar to make it active.

### Adding Tokens
Drag and drop image or video files onto the canvas. Each file becomes a token you can manipulate.

### Token Controls (DM only)
- Click to select a token
- Drag with mouse or use arrow keys to move
- `[` / `]` - Move token down/up in the layer order (z-index)
- `H` - Hide token from players
- `I` - Toggle whether players can move this token
- `Delete` - Remove token
- `Ctrl+D` - Duplicate selected token

### Adding Music
Drag audio files into the music drop area or use the Music Manager panel. Playback and volume sync across all clients.

### Other Shortcuts
- `T` - Toggle DM toolbar
- `M` - Toggle music panel
- `Shift+D` - Delete current scene (with confirmation)

---

## Project Structure

```
.
├── app.js                  // Express setup
├── controllers
│   ├── musicController.js
│   ├── sceneController.js
│   └── uploadController.js
├── data
│   └── scenes             // Stored scene data
├── middlewares
│   ├── multerMusic.js     // Music upload handling
│   └── multerUpload.js    // Token upload handling
├── models
│   └── sceneModel.js      // Scene data model
├── public                 // Client-side files
│   ├── css
│   │   ├── dm.css
│   │   └── styles.css
│   ├── dm-login.html
│   ├── dm.html            // DM interface
│   ├── index.html         // Player interface
│   ├── js
│   │   ├── dm.js
│   │   ├── musicManager.js
│   │   ├── panZoomHandler.js
│   │   ├── player.js
│   │   ├── sceneManager.js
│   │   ├── sceneRenderer.js
│   │   ├── tokenManager.js
│   │   └── utils.js
│   ├── music              // Uploaded audio files
│   └── uploads            // Uploaded token images/videos
├── routes.js
├── server.js              // Server entry point
└── socketHandler.js       // WebSocket event handling
```

---

## Built With

- [Node.js](https://nodejs.org/) - Server runtime
- [Express](https://expressjs.com/) - Web framework
- [Socket.IO](https://socket.io/) - Real-time communication
- [Interact.js](https://interactjs.io/) - Drag, drop, and resize
- [SortableJS](https://github.com/SortableJS/Sortable) - Scene reordering
- [Multer](https://github.com/expressjs/multer) - File upload handling

---

## Security Disclaimer

This is an experimental project and hasn't been security audited. If you're running it on anything other than a trusted local network, you should know:

- WebSocket connections are not secured by default
- There's no authentication beyond the DM/player split
- File uploads aren't validated beyond basic type checking
- Anyone with network access can potentially connect

Only run this with people you trust, preferably on a local network. If you need to expose it to the internet, put it behind proper authentication and use HTTPS/WSS.

Use at your own risk.

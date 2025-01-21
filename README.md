![MiniVTT Banner](https://samsterjam.com/minivtt_banner.png)

# MiniVTT - Your Minimal Yet Powerful Virtual Tabletop 🎲

MiniVTT is a streamlined, web-based virtual tabletop designed to provide Game Masters (GMs/DMs) and players with all the essential tools for immersive role-playing sessions. Gather your friends, maps, tokens, and dice, and let MiniVTT take care of the rest! 🗺️

I created MiniVTT with the goal of minimizing the time and effort required for DMs to set up and manage game scenes. Many virtual tabletops are overloaded with features, making even simple scene setups time-consuming. MiniVTT addresses this by offering a straightforward solution that allows DMs to effortlessly display scenes and control player interactions. With a focus on minimalism and simplicity, most actions for the DM involve intuitive drag-and-drop mechanics or convenient keybinds.

I also appreciate modern, responsive interfaces that support panning and zooming, enabling each player to focus on specific parts of the scene. Switching between scenes is just a click away, instantly transitioning all players to the new view. Each scene is composed entirely of 'tokens,' which can be animated or static images. These tokens serve as maps, grids, player characters, monsters, items, puzzle pieces, or anything else you can imagine. This simple architecture grants you complete control over your game environment. 🎭

<p align="center">
  <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_dmtools_demo.gif?raw=true" alt="MiniVTT Demo Gif">
</p>

---

## Table of Contents 📚

1. [Features ✨](#features-)
2. [To-Do 📝](#to-do-)
3. [Showcase GIFs 🎥](#showcase-gifs-)
4. [Installation 🛠️](#installation-)
5. [Usage 🎮](#usage-)
6. [Project Structure 🗂️](#project-structure-)
7. [Built With 🛠️](#built-with-)
8. [Important Security Disclaimer ⚠️](#important-security-disclaimer-)


---

## Features ✨

• Real-Time Synchronization 🔄  
  – DM and Player clients stay perfectly in sync with token placements, movements, and scene changes.  

• Multiple Scenes Management 🎬  
  – Create, switch, and reorder scenes on-the-fly. Move your party from the tavern to the dragon’s lair in seconds.  

• Drag-and-Drop Uploads 📂  
  – Instantly drop images or videos onto the scene to create tokens—super easy for custom art and epic cutscenes.  

• Token Control 🎮  
  – Resize, rotate, move, and reorder tokens. Toggle visibility and even hand move-control to players with a single key press.  

• Hidden Tokens for DM 🕵️‍♂️  
  – Keep secrets hidden from your players' view until the perfect moment to reveal them. Surprise goblins never felt this good.  

• Music Manager 🎵  
  – Upload, organize, and play background music to set the mood! Share the same track across all clients for full immersion.  

• Zoom & Pan 🔍  
  – Effortlessly zoom in on details or pan across the map with intuitive mouse wheel and middle-click interactions.  

• Hotkeys Galore ⌨️  
  – Quickly hide tokens, change z-index ordering ([ / ]), duplicate tokens (Ctrl + D), or toggle toolbar (T) for better workflow.  


<p align="center">
  <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_scenebuild_demo.gif?raw=true" alt="MiniVTT Scene Building Demo Gif">
</p>

---

## To-Do 📝

- [ ] Security for websockets and overall application  
- [ ] Sortable music order in DM panel
- [ ] Better documented hotkeys
- [ ] Update/Improve DM interface & Multiselect
- [ ] Token Rotation
- [ ] Snap tokens to grid options

---

## Showcase GIFs 🎥

1. **Live Synced Movement**  
   <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_sync_demo.gif?raw=true" alt="Live Movement Demo">

2. **DM Tools & Hidden Tokens**  
   <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_dmtools_demo.gif?raw=true" alt="DM Tools Demo">

3. **Music Manager**  
   <img src="https://github.com/SamsterJam/SamsterJam_Repo_Gifs/blob/main/minivtt_music_demo.gif?raw=true" alt="Epic Music Setup Demo">


---

## Installation 🛠️

### 1. Clone the Repository
```sh
git clone https://github.com/SamsterJam/MiniVTT.git
cd MiniVTT
```

### 2. Install Dependencies
```sh
npm install
```

### 3. Start the Server 🚀
```sh
npm start
```
The server defaults to port 3000. Open your browser and navigate to [http://localhost:3000](http://localhost:3000).

### 4. Bring Your Friends 🎉
Share the URL with your players. One person logs in as DM, and others log in as Players to experience real-time synergy.

---

## Usage 🎮

1. **Open DM View**  
   • After starting the server, navigate to http://hostipaddress:3000/dm to manage scenes, tokens, music, etc.  

2. **Open Player View**  
   • Send your players to http://hostipaddress:3000. They get a simplified interface to see only what you reveal.  

3. **Create or Switch Scenes**  
   • Use the “Create Scene” button (in DM view). Name your scene, then select it from the side panel.  

4. **Drag and Drop**  
   • Upload images or videos onto the DM view to create tokens. You can also drag audio files onto the music drop area to add tracks!  

5. **Token Manipulation**  
   • Click or tap tokens to select (DM only). Use arrow keys or your mouse to drag them around.  
   • Press “[” or “]” to move them down or up in stacking order (Z-index).  
   • Press “H” to toggle hidden from players.  
   • Press “I” to toggle if players can move them.  
   • Press “Delete” to remove them.  

6. **Music Management** 🎧  
   • Drag audio files into the “music-drop-area” or select from the “Music Manager.”  
   • Control volume, press play or pause, or remove tracks entirely.  
   • Sound syncs seamlessly for everyone!  

7. **Shortcuts** ⏩  
   • T: Toggle the DM toolbar.  
   • M: Toggle the music panel.  
   • Ctrl + D (with a token selected): Duplicate that token.  
   • Shift + D (with a scene loaded): Prompt to delete the current scene.  

---

## Project Structure 🗂️

Below is a simplified look at the files and folders:

.
├── app.js                  // Express setup  
├── controllers            // Controllers  
│   ├── musicController.js  
│   ├── sceneController.js  
│   └── uploadController.js  
├── data  
│   └── scenes             // Stored scenes data  
├── middlewares  
│   ├── multerMusic.js     // Middleware for music uploads  
│   └── multerUpload.js    // Middleware for token uploads  
├── models  
│   └── sceneModel.js      // Scene schema/model logic  
├── public                 // Static front-end content  
│   ├── css  
│   │   ├── dm.css  
│   │   └── styles.css  
│   ├── dm-login.html      
│   ├── dm.html            // DM view  
│   ├── index.html         // Landing page  
│   ├── js                 // Front-end scripts  
│   │   ├── dm.js  
│   │   ├── musicManager.js  
│   │   ├── panZoomHandler.js  
│   │   ├── player.js      // Player view script  
│   │   ├── sceneManager.js  
│   │   ├── sceneRenderer.js  
│   │   ├── tokenManager.js  
│   │   └── utils.js  
│   ├── music              // Uploaded music  
│   └── uploads            // Uploaded images/videos tokens  
├── routes.js  
├── server.js              // Server startup logic  
└── socketHandler.js       // Real-time socket.io handling  

---

## Built With 🛠️

• [Node.js](https://nodejs.org/) – The server-side runtime  
• [Express](https://expressjs.com/) – Web framework for Node.js  
• [Socket.IO](https://socket.io/) – Real-time bidirectional event-based communication  
• [Interact.js](https://interactjs.io/) – Drag-and-drop & resize library  
• [SortableJS](https://github.com/SortableJS/Sortable) – Reordering feature for scenes  
• [Multer](https://github.com/expressjs/multer) – Middleware for handling file uploads  

---

## Important Security Disclaimer ⚠️

This application is still in an experimental stage and has not been thoroughly tested or audited for vulnerabilities. Running MiniVTT on a server exposed to the internet carries inherent risks:

• Only use the application with people you trust or on secure, private networks.  
• Do not assume your data is protected—sensitive information (like tokens or scene info) might be discoverable or interceptable if proper security measures are not in place.  
• Avoid leaving the application running on a public server when not in active use.  
• Always enable HTTPS (SSL certificates) and secure WebSockets (wss) in production-like environments.  

By using this software, you acknowledge and accept any risks associated with its deployment. Please make sure to do your own security assessments. Stay safe and game on!

---
May all your rolls be crits and your stories legendary!  

// models/sceneModel.js
const path = require('path');
const fs = require('fs').promises;
const Settings = require('./settingsModel');

const SCENES_DIR = path.join(__dirname, '..', 'data', 'scenes');
const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const SAVE_INTERVAL = 1000;

// --- Trust boundary ---
// Everything arriving from a socket passes through here. A validator returns
// undefined for input it will not vouch for, so bad values are dropped rather
// than coerced into something surprising.

const finite = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const positive = (v) => (finite(v) > 0 ? v : undefined);
const flag = (v) => (typeof v === 'boolean' ? v : undefined);
const text = (v) => (typeof v === 'string' ? v.slice(0, 200) : undefined);
const id = (v) => (typeof v === 'string' && /^[\w-]{1,64}$/.test(v) ? v : undefined);
// Media has to live directly inside the directory we serve uploads from.
const mediaUrl = (v) => (typeof v === 'string' && /^\/uploads\/[^/\\]+$/.test(v) ? v : undefined);

// Token fields a client may change, and the narrower set a player may change.
const TOKEN_FIELDS = {
  x: finite,
  y: finite,
  width: positive,
  height: positive,
  rotation: finite,
  zIndex: finite,
  hidden: flag,
  movableByPlayers: flag,
  name: text,
};
const DM_FIELDS = Object.keys(TOKEN_FIELDS);
const PLAYER_FIELDS = ['x', 'y'];

function sanitizeProperties(properties, fields) {
  const clean = {};
  if (!properties || typeof properties !== 'object') return clean;
  for (const field of fields) {
    if (!(field in properties)) continue;
    const value = TOKEN_FIELDS[field](properties[field]);
    if (value !== undefined) clean[field] = value;
  }
  return clean;
}

/** Build a complete token from client input, or null if it is unusable. */
function sanitizeToken(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const tokenId = id(raw.tokenId);
  const imageUrl = mediaUrl(raw.imageUrl);
  if (!tokenId || !imageUrl) return null;

  return {
    tokenId,
    imageUrl,
    mediaType: raw.mediaType === 'video' ? 'video' : 'image',
    x: finite(raw.x) ?? 0,
    y: finite(raw.y) ?? 0,
    width: positive(raw.width) ?? 100,
    height: positive(raw.height) ?? 100,
    rotation: finite(raw.rotation) ?? 0,
    zIndex: finite(raw.zIndex) ?? 0,
    hidden: flag(raw.hidden) ?? false,
    movableByPlayers: flag(raw.movableByPlayers) ?? false,
    name: text(raw.name) ?? '',
  };
}

// --- Model ---

class SceneModel {
  constructor() {
    this.activeSceneId = null;
    this.scenes = {}; // sceneId -> scene
    this.pendingWrites = new Set(); // sceneIds awaiting a save
    this.io = null;
  }

  attach(io) {
    this.io = io;
  }

  /**
   * Read every scene into memory, making the cache the single source of truth.
   * That is what makes reference counting in pruneMedia correct, and scene
   * files are a few kilobytes each, so it stays cheap.
   */
  async load() {
    await fs.mkdir(SCENES_DIR, { recursive: true });
    const files = await fs.readdir(SCENES_DIR);

    for (const file of files.filter((name) => name.endsWith('.json'))) {
      try {
        const scene = JSON.parse(await fs.readFile(path.join(SCENES_DIR, file), 'utf8'));
        this.scenes[scene.sceneId] = scene;
        delete scene.dirty; // earlier versions persisted their save-bookkeeping

        // Stored tokens predate several fields; the write validator fills them in.
        const tokens = (scene.tokens ?? []).map(sanitizeToken).filter(Boolean);
        if (JSON.stringify(tokens) !== JSON.stringify(scene.tokens)) {
          scene.tokens = tokens;
          this.pendingWrites.add(scene.sceneId);
        }
      } catch (err) {
        console.error(`Skipping unreadable scene ${file}: ${err.message}`);
      }
    }

    console.log(`Loaded ${Object.keys(this.scenes).length} scene(s).`);
    this.saveTimer = setInterval(() => this.flush(), SAVE_INTERVAL);
    this.saveTimer.unref();
  }

  /** Mark a scene as needing a write on the next flush. */
  touch(scene) {
    this.pendingWrites.add(scene.sceneId);
  }

  async flush() {
    if (this.pendingWrites.size === 0) return;
    const sceneIds = [...this.pendingWrites];
    this.pendingWrites.clear();
    await Promise.all(sceneIds.map((sceneId) => this.write(sceneId)));
  }

  async write(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene) return;
    try {
      await fs.writeFile(
        path.join(SCENES_DIR, `${sceneId}.json`),
        JSON.stringify(scene, null, 2)
      );
    } catch (err) {
      console.error(`Failed to save scene ${sceneId}:`, err.message);
      this.pendingWrites.add(sceneId); // try again on the next tick
    }
  }

  // --- Scenes ---

  /** The view of a scene a given client is allowed to see. */
  sceneFor(sceneId, isDM) {
    const scene = this.scenes[sceneId];
    if (!scene) return null;
    if (isDM) return scene;
    return { ...scene, tokens: scene.tokens.filter((token) => !token.hidden) };
  }

  listScenes() {
    return Object.values(this.scenes)
      .map(({ sceneId, sceneName, order = 0 }) => ({ sceneId, sceneName, order }))
      .sort((a, b) => a.order - b.order);
  }

  /** Only the DM has a scene list. */
  broadcastList() {
    this.io?.to('dm').emit('sceneList', this.listScenes());
  }

  /** Show a scene to everyone, filtered per role. */
  broadcastScene(sceneId) {
    this.io?.to('dm').emit('sceneData', this.sceneFor(sceneId, true));
    this.io?.to('player').emit('sceneData', this.sceneFor(sceneId, false));
  }

  createScene(sceneName) {
    const scene = {
      sceneId: Date.now().toString(),
      sceneName: text(sceneName)?.trim() || 'Untitled Scene',
      order: Object.keys(this.scenes).length,
      tokens: [],
    };
    this.scenes[scene.sceneId] = scene;
    this.touch(scene);
    this.broadcastList();
    return scene;
  }

  renameScene(sceneId, sceneName) {
    const scene = this.scenes[sceneId];
    const name = text(sceneName)?.trim();
    if (!scene || !name) return;

    scene.sceneName = name;
    this.touch(scene);
    this.broadcastList();
  }

  /**
   * Copy a scene, tokens and all. Both point at the same media, which
   * pruneMedia counts by reference, so nothing is duplicated on disk.
   */
  duplicateScene(sceneId) {
    const source = this.scenes[sceneId];
    if (!source) return null;

    const stamp = Date.now().toString();
    const scene = {
      sceneId: stamp,
      sceneName: `${source.sceneName} copy`,
      order: Object.keys(this.scenes).length,
      // Fresh ids, so moving a token in one scene never stirs the other.
      tokens: source.tokens.map((token, index) => ({ ...token, tokenId: `${stamp}-${index}` })),
    };

    this.scenes[scene.sceneId] = scene;
    this.touch(scene);
    this.broadcastList();
    return scene;
  }

  setActiveScene(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene) return;

    const arrived = this.activeSceneId !== sceneId;
    this.activeSceneId = sceneId;
    this.broadcastScene(sceneId);

    // Reselecting the scene already on the table is a refresh, not an arrival.
    if (arrived) Settings.announce('scene', scene.sceneName);
  }

  async deleteScene(sceneId) {
    const scene = this.scenes[sceneId];
    if (!scene) return;

    delete this.scenes[sceneId];
    this.pendingWrites.delete(sceneId);
    if (this.activeSceneId === sceneId) this.activeSceneId = null;

    // Anyone showing this scene clears it; anyone else ignores it.
    this.io?.emit('sceneDeleted', { sceneId });
    this.broadcastList();

    await fs.unlink(path.join(SCENES_DIR, `${sceneId}.json`)).catch(() => {});
    await this.pruneMedia(scene.tokens.map((token) => token.imageUrl));
  }

  reorderScenes(sceneOrder) {
    if (!Array.isArray(sceneOrder)) return;

    sceneOrder.forEach((sceneId, index) => {
      const scene = this.scenes[sceneId];
      if (!scene) return;
      scene.order = index;
      this.touch(scene);
    });
    this.broadcastList();
  }

  // --- Tokens ---

  addToken(sceneId, raw, socket) {
    const scene = this.scenes[sceneId];
    if (!scene) return;

    const token = sanitizeToken(raw);
    if (!token) return;

    scene.tokens.push(token);
    this.touch(scene);

    socket.broadcast.to('dm').emit('addToken', { sceneId, token });
    // A hidden token is never mentioned to players, not even to be ignored.
    if (!token.hidden) socket.broadcast.to('player').emit('addToken', { sceneId, token });
  }

  updateToken(sceneId, tokenId, properties, socket) {
    const scene = this.scenes[sceneId];
    const token = scene?.tokens.find((t) => t.tokenId === tokenId);
    if (!token) return;

    // Players may only move tokens the DM has explicitly released to them.
    const isDM = Boolean(socket.isDM);
    if (!isDM && !(token.movableByPlayers && !token.hidden)) return;

    const changes = sanitizeProperties(properties, isDM ? DM_FIELDS : PLAYER_FIELDS);
    if (Object.keys(changes).length === 0) return;

    const wasHidden = Boolean(token.hidden);
    Object.assign(token, changes);
    this.touch(scene);

    socket.broadcast.to('dm').emit('updateToken', { sceneId, tokenId, properties: changes });

    // Players see a visibility change as the token appearing or disappearing,
    // since they were never told it existed while hidden.
    if (wasHidden !== Boolean(token.hidden)) {
      if (token.hidden) socket.broadcast.to('player').emit('removeToken', { sceneId, tokenId });
      else socket.broadcast.to('player').emit('addToken', { sceneId, token });
    } else if (!token.hidden) {
      socket.broadcast.to('player').emit('updateToken', { sceneId, tokenId, properties: changes });
    }
  }

  async removeToken(sceneId, tokenId, socket) {
    const scene = this.scenes[sceneId];
    if (!scene) return;

    const index = scene.tokens.findIndex((token) => token.tokenId === tokenId);
    if (index === -1) return;

    const [token] = scene.tokens.splice(index, 1);
    this.touch(scene);

    socket.broadcast.emit('removeToken', { sceneId, tokenId });
    await this.pruneMedia([token.imageUrl]);
  }

  /**
   * Delete media no scene references any more. This depends on every scene
   * being in memory: an earlier version scanned only the loaded ones, and so
   * deleted images that were still in use elsewhere.
   */
  async pruneMedia(imageUrls) {
    const inUse = new Set();
    for (const scene of Object.values(this.scenes)) {
      for (const token of scene.tokens) inUse.add(token.imageUrl);
    }

    for (const imageUrl of new Set(imageUrls)) {
      if (!imageUrl || inUse.has(imageUrl)) continue;

      const file = path.join(PUBLIC_DIR, decodeURIComponent(imageUrl));
      if (!file.startsWith(PUBLIC_DIR + path.sep)) continue; // never escape public/

      try {
        await fs.unlink(file);
        console.log(`Removed unreferenced media: ${imageUrl}`);
      } catch (err) {
        if (err.code !== 'ENOENT') console.error(`Failed to remove ${imageUrl}:`, err.message);
      }
    }
  }
}

module.exports = new SceneModel();

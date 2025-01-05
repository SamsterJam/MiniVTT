// models/sceneModel.js
const path = require('path');
const fs = require('fs').promises;

class SceneModel {
  constructor() {
    this.activeSceneId = null;
    this.scenes = {};
    // Start periodic saving
    this.startAutoSave();
  }

  startAutoSave() {
    const SAVE_INTERVAL = 1000; // milliseconds
    setInterval(() => {
      Object.values(this.scenes).forEach(scene => {
        if (scene.dirty) {
          this.saveScene(scene);
          scene.dirty = false;
        }
      });
    }, SAVE_INTERVAL);
  }

  addScene(scene) {
    this.scenes[scene.sceneId] = scene;
  }

  async loadScene(sceneId) {
    if (this.scenes[sceneId]) {
      return this.scenes[sceneId];
    }
    const filePath = path.join(__dirname, '..', 'data', 'scenes', `${sceneId}.json`);
    try {
      const data = await fs.readFile(filePath, 'utf8');
      const scene = JSON.parse(data);
      this.scenes[sceneId] = scene;
      console.log(`Scene ${sceneId} loaded.`);
      return scene;
    } catch (err) {
      console.error('Error loading scene:', err);
      throw err;
    }
  }

  async saveScene(scene) {
    const filePath = path.join(__dirname, '..', 'data', 'scenes', `${scene.sceneId}.json`);
    try {
      await fs.writeFile(filePath, JSON.stringify(scene, null, 2));
      console.log(`Scene ${scene.sceneId} saved.`);
    } catch (err) {
      console.error('Error saving scene:', err);
    }
  }

  changeActiveScene(sceneId) {
    this.activeSceneId = sceneId;
  }

  async getAllScenes() {
    const scenesDir = path.join(__dirname, '..', 'data', 'scenes');
    const files = await fs.readdir(scenesDir);
    const sceneFiles = files.filter(file => file.endsWith('.json'));
    const scenes = [];

    for (const file of sceneFiles) {
      const filePath = path.join(scenesDir, file);
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const scene = JSON.parse(data);
        scenes.push({
          sceneId: scene.sceneId,
          sceneName: scene.sceneName,
          order: scene.order || 0,
        });
      } catch (err) {
        console.error('Error reading scene file:', err);
      }
    }

    scenes.sort((a, b) => a.order - b.order);
    return scenes;
  }

  async updateScene(scene) {
    this.scenes[scene.sceneId] = scene;
    scene.dirty = true;
  }

  async deleteScene(sceneId) {
    const scene = this.scenes[sceneId];
    if (scene) {
      // Delete scene file
      const filePath = path.join(__dirname, '..', 'data', 'scenes', `${sceneId}.json`);
      await fs.unlink(filePath);
      delete this.scenes[sceneId];

      // Delete unused images
      for (const token of scene.tokens) {
        const imageUrl = token.imageUrl;
        const isUsedElsewhere = await this.isImageUsedElsewhere(imageUrl);
        if (!isUsedElsewhere) {
          const imagePath = path.join(__dirname, '..', 'public', imageUrl);
          try {
            await fs.unlink(imagePath);
            console.log('Deleted unused image file:', imagePath);
          } catch (err) {
            console.error('Error deleting image file:', err);
          }
        }
      }
    } else {
      throw new Error('Scene not found.');
    }
  }

  async updateSceneOrder(sceneOrder) {
    for (let i = 0; i < sceneOrder.length; i++) {
      const sceneId = sceneOrder[i];
      const scene = await this.loadScene(sceneId);
      scene.order = i;
      await this.saveScene(scene);
    }
  }

  // Token operations
  updateToken(sceneId, tokenId, properties, socket) {
    const scene = this.scenes[sceneId];
    if (scene) {
      const token = scene.tokens.find(t => t.tokenId === tokenId);
      if (token) {
        Object.assign(token, properties);
        scene.dirty = true;
        socket.broadcast.emit('updateToken', { sceneId, tokenId, properties });
      }
    }
  }

  addToken(sceneId, token, io) {
    const scene = this.scenes[sceneId];
    if (scene) {
      scene.tokens.push(token);
      scene.dirty = true;
      io.emit('addToken', { sceneId, token });
    }
  }

  async removeToken(sceneId, tokenId, io) {
    const scene = this.scenes[sceneId];
    if (scene) {
      const tokenIndex = scene.tokens.findIndex(t => t.tokenId === tokenId);
      if (tokenIndex !== -1) {
        const token = scene.tokens[tokenIndex];
        const imageUrl = token.imageUrl;
        scene.tokens.splice(tokenIndex, 1);
        scene.dirty = true;

        const isUsedElsewhere = await this.isImageUsedElsewhere(imageUrl);

        if (!isUsedElsewhere) {
          const imagePath = path.join(__dirname, '..', 'public', imageUrl);
          try {
            await fs.unlink(imagePath);
            console.log('Deleted unused image file:', imagePath);
          } catch (err) {
            console.error('Error deleting image file:', err);
          }
        }

        io.emit('removeToken', { sceneId, tokenId });
      }
    }
  }

  async isImageUsedElsewhere(imageUrl) {
    for (const sceneId in this.scenes) {
      const scene = this.scenes[sceneId];
      for (const token of scene.tokens) {
        if (token.imageUrl === imageUrl) {
          return true;
        }
      }
    }
    return false;
  }
}

module.exports = new SceneModel();
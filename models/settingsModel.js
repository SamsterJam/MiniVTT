// models/settingsModel.js
const path = require('path');
const fs = require('fs').promises;

const SETTINGS_FILE = path.join(__dirname, '..', 'data', 'settings.json');

// Every setting there is, and the value it starts at. A key that is not here
// is not a setting.
const DEFAULTS = {
  announceMusic: true,
  announceScene: true,
};

// The switch behind each kind of announcement.
const ANNOUNCE_SETTING = {
  music: 'announceMusic',
  scene: 'announceScene',
};

/**
 * The DM's switches, and the gate every player announcement passes through.
 * Kept here rather than in a browser, so a restart or a second tab finds the
 * same state.
 */
class SettingsModel {
  constructor() {
    this.settings = { ...DEFAULTS };
    this.io = null;
  }

  attach(io) {
    this.io = io;
  }

  async load() {
    try {
      const parsed = JSON.parse(await fs.readFile(SETTINGS_FILE, 'utf8'));
      for (const key of Object.keys(DEFAULTS)) {
        if (typeof parsed?.[key] === 'boolean') this.settings[key] = parsed[key];
      }
    } catch (err) {
      // No file yet is the ordinary first run; anything else is a fault.
      if (err.code !== 'ENOENT') console.error(`Could not read settings: ${err.message}`);
    }
  }

  async save() {
    try {
      await fs.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      await fs.writeFile(SETTINGS_FILE, JSON.stringify(this.settings, null, 2));
    } catch (err) {
      console.error(`Could not save settings: ${err.message}`);
    }
  }

  state() {
    return { ...this.settings };
  }

  /** Only the DM has settings to see. */
  broadcast() {
    this.io?.to('dm').emit('settings', this.state());
  }

  set(key, value) {
    // hasOwn, not `in`: `constructor` is not a setting.
    if (!Object.hasOwn(DEFAULTS, key) || typeof value !== 'boolean') return;
    if (this.settings[key] === value) return;

    this.settings[key] = value;
    this.broadcast();
    this.save();
  }

  /**
   * Tell the players, if the DM has asked for it. Every announcement comes
   * through here, so the switch is honoured in one place.
   */
  announce(channel, text) {
    const setting = ANNOUNCE_SETTING[channel];
    if (!setting || !this.settings[setting] || !text) return;

    this.io?.to('player').emit('announce', { channel, text });
  }
}

module.exports = new SettingsModel();

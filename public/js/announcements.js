// public/js/announcements.js
// The player's title card. One shows at a time, and the CSS owns its whole
// life, so this only mounts a card and clears up when the animation ends.
//
// A channel has one current value, so it never queues behind itself: a newer
// notice replaces the older one, waiting or on screen. Nothing stale is shown.

import { music, scene } from './icons.js';

const CHANNELS = {
  music: { icon: music, label: 'Now playing' },
  scene: { icon: scene, label: 'Now entering' },
};

let current = null; // { channel, element } on screen
const waiting = new Map(); // channel -> its one waiting notice

function build(channel, text) {
  const { icon, label } = CHANNELS[channel];

  const element = document.createElement('div');
  element.className = 'announcement';
  element.innerHTML = `
    <span class="announcement-label">
      <span class="announcement-icon">${icon}</span>
      <span class="announcement-kind"></span>
    </span>
    <span class="announcement-name"></span>`;

  // The DM's own text, so it goes in as text.
  element.querySelector('.announcement-kind').textContent = label;
  element.querySelector('.announcement-name').textContent = text;

  element.addEventListener(
    'animationend',
    () => {
      if (current?.element !== element) return; // superseded; it lost the slot
      current = null;
      element.remove();
      next();
    },
    { once: true }
  );

  return element;
}

function show(channel, text) {
  const host = document.getElementById('announcements');
  if (!host) return;

  waiting.delete(channel); // a channel is never in two places at once
  const element = build(channel, text);
  current = { channel, element };

  // replaceChildren, not append: a card being replaced goes now, rather than
  // finishing a fade nobody is reading.
  host.replaceChildren(element);
}

function next() {
  const [oldest] = waiting; // [channel, text], or undefined when nothing waits
  if (oldest) show(...oldest);
}

/** Show a notice in the middle of the screen. Unknown channels are ignored. */
export function announce({ channel, text } = {}) {
  if (!CHANNELS[channel] || !text) return;

  // Another channel is on screen; this one waits, replacing anything it queued.
  if (current && current.channel !== channel) {
    waiting.set(channel, text);
    return;
  }

  show(channel, text);
}

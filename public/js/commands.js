// public/js/commands.js
//
// Every DM action, once. The keyboard handler, the selection bar, and the
// shortcut overlay are all generated from this table, so they cannot drift.
//
//   key             the combo that runs it, or a label when `doc` is set
//   bar             show it in the selection bar, in this order
//   needsSelection  ignore it while nothing is selected
//   active(tokens)  the toggle is lit when this holds for every selected token
//   doc             documentation only; there is nothing to run

import { eyeOff, players, layerUp, layerDown, duplicate, trash } from './icons.js';

export const COMMANDS = [
  // --- Scenes ---
  { group: 'Scenes', key: 'n', label: 'New scene', run: (app) => app.promptNewScene() },
  { group: 'Scenes', key: 'f2', label: 'Rename scene', run: (app) => app.promptRenameScene() },
  { group: 'Scenes', key: 'shift+d', label: 'Delete scene', run: (app) => app.confirmDeleteScene() },
  { group: 'Scenes', key: 'Drag tab', label: 'Reorder scenes', doc: true },
  { group: 'Scenes', key: 'Right click', label: 'Scene menu', doc: true },

  // --- Tokens ---
  {
    group: 'Tokens',
    key: 'h',
    label: 'Hide from players',
    icon: eyeOff,
    bar: true,
    needsSelection: true,
    active: (tokens) => tokens.every((token) => token.hidden),
    run: (app) => app.toggleTokenFlag('hidden'),
  },
  {
    group: 'Tokens',
    key: 'i',
    label: 'Let players move it',
    icon: players,
    bar: true,
    needsSelection: true,
    active: (tokens) => tokens.every((token) => token.movableByPlayers),
    run: (app) => app.toggleTokenFlag('movableByPlayers'),
  },
  {
    group: 'Tokens',
    key: ']',
    label: 'Bring forward',
    icon: layerUp,
    bar: true,
    needsSelection: true,
    run: (app) => app.moveLayer(1),
  },
  {
    group: 'Tokens',
    key: '[',
    label: 'Send backward',
    icon: layerDown,
    bar: true,
    needsSelection: true,
    run: (app) => app.moveLayer(-1),
  },
  {
    group: 'Tokens',
    key: 'ctrl+d',
    label: 'Duplicate',
    icon: duplicate,
    bar: true,
    needsSelection: true,
    run: (app) => app.duplicateSelection(),
  },
  {
    group: 'Tokens',
    key: 'delete',
    label: 'Delete',
    icon: trash,
    bar: true,
    danger: true,
    needsSelection: true,
    run: (app) => app.deleteSelection(),
  },
  { group: 'Tokens', key: 'Arrows', label: 'Nudge (Shift for 10x)', doc: true },

  // --- Selecting ---
  { group: 'Selecting', key: 'ctrl+a', label: 'Select all', run: (app) => app.selectAll() },
  { group: 'Selecting', key: 'escape', label: 'Clear selection', run: (app) => app.setSelection([]) },
  { group: 'Selecting', key: 'Shift click', label: 'Add or remove one', doc: true },
  { group: 'Selecting', key: 'Drag canvas', label: 'Marquee select', doc: true },

  // --- View ---
  { group: 'View', key: 't', label: 'Toggle toolbar', run: (app) => app.toggleToolbar() },
  { group: 'View', key: 'm', label: 'Toggle music panel', run: (app) => app.toggleMusic() },
  { group: 'View', key: '?', label: 'Toggle this list', run: (app) => app.toggleHelp() },
  { group: 'View', key: 'Wheel', label: 'Zoom', doc: true },
  { group: 'View', key: 'Middle drag', label: 'Pan', doc: true },
  { group: 'View', key: 'Drop files', label: 'Add tokens or music', doc: true },
];

export const BAR_COMMANDS = COMMANDS.filter((command) => command.bar);

/**
 * Name the combo an event represents. Shift only prefixes keys whose identity
 * it leaves alone: Shift+D is still "d", but Shift+/ is already "?".
 */
export function comboFor(event) {
  const key = event.key.toLowerCase();
  const parts = [];

  if (event.ctrlKey || event.metaKey) parts.push('ctrl');
  if (event.shiftKey && /^[a-z]$/.test(key)) parts.push('shift');
  parts.push(key);

  return parts.join('+');
}

const KEY_NAMES = {
  ctrl: 'Ctrl',
  shift: 'Shift',
  escape: 'Esc',
  delete: 'Del',
  f2: 'F2',
};

/** How a combo is written on a button or in the shortcut list. */
export function keyLabel(key) {
  return key
    .split('+')
    .map((part) => KEY_NAMES[part] ?? (part.length === 1 ? part.toUpperCase() : part))
    .join(' ');
}

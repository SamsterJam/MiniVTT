// public/js/ui.js
// Replaces prompt/confirm/alert. Built on <dialog method="dialog">, so focus
// trapping, Escape, and the backdrop are the browser's job.

const TOAST_MS = 4200;

// --- Dialog behaviour ---
// What <dialog> does not do by itself.

// Which kind of press came last, since only the keyboard wants its focus back.
let fromPointer = false;
document.addEventListener('pointerdown', () => (fromPointer = true), true);
document.addEventListener('keydown', () => (fromPointer = false), true);

/** Show a dialog modally. The browser owns Escape, focus, and the backdrop. */
export function openDialog(dialog) {
  // Closing hands focus back to whatever opened this, and the ring lights up
  // on it either way. If the pointer put it there, drop it first.
  if (fromPointer) document.activeElement?.blur();
  dialog.showModal();
}

/**
 * Close a dialog on a click outside its card, the same as Escape. Press and
 * release both have to land on the backdrop, or dragging a selection out of
 * the card would dismiss it.
 */
export function dismissOnBackdrop(dialog) {
  let onBackdrop = false;

  // The backdrop is the dialog's own box; anything in the card is a child.
  dialog.addEventListener('mousedown', (event) => (onBackdrop = event.target === dialog));
  dialog.addEventListener('click', (event) => {
    if (onBackdrop && event.target === dialog) dialog.close();
  });
}

/**
 * A modal card. Actions render in reverse, so the confirming button is first in
 * the DOM -- the one Enter submits -- while still sitting on the right.
 */
function card(html) {
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form method="dialog" class="dialog-card surface">${html}</form>`;
  dialog.addEventListener('close', () => dialog.remove());
  dismissOnBackdrop(dialog); // dismissing is a cancel, as Escape is
  document.body.append(dialog);
  return dialog;
}

/** Ask a yes/no question. Resolves false if dismissed. */
export function confirmDialog({ title, body = '', confirm = 'Confirm', danger = false }) {
  const dialog = card(`
    <h2></h2>
    <p></p>
    <div class="dialog-actions">
      <button class="btn ${danger ? 'solid-danger' : 'primary'}" value="ok"></button>
      <button class="btn" value="cancel">Cancel</button>
    </div>
  `);

  // Titles carry scene and file names: text, never HTML.
  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('p').textContent = body;
  dialog.querySelector('p').hidden = !body;
  dialog.querySelector('[value="ok"]').textContent = confirm;

  return new Promise((resolve) => {
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'ok'), { once: true });
    openDialog(dialog);
  });
}

/** Ask for a line of text. Resolves null if dismissed or left blank. */
export function promptDialog({ title, value = '', placeholder = '', confirm = 'Save' }) {
  const dialog = card(`
    <h2></h2>
    <input class="dialog-input" autocomplete="off" spellcheck="false">
    <div class="dialog-actions">
      <button class="btn primary" value="ok"></button>
      <button class="btn" value="cancel">Cancel</button>
    </div>
  `);

  dialog.querySelector('h2').textContent = title;
  dialog.querySelector('[value="ok"]').textContent = confirm;

  const input = dialog.querySelector('input');
  input.value = value;
  input.placeholder = placeholder;

  return new Promise((resolve) => {
    dialog.addEventListener(
      'close',
      () => resolve(dialog.returnValue === 'ok' ? input.value.trim() || null : null),
      { once: true }
    );
    openDialog(dialog);
    input.select();
  });
}

/** A passing message. Errors linger in the corner instead of blocking the page. */
export function toast(message, type = 'info') {
  const host = document.getElementById('toasts');
  if (!host) return;

  const element = document.createElement('div');
  element.className = `toast surface ${type}`;
  element.textContent = message;
  host.append(element);

  setTimeout(() => {
    element.classList.add('leaving');
    element.addEventListener('transitionend', () => element.remove(), { once: true });
  }, TOAST_MS);
}

// --- Context menu ---
// Only ever one at a time, so it is tracked in a single slot.

let openMenu = null;

function closeMenu() {
  openMenu?.remove();
  openMenu = null;
}

document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.context-menu')) closeMenu();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeMenu();
});

/** Open a menu at the pointer. Items are `{ label, danger, onSelect }`. */
export function contextMenu(event, items) {
  event.preventDefault();
  closeMenu();

  const menu = document.createElement('div');
  menu.className = 'context-menu surface';

  for (const { label, danger, onSelect } of items) {
    const button = document.createElement('button');
    button.className = `btn${danger ? ' danger' : ''}`;
    button.textContent = label;
    button.addEventListener('click', () => {
      closeMenu();
      onSelect();
    });
    menu.append(button);
  }

  document.body.append(menu);
  openMenu = menu;

  // Measured after mounting, so a menu near an edge folds back on screen.
  const { width, height } = menu.getBoundingClientRect();
  menu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 8)}px`;
  menu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 8)}px`;
}

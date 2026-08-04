// public/js/icons.js
// Inline SVGs, so the app carries no icon font and needs no CDN.

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" fill-rule="evenodd" aria-hidden="true">${paths}</svg>`;

// --- Transport ---

export const play = icon('<path d="M8 5v14l11-7z"/>');
export const pause = icon('<path d="M6 5h3.5v14H6zM14.5 5H18v14h-3.5z"/>');

// --- Chrome ---

export const plus = icon('<path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z"/>');

export const music = icon(
  '<path d="M20 3v12.75a3.25 3.25 0 1 1-2-3V8.3l-8 1.6v7.85a3.25 3.25 0 1 1-2-3V6.6z"/>'
);

const tooth = (deg) =>
  `<rect x="10.3" y="1.5" width="3.4" height="6" rx="0.8" transform="rotate(${deg} 12 12)"/>`;

// A ring with its middle punched out by the fill rule, and eight teeth spun
// around the box.
export const settings = icon(
  '<path d="M12 4.4a7.6 7.6 0 1 1 0 15.2 7.6 7.6 0 0 1 0-15.2zm0 4.2a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>' +
    [0, 45, 90, 135, 180, 225, 270, 315].map(tooth).join('')
);

export const help = icon(
  '<path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16z"/>' +
    '<path d="M12 6.2c-1.8 0-3 .9-3.5 2.5l1.9.7c.2-.8.7-1.3 1.5-1.3.8 0 1.3.4 1.3 1.1 0 .5-.2.8-.9 1.3-1 .7-1.5 1.3-1.5 2.6v.4h2v-.3c0-.6.2-.8.8-1.2 1-.7 1.6-1.4 1.6-2.7 0-1.8-1.4-3.1-3.2-3.1z"/>' +
    '<path d="M12 15.6a1.25 1.25 0 1 1 0 2.5 1.25 1.25 0 0 1 0-2.5z"/>'
);

export const close = icon(
  '<path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12 19 17.6 17.6 19 12 13.4 6.4 19 5 17.6 10.6 12 5 6.4z"/>'
);

// --- Announcements ---

export const scene = icon(
  '<path d="M2.5 4h19A1.5 1.5 0 0 1 23 5.5v13a1.5 1.5 0 0 1-1.5 1.5h-19A1.5 1.5 0 0 1 1 18.5v-13A1.5 1.5 0 0 1 2.5 4zM3 6v12h18V6z"/>' +
    '<path d="M6.8 7.5a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z"/>' +
    '<path d="M3 18h18l-7.5-5-3 2.5L7 12l-4 4z"/>'
);

// --- Token actions ---

export const eyeOff = icon(
  '<path d="M2.8 3.5 20.5 21.2l-1.4 1.4-3.1-3.1c-1.2.4-2.6.6-4 .6-5.2 0-9.5-4.6-9.5-7 0-1.4 1.2-3.2 3-4.7L1.4 4.9zm5.4 8.2a3.8 3.8 0 0 0 5.1 5.1z"/>' +
    '<path d="M12 4.9c5.2 0 9.5 4.6 9.5 7 0 1-.7 2.4-2 3.7l-4-4a3.8 3.8 0 0 0-4.2-4.2L9.6 5.3c.8-.3 1.6-.4 2.4-.4z"/>'
);

export const players = icon(
  '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0 1.8c-3.4 0-6 1.8-6 4.1V20h12v-3.1c0-2.3-2.6-4.1-6-4.1z"/>' +
    '<path d="M17.4 11a3.4 3.4 0 1 0 0-6.8 3.4 3.4 0 0 0 0 6.8zm.1 1.8c-.9 0-1.7.1-2.4.4 1.4 1 2.2 2.4 2.2 4v2.8H23v-3c0-2.3-2.4-4.2-5.5-4.2z"/>'
);

export const layerUp = icon('<path d="M12 2.5 18.5 9H14v7h-4V9H5.5z"/><path d="M4 19h16v2.5H4z"/>');
export const layerDown = icon('<path d="M12 21.5 5.5 15H10V8h4v7h4.5z"/><path d="M4 2.5h16V5H4z"/>');

export const duplicate = icon(
  '<path d="M8 2h11a1 1 0 0 1 1 1v11h-2.5V4.5H8z"/>' +
    '<path d="M4 6h11a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zm1.5 2.5v11h8v-11z"/>'
);

// Dots spread the full height of the box, or the glyph reads as a smudge.
export const grip = icon(
  '<path d="M12 2.5a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm0 7.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2zm0 7.4a2.1 2.1 0 1 1 0 4.2 2.1 2.1 0 0 1 0-4.2z"/>'
);

export const trash = icon(
  '<path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/>'
);

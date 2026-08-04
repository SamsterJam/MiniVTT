// public/js/icons.js
// Three inline SVGs, so the app carries no icon font and needs no CDN.

const icon = (paths) =>
  `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${paths}</svg>`;

export const play = icon('<path d="M8 5v14l11-7z"/>');
export const pause = icon('<path d="M6 5h3.5v14H6zM14.5 5H18v14h-3.5z"/>');
export const trash = icon(
  '<path d="M9 3h6l1 2h4v2H4V5h4zM6 9h12l-1 11a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2z"/>'
);

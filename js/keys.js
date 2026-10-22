/* The keys the ? panel shows. Press ? (Shift + /) in the game, or tap the round ? button.
   The panel and the freeze live in the shared kit: kit/help.js (Kit.help). */
Kit.help.setup({
  title: window.SEA_TITLE, // the name lives in js/title.js
  button: { top: 'var(--kh-top)' }, // index.html moves it (and the language button) to the bottom left on tall screens
  keys: [
    ['aim at a square · shoot', '← ↑ → ↓ · Enter or Space'],
    ['hiding your ships: shuffle them · ready', 'S · Enter'],
    ['call your brother (2 players: high five)', 'T'],
    ['new game', 'R'],
    ['pause · sound', 'P or Esc · M'],
    ['menu: LITTLE SEA 8 × 8 · BIG SEA 10 × 10', '1 · 2'],
    ['menu: Teddy or Tommy · 1 or 2 players · level', '← → · ↑ ↓ · L'],
  ],
  note: 'Hide your ships, then take turns shooting at the other sea. SPLASH is water, BONK is a ship. Bonk every square of a ship to sink it; ships never touch, so the water round a sunk ship is marked clear. Sink the whole fleet to win!',
  touch: 'Drag a ship to move it, tap it to turn it. Tap a square on the other sea to shoot. Tap your brother\'s face (bottom right) to call him.',
});
Kit.lang.setup({ button: { top: 'var(--kl-top)' } });

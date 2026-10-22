/* TT Sea Battle: the rules and the CPU. No Three.js and no page in here: the game and the headless checks
   (js/check.js, tools/check.js) run this same file.

   Each player hides a fleet on their own sea, n x n squares (8 x 8 LITTLE SEA for Tommy, 10 x 10 BIG SEA for Teddy);
   square i = row * n + col, from the top left. Ships lie straight, across or down, and never touch, not even corner
   to corner. The players take turns calling one shot at the other sea: SPLASH (water) or BONK (a ship). A ship with
   every square bonked is SUNK, and the water all round it is marked clear (nothing can be there, because ships never
   touch). You can't shoot a square twice, or a square marked clear. Sink the whole fleet to win.

   The CPU (cpuShot) only sees what a player sees: the splashes, the bonks, the sunk ships and the clear water, never
   where the ships are hidden.
     🐣 EASY    for Tommy (5). Shoots at random. After a bonk it tries the square next door now and then (EASY.follow).
     🔥 NORMAL  for Teddy (8). A probability hunt: it counts every way each ship still afloat could lie, given what it
               knows, and shoots the square most of them cover. After a bonk the ways through that bonk count far
               more, so it finishes the ship off. NORMAL.slip: how often it takes a less likely square (while hunting, any square a ship could be on; after a bonk, any square next to one)
               (so Teddy can win). The brother's tip (hint) is the same hunt with no slips. */
(function (root) {
  'use strict';
  const SEA = (root.SEA = root.SEA || {});

  const KINDS = {
    giant: { len: 5, name: 'GIANT SHIP' },
    big: { len: 4, name: 'BIG SHIP' },
    sub: { len: 3, name: 'SUBMARINE' },
    speed: { len: 3, name: 'SPEEDBOAT' },
    tug: { len: 2, name: 'LITTLE TUG' },
  };
  const FLEET = { 8: ['big', 'sub', 'speed', 'tug'], 10: ['giant', 'big', 'sub', 'speed', 'tug'] };
  const SIZES = [8, 10];
  const EASY = { follow: 0.35 };
  const NORMAL = { slip: 0.5 };
  // shot[i]: what a square shows
  const NONE = 0, MISS = 1, HIT = 2, SUNK = 3;

  const rowOf = (n, i) => Math.floor(i / n), colOf = (n, i) => i % n;

  // the squares of a ship lying from (r, c), across (dir 0) or down (dir 1); null if it sticks out of the sea
  function cellsAt(n, len, r, c, dir) {
    const out = [];
    for (let k = 0; k < len; k++) {
      const rr = r + (dir ? k : 0), cc = c + (dir ? 0 : k);
      if (rr < 0 || cc < 0 || rr >= n || cc >= n) return null;
      out.push(rr * n + cc);
    }
    return out;
  }
  const cellsOf = (n, s) => cellsAt(n, s.len, s.r, s.c, s.dir);

  // the squares all round some squares (the 8 neighbours of each), not counting the squares themselves
  function ring(n, cells) {
    const inside = new Set(cells), out = new Set();
    for (const i of cells) {
      const r = rowOf(n, i), c = colOf(n, i);
      for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
        const rr = r + dr, cc = c + dc;
        if (rr < 0 || cc < 0 || rr >= n || cc >= n) continue;
        const j = rr * n + cc;
        if (!inside.has(j)) out.add(j);
      }
    }
    return [...out];
  }

  // The headless checks (js/check.js) break a rule on purpose through this switch, to prove a check can fail:
  // 'overlap' ships may overlap and touch, 'nosink' a ship is never sunk. Always null in the game.
  const TEST = { sabotage: null };

  // ---------------------------------------------------------------- hiding the fleet

  // An empty sea with the fleet for its size, not placed yet.
  function newSea(n) {
    return {
      n,
      ships: FLEET[n].map((kind) => ({ kind, len: KINDS[kind].len, r: -1, c: -1, dir: 0, hits: 0, sunk: false })),
      at: new Int8Array(n * n), // which ship is on a square (index + 1), 0 for water: hidden from the other player
      shot: new Uint8Array(n * n),
      water: new Uint8Array(n * n), // 1: marked clear round a sunk ship
      shots: 0, hits: 0, sunk: 0,
    };
  }

  // Can ship k lie at (r, c, dir), with the other ships where they are? (in the sea, no overlap, no touching)
  function fits(sea, k, r, c, dir) {
    const n = sea.n, s = sea.ships[k];
    const cells = cellsAt(n, s.len, r, c, dir);
    if (!cells) return false;
    if (TEST.sabotage === 'overlap') return true;
    for (const i of cells.concat(ring(n, cells))) {
      const o = sea.at[i];
      if (o && o - 1 !== k) return false;
    }
    return true;
  }

  function lift(sea, k) {
    const s = sea.ships[k];
    if (s.r < 0) return;
    for (const i of cellsOf(sea.n, s)) if (sea.at[i] === k + 1) sea.at[i] = 0;
  }
  function put(sea, k) {
    for (const i of cellsOf(sea.n, sea.ships[k])) if (!sea.at[i]) sea.at[i] = k + 1;
  }

  // Move ship k to (r, c, dir) if it fits there. Returns true if it moved.
  function moveShip(sea, k, r, c, dir = sea.ships[k].dir) {
    const s = sea.ships[k];
    lift(sea, k);
    if (!fits(sea, k, r, c, dir)) {
      if (s.r >= 0) put(sea, k);
      return false;
    }
    Object.assign(s, { r, c, dir });
    put(sea, k);
    return true;
  }

  // Turn ship k round (across <-> down) about its first square; if it doesn't fit there, the nearest spot it fits.
  function rotateShip(sea, k) {
    const s = sea.ships[k], dir = 1 - s.dir, n = sea.n;
    if (moveShip(sea, k, s.r, s.c, dir)) return true;
    let near = null;
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
      const d = Math.abs(r - s.r) + Math.abs(c - s.c);
      if ((!near || d < near.d) && fits(sea, k, r, c, dir)) near = { r, c, d }; // fits() ignores ship k's own squares
    }
    return near ? moveShip(sea, k, near.r, near.c, dir) : false;
  }

  // Hide the whole fleet at random (biggest ship first; starts over if a ship has nowhere to go).
  function randomPlace(sea, rng = Math.random) {
    const n = sea.n;
    for (let attempt = 0; attempt < 200; attempt++) {
      sea.at.fill(0);
      sea.ships.forEach((s) => Object.assign(s, { r: -1, c: -1 }));
      let ok = true;
      for (let k = 0; k < sea.ships.length && ok; k++) {
        ok = false;
        for (let t = 0; t < 300; t++) {
          const dir = rng() < 0.5 ? 0 : 1;
          const r = Math.floor(rng() * n), c = Math.floor(rng() * n);
          if (fits(sea, k, r, c, dir)) {
            Object.assign(sea.ships[k], { r, c, dir });
            put(sea, k);
            ok = true;
            break;
          }
        }
      }
      if (ok) return sea;
    }
    throw new Error('no room for the fleet');
  }

  // Is this sea's fleet hidden by the rules? Returns null if so, else what's wrong.
  function checkFleet(sea) {
    const n = sea.n, want = FLEET[n];
    if (!want) return 'no such sea size';
    if (sea.ships.length !== want.length) return 'wrong number of ships';
    const grid = new Int8Array(n * n);
    for (let k = 0; k < sea.ships.length; k++) {
      const s = sea.ships[k];
      if (s.kind !== want[k] || s.len !== KINDS[want[k]].len) return `ship ${k} is the wrong ship`;
      if (s.dir !== 0 && s.dir !== 1) return `ship ${k} isn't straight`;
      const cells = cellsOf(n, s);
      if (!cells) return `ship ${k} sticks out of the sea`;
      for (const i of cells) {
        if (grid[i]) return `ships ${grid[i] - 1} and ${k} overlap`;
        grid[i] = k + 1;
      }
    }
    for (let k = 0; k < sea.ships.length; k++) {
      for (const i of ring(n, cellsOf(n, sea.ships[k]))) if (grid[i] && grid[i] !== k + 1) return `ships ${grid[i] - 1} and ${k} touch`;
    }
    for (let i = 0; i < n * n; i++) if (grid[i] !== sea.at[i]) return 'the ship map is out of step';
    return null;
  }

  // ---------------------------------------------------------------- shooting

  const canShoot = (sea, i) => i >= 0 && i < sea.n * sea.n && !sea.shot[i] && !sea.water[i];

  // Fire at square i of a sea. Returns null if it can't be shot, else
  // { cell, result: 'miss' | 'hit' | 'sunk', ship (index, on a hit), cells (a sunk ship's), water (newly cleared), win }.
  function fire(sea, i) {
    if (!canShoot(sea, i)) return null;
    sea.shots++;
    const k = sea.at[i] - 1;
    if (k < 0) {
      sea.shot[i] = MISS;
      return { cell: i, result: 'miss', ship: -1, cells: null, water: [], win: false };
    }
    const s = sea.ships[k];
    sea.shot[i] = HIT;
    sea.hits++;
    s.hits++;
    if (s.hits < s.len || TEST.sabotage === 'nosink') return { cell: i, result: 'hit', ship: k, cells: null, water: [], win: false };
    s.sunk = true;
    sea.sunk++;
    const cells = cellsOf(sea.n, s), water = [];
    for (const j of cells) sea.shot[j] = SUNK;
    for (const j of ring(sea.n, cells)) {
      if (!sea.shot[j] && !sea.water[j]) {
        sea.water[j] = 1;
        water.push(j);
      }
    }
    return { cell: i, result: 'sunk', ship: k, cells, water, win: sea.sunk === sea.ships.length };
  }

  // A game: seas[0] is the left player's (you, or Teddy in 2 players), seas[1] the right's. turn = who shoots next.
  function newGame(n, opts = {}) {
    const g = { n, seas: [newSea(n), newSea(n)], turn: opts.first || 0, over: false, winner: -1, shots: [0, 0], moves: 0 };
    if (opts.place !== false) g.seas.forEach((s) => randomPlace(s, opts.rng));
    return g;
  }

  // The side to move shoots square i of the other sea. One shot a turn, bonk or splash.
  function play(g, i) {
    if (g.over) return null;
    const side = g.turn;
    const ev = fire(g.seas[1 - side], i);
    if (!ev) return null;
    ev.side = side;
    g.shots[side]++;
    g.moves++;
    if (ev.win) {
      g.over = true;
      g.winner = side;
    } else g.turn = 1 - side;
    return ev;
  }

  // ---------------------------------------------------------------- the CPU and the brother's tip

  // The ships still afloat on a sea (their lengths), which everyone knows: a sunk ship is announced.
  const afloat = (sea) => sea.ships.filter((s) => !s.sunk).map((s) => s.len);

  // For every square, how many of the ways the ships still afloat could lie cover it, from what a player can see.
  // A way is possible if none of its squares is a splash, a sunk ship or clear water, and no bonk (not sunk yet) is
  // right next to it without being part of it (ships never touch). After a bonk only the ways through bonks count
  // (`hot` times more for each bonk they go through), so the hunt turns into finishing the ship off.
  function density(sea, hot = 60) {
    const n = sea.n, N = n * n, sh = sea.shot, wt = sea.water;
    const cold = new Float64Array(N), warm = new Float64Array(N);
    let warmTotal = 0;
    let hits = 0;
    for (let i = 0; i < N; i++) if (sh[i] === HIT) hits++;
    const lens = {};
    for (const L of afloat(sea)) lens[L] = (lens[L] || 0) + 1;
    let total = 0;
    const cells = [];
    for (const key in lens) {
      const L = +key, times = lens[key];
      for (let dir = 0; dir < 2; dir++) {
        for (let r = 0; r < n - (dir ? L - 1 : 0); r++) {
          for (let c = 0; c < n - (dir ? 0 : L - 1); c++) {
            cells.length = 0;
            let ok = true, cover = 0;
            for (let k = 0; k < L; k++) {
              const i = (r + (dir ? k : 0)) * n + c + (dir ? 0 : k);
              const s = sh[i];
              if (s === MISS || s === SUNK || wt[i]) { ok = false; break; }
              if (s === HIT) cover++;
              cells.push(i);
            }
            if (!ok) continue;
            if (hits) {
              // a bonk just past either end or along either side means this can't be how a ship lies
              const r0 = r - 1, c0 = c - 1, r1 = r + (dir ? L : 1), c1 = c + (dir ? 1 : L);
              for (let rr = r0; rr <= r1 && ok; rr++) {
                if (rr < 0 || rr >= n) continue;
                for (let cc = c0; cc <= c1; cc++) {
                  if (cc < 0 || cc >= n) continue;
                  const inside = dir ? cc === c && rr >= r && rr < r + L : rr === r && cc >= c && cc < c + L;
                  if (!inside && sh[rr * n + cc] === HIT) { ok = false; break; }
                }
              }
              if (!ok) continue;
            }
            const w = times * (cover ? Math.pow(hot, cover) : 1);
            total += w;
            const d = cover ? warm : cold;
            if (cover) warmTotal += w;
            for (const i of cells) if (sh[i] !== HIT) d[i] += w;
          }
        }
      }
    }
    return { d: warmTotal > 0 ? warm : cold, hits, total };
  }

  // the best squares by density (ties all kept)
  function best(sea) {
    const { d, hits } = density(sea);
    let top = 0;
    const list = [];
    for (let i = 0; i < d.length; i++) {
      if (!canShoot(sea, i)) continue;
      if (d[i] > top + 1e-9) {
        top = d[i];
        list.length = 0;
        list.push(i);
      } else if (top > 0 && Math.abs(d[i] - top) <= 1e-9) list.push(i);
    }
    if (hits && list.length > 1) {
      // a tie while finishing a ship off: the squares right next to a bonk first (it reads better for a kid)
      const near = new Set(nextToBonks(sea)), next = list.filter((i) => near.has(i));
      if (next.length) return { list: next, top, d, hits };
    }
    return { list, top, d, hits };
  }

  const open = (sea) => {
    const out = [];
    for (let i = 0; i < sea.n * sea.n; i++) if (canShoot(sea, i)) out.push(i);
    return out;
  };
  const pickOne = (list, rng) => (list.length ? list[Math.floor(rng() * list.length)] : -1);

  // the squares next door (up, down, left, right) to bonks that aren't sunk yet, that can still be shot
  function nextToBonks(sea) {
    const n = sea.n, out = [];
    for (let i = 0; i < n * n; i++) {
      if (sea.shot[i] !== HIT) continue;
      const r = rowOf(n, i), c = colOf(n, i);
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const rr = r + dr, cc = c + dc;
        if (rr >= 0 && cc >= 0 && rr < n && cc < n && canShoot(sea, rr * n + cc)) out.push(rr * n + cc);
      }
    }
    return out;
  }

  // Where the CPU shoots at `sea` (the other side's), at 'easy' or 'normal' (or 'sharp': normal with no slips).
  // opts.sabotage (checks only): 'weak' normal plays like easy; 'stuck' it may shoot a square again.
  function cpuShot(sea, level, rng = Math.random, opts = {}) {
    if (opts.sabotage === 'stuck' && rng() < 0.5) {
      const done = [];
      for (let i = 0; i < sea.n * sea.n; i++) if (sea.shot[i]) done.push(i);
      if (done.length) return pickOne(done, rng);
    }
    if (level === 'normal' && opts.sabotage === 'weak') level = 'easy';
    const all = open(sea);
    if (!all.length) return -1;
    if (level === 'easy') {
      const near = nextToBonks(sea);
      if (near.length && rng() < EASY.follow) return pickOne(near, rng);
      return pickOne(all, rng);
    }
    const b = best(sea);
    if (!b.list.length) return pickOne(all, rng);
    if (level === 'normal' && rng() < NORMAL.slip) {
      // a slip: after a bonk, any square next to one (like a kid would try); while hunting, any square a ship could
      // still be on
      const ok = b.hits ? nextToBonks(sea) : all.filter((i) => b.d[i] > 0);
      return pickOne(ok.length ? ok : b.list, rng);
    }
    return pickOne(b.list, rng);
  }

  // Your brother's tip: the likeliest square on the sea you're shooting at. kind: 'finish' when it goes after a
  // bonked ship, 'try' when it's hunting. null if there's nothing left to shoot.
  function hint(sea, rng = Math.random) {
    const b = best(sea);
    const cell = b.list.length ? pickOne(b.list, rng) : pickOne(open(sea), rng);
    if (cell < 0) return null;
    return { cell, kind: b.hits ? 'finish' : 'try' };
  }

  SEA.rules = {
    KINDS, FLEET, SIZES, EASY, NORMAL, NONE, MISS, HIT, SUNK, TEST,
    cellsAt, cellsOf, ring, newSea, fits, moveShip, rotateShip, randomPlace, checkFleet,
    canShoot, fire, newGame, play, afloat, density, best, nextToBonks, cpuShot, hint, open,
  };
})(typeof window !== 'undefined' ? window : globalThis);

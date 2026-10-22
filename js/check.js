/* TT Sea Battle: the headless checks, on the same rules and CPU the game plays with (js/rules.js). No page needed:
   game.check() runs them in the browser and `node tools/check.js` in a terminal.

   placement  every fleet hidden at random follows the rules (the right ships, straight, in the sea, no overlap, no
              touching, not even corner to corner); made-up fleets that break each rule are caught; and hundreds of
              random drags and turns (what the kids do on the hide-your-ships screen) never break them.
   shots      shooting every square of hundreds of seas: SPLASH exactly on water and BONK exactly on ships; SUNK
              exactly on a ship's last square, once per ship; the water round a sunk ship is marked clear and none
              of it is a ship; the win exactly on the shot that sinks the last ship; a square can't be shot twice,
              and a square marked clear can't be shot.
   ends       CPU against CPU at every pairing of levels on both seas: every shot is a square that can be shot, and
              every game ends with a winner. The CPU never peeks: it picks the same square with the hidden ships
              wiped from its copy of the sea.
   strength   🔥 NORMAL beats 🐣 EASY most of the time on both seas (at least STRONG).
   hint       your brother's tip is always a square you can shoot, and after a bonk it's right next to one.
   Sabotage, to prove the checks can fail:
     { sabotage: 'overlap' }  ships may overlap and touch -> placement fails
     { sabotage: 'nosink' }   a ship is never sunk -> shots fails (and no game can end)
     { sabotage: 'stuck' }    the CPU may shoot a square again -> ends fails
     { sabotage: 'weak' }     NORMAL plays like EASY -> strength fails */
(function (root) {
  'use strict';
  const SEA = (root.SEA = root.SEA || {});
  const R = SEA.rules;
  const STRONG = 0.8;

  // a small seeded random-number generator, so a run can be repeated
  function rngFrom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const shuffle = (list, rng) => {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  // ---------------------------------------------------------------- placement

  function checkPlacement(rng, seas) {
    const out = { random: 0, randomBad: 0, madeUp: 0, madeUpCaught: 0, edits: 0, editsBad: 0, refused: 0, firstBad: null };
    for (const n of R.SIZES) {
      for (let k = 0; k < seas; k++) {
        const sea = R.randomPlace(R.newSea(n), rng);
        out.random++;
        const bad = R.checkFleet(sea);
        if (bad) {
          out.randomBad++;
          out.firstBad = out.firstBad || `random ${n}x${n}: ${bad}`;
        }
      }
      // made-up fleets that each break one rule: they must all be caught
      const made = [
        ['sticks out', [[4, n - 2, 0]]],
        ['overlap', [[2, 2, 0], [2, 3, 1]]],
        ['touch side by side', [[2, 2, 0], [3, 2, 0]]],
        ['touch end to end', [[2, 0, 0], [2, R.KINDS[R.FLEET[n][0]].len, 0]]],
        ['touch corner to corner', [[2, 2, 1], [2 + R.KINDS[R.FLEET[n][0]].len, 3, 0]]],
      ];
      for (const [why, spots] of made) {
        const sea = R.newSea(n);
        // the rest of the fleet along the top row (then the bottom one), well apart from the ships being tested
        let row = 0, col = 0;
        sea.ships.forEach((s, k) => {
          if (k < spots.length) return Object.assign(s, { r: spots[k][0], c: spots[k][1], dir: spots[k][2] });
          if (col + s.len > n) {
            row = n - 1;
            col = 0;
          }
          Object.assign(s, { r: row, c: col, dir: 0 });
          col += s.len + 1;
        });
        sea.at.fill(0);
        sea.ships.forEach((s, k) => {
          const cells = R.cellsOf(n, s);
          if (cells) for (const i of cells) sea.at[i] = sea.at[i] || k + 1;
        });
        out.madeUp++;
        if (R.checkFleet(sea)) out.madeUpCaught++;
        else out.firstBad = out.firstBad || `made-up ${n}x${n} "${why}" passed`;
      }
      // a wrong fleet (two tugs instead of the first ship) is caught too
      const wrong = R.randomPlace(R.newSea(n), rng);
      wrong.ships[0] = Object.assign({}, wrong.ships[0], { kind: 'tug', len: 2 });
      out.madeUp++;
      if (R.checkFleet(wrong)) out.madeUpCaught++;
      else out.firstBad = out.firstBad || `made-up ${n}x${n} wrong fleet passed`;
      // random drags and turns, the way the kids move ships: the fleet must stay legal after each one
      const sea = R.randomPlace(R.newSea(n), rng);
      for (let t = 0; t < 400; t++) {
        const k = Math.floor(rng() * sea.ships.length);
        const moved = rng() < 0.3 ? R.rotateShip(sea, k) : R.moveShip(sea, k, Math.floor(rng() * n) - 1, Math.floor(rng() * n) - 1, rng() < 0.5 ? 0 : 1);
        out.edits++;
        if (!moved) out.refused++;
        const bad = R.checkFleet(sea);
        if (bad) {
          out.editsBad++;
          out.firstBad = out.firstBad || `edit ${n}x${n}: ${bad}`;
        }
      }
    }
    out.ok = out.random > 0 && !out.randomBad && out.madeUp > 0 && out.madeUpCaught === out.madeUp && !out.editsBad && out.refused > 0 && out.refused < out.edits;
    return out;
  }

  // ---------------------------------------------------------------- hit, sink and win

  function checkShots(rng, seas) {
    const out = { seas: 0, ships: 0, shots: 0, wrong: 0, sinks: 0, sinksWrong: 0, wins: 0, winsWrong: 0, waterMarked: 0, waterWrong: 0, again: 0, againRefused: 0, first: null };
    const bad = (why) => {
      out.wrong++;
      out.first = out.first || why;
    };
    for (const n of R.SIZES) {
      for (let k = 0; k < seas; k++) {
        const sea = R.randomPlace(R.newSea(n), rng);
        out.seas++;
        out.ships += sea.ships.length;
        const hidden = Array.from(sea.at);
        const left = sea.ships.map((s) => s.len);
        const sunk = new Set();
        let won = false;
        for (const i of shuffle([...Array(n * n).keys()], rng)) {
          if (sea.water[i]) {
            // marked clear: it can't be shot, and it's really water
            out.again++;
            if (R.fire(sea, i) === null) out.againRefused++;
            if (hidden[i]) bad(`clear water on a ship at ${i}`);
            continue;
          }
          const ev = R.fire(sea, i);
          out.shots++;
          if (!ev) {
            bad(`square ${i} couldn't be shot`);
            continue;
          }
          const ship = hidden[i] - 1;
          if (won) bad('a shot after the win');
          if ((ship < 0) !== (ev.result === 'miss')) bad(`square ${i}: ${ev.result} on ${ship < 0 ? 'water' : 'a ship'}`);
          if (ship >= 0) {
            left[ship]--;
            const shouldSink = left[ship] === 0;
            if (shouldSink !== (ev.result === 'sunk')) {
              out.sinksWrong++;
              bad(`ship ${ship}: ${ev.result} with ${left[ship]} squares left`);
            }
            if (ev.result === 'sunk') {
              out.sinks++;
              if (sunk.has(ship)) bad(`ship ${ship} sunk twice`);
              sunk.add(ship);
              for (const j of ev.water) {
                out.waterMarked++;
                if (hidden[j]) {
                  out.waterWrong++;
                  bad(`marked clear on a ship at ${j}`);
                }
              }
              // every square round the ship is either shot or marked clear now
              for (const j of R.ring(n, ev.cells)) if (!sea.shot[j] && !sea.water[j]) bad(`square ${j} next to a sunk ship not marked`);
            }
            const shouldWin = sunk.size === sea.ships.length;
            if (shouldWin !== ev.win) {
              out.winsWrong++;
              bad(`win ${ev.win} with ${sea.ships.length - sunk.size} ships left`);
            }
            if (ev.win) {
              out.wins++;
              won = true;
              break; // the game is over: nothing more to shoot
            }
          } else if (ev.win) bad('a win on a splash');
          // the same square again is refused
          out.again++;
          if (R.fire(sea, i) === null) out.againRefused++;
          else bad(`square ${i} shot twice`);
        }
        if (!won) bad(`${n}x${n} sea: every square shot and no win`);
      }
    }
    out.ok = out.seas > 0 && !out.wrong && out.sinks === out.ships && out.wins === out.seas && out.again === out.againRefused;
    return out;
  }

  // ---------------------------------------------------------------- CPU games

  // One CPU-against-CPU game. levels[side] for each side. Returns { winner, shots, illegal, peeked, stuck }.
  function playGame(n, levels, first, rng, sabotage, peekEvery = 0) {
    const g = R.newGame(n, { first, rng });
    const res = { winner: -1, shots: [0, 0], illegal: 0, peeked: 0, peekChecks: 0, stuck: false };
    const limit = 2 * n * n + 10;
    for (let t = 0; t < limit && !g.over; t++) {
      const side = g.turn, sea = g.seas[1 - side];
      if (peekEvery && t % peekEvery === 0) {
        // the same choice with the hidden ships wiped: the CPU only uses what a player can see
        const seed = Math.floor(rng() * 1e9);
        const blind = Object.assign({}, sea, { at: new Int8Array(sea.at.length), ships: sea.ships.map((s) => ({ len: s.len, sunk: s.sunk })) });
        res.peekChecks++;
        if (R.cpuShot(sea, levels[side], rngFrom(seed), { sabotage }) !== R.cpuShot(blind, levels[side], rngFrom(seed), { sabotage })) res.peeked++;
      }
      const i = R.cpuShot(sea, levels[side], rng, { sabotage });
      if (!R.canShoot(sea, i)) {
        res.illegal++;
        g.turn = 1 - side; // a wasted turn
        continue;
      }
      R.play(g, i);
    }
    res.stuck = !g.over;
    res.winner = g.winner;
    res.shots = g.shots.slice();
    return res;
  }

  function checkGames(rng, games, sabotage) {
    const out = { games: 0, ended: 0, illegal: 0, peeked: 0, peekChecks: 0, longest: 0, avgShotsToWin: {} };
    const pairs = [['easy', 'easy'], ['normal', 'normal'], ['easy', 'normal'], ['normal', 'easy']];
    for (const n of R.SIZES) {
      const sum = { easy: [0, 0], normal: [0, 0] };
      for (const pair of pairs) {
        for (let k = 0; k < games; k++) {
          const r = playGame(n, pair, k % 2, rng, sabotage, 7);
          out.games++;
          if (!r.stuck) out.ended++;
          out.illegal += r.illegal;
          out.peeked += r.peeked;
          out.peekChecks += r.peekChecks;
          out.longest = Math.max(out.longest, r.shots[0] + r.shots[1]);
          if (r.winner >= 0) {
            const lv = pair[r.winner];
            sum[lv][0] += r.shots[r.winner];
            sum[lv][1]++;
          }
        }
      }
      out.avgShotsToWin[`${n}x${n}`] = { easy: +(sum.easy[0] / Math.max(1, sum.easy[1])).toFixed(1), normal: +(sum.normal[0] / Math.max(1, sum.normal[1])).toFixed(1) };
    }
    out.ok = out.games > 0 && out.ended === out.games && !out.illegal && !out.peeked && out.peekChecks > 0;
    return out;
  }

  function checkStrength(rng, games, sabotage) {
    const out = {};
    let ok = true;
    for (const n of R.SIZES) {
      let wins = 0;
      for (let k = 0; k < games; k++) {
        // NORMAL is side 0 in even games and side 1 in odd ones; who shoots first swaps too
        const normalSide = k % 2, levels = normalSide ? ['easy', 'normal'] : ['normal', 'easy'];
        const r = playGame(n, levels, (k >> 1) % 2, rng, sabotage);
        if (r.winner === normalSide) wins++;
      }
      const rate = wins / games;
      out[`${n}x${n}`] = `${wins}/${games}`;
      if (rate < STRONG) ok = false;
    }
    out.needs = `${STRONG * 100}%`;
    out.ok = ok;
    return out;
  }

  // ---------------------------------------------------------------- the brother's tip

  function checkHint(rng, games) {
    const out = { tips: 0, bad: 0, afterBonk: 0, nextToBonk: 0, first: null };
    for (const n of R.SIZES) {
      for (let k = 0; k < games; k++) {
        const g = R.newGame(n, { rng });
        while (!g.over) {
          const sea = g.seas[1 - g.turn];
          const h = R.hint(sea, rng);
          out.tips++;
          if (!h || !R.canShoot(sea, h.cell)) {
            out.bad++;
            out.first = out.first || `tip ${h && h.cell} can't be shot`;
            break;
          }
          if (R.nextToBonks(sea).length) {
            out.afterBonk++;
            if (R.nextToBonks(sea).includes(h.cell) && h.kind === 'finish') out.nextToBonk++;
            else out.first = out.first || `tip ${h.cell} isn't next to a bonk`;
          }
          // the side to move follows the tip half the time, else plays EASY
          R.play(g, rng() < 0.5 ? h.cell : R.cpuShot(sea, 'easy', rng));
        }
      }
    }
    out.ok = out.tips > 0 && !out.bad && out.afterBonk > 0 && out.nextToBonk === out.afterBonk;
    return out;
  }

  // ---------------------------------------------------------------- all of them

  function check(opts = {}) {
    const games = opts.games || 40;
    const seed = opts.seed !== undefined ? opts.seed : 20261021;
    const rng = rngFrom(seed);
    const sabotage = opts.sabotage || null;
    R.TEST.sabotage = sabotage === 'overlap' || sabotage === 'nosink' ? sabotage : null;
    try {
      const out = { seed, sabotage, games };
      out.placement = checkPlacement(rng, games * 4);
      out.shots = checkShots(rng, games * 2);
      // with 'nosink' no game can end: play a few so the run stays short
      out.ends = checkGames(rng, sabotage === 'nosink' ? 2 : Math.max(4, games >> 1), sabotage);
      out.strength = checkStrength(rng, games * 2, sabotage);
      out.hint = checkHint(rng, Math.max(4, games >> 2));
      out.ok = ['placement', 'shots', 'ends', 'strength', 'hint'].every((k) => out[k].ok);
      out.failed = ['placement', 'shots', 'ends', 'strength', 'hint'].filter((k) => !out[k].ok);
      return out;
    } finally {
      R.TEST.sabotage = null;
    }
  }

  // Test bots that play like the kids (tuning only): 'kid' (Teddy, 8) hunts at random, tries the squares next to a
  // bonk, and once two bonks line up keeps going along the line; 'little' (Tommy, 5) shoots at random and tries next
  // door to a bonk only some of the time.
  function kidShot(sea, who, rng) {
    const n = sea.n, open = R.open(sea);
    const hits = [];
    for (let i = 0; i < n * n; i++) if (sea.shot[i] === R.HIT) hits.push(i);
    if (who === 'little') {
      const near = R.nextToBonks(sea);
      return near.length && rng() < 0.5 ? near[Math.floor(rng() * near.length)] : open[Math.floor(rng() * open.length)];
    }
    if (hits.length >= 2) {
      // along the line of bonks
      const line = [];
      for (const i of hits) {
        for (const [dr, dc] of [[0, 1], [1, 0]]) {
          const j = i + dr * n + dc;
          if (!hits.includes(j) || (dc && Math.floor(j / n) !== Math.floor(i / n))) continue;
          for (const step of [-1, 1]) {
            let r = Math.floor(i / n), c = i % n;
            while (r >= 0 && c >= 0 && r < n && c < n && sea.shot[r * n + c] === R.HIT) {
              r += step * dr;
              c += step * dc;
            }
            if (r >= 0 && c >= 0 && r < n && c < n && R.canShoot(sea, r * n + c)) line.push(r * n + c);
          }
        }
      }
      if (line.length) return line[Math.floor(rng() * line.length)];
    }
    const near = R.nextToBonks(sea);
    if (near.length) return near[Math.floor(rng() * near.length)];
    return open[Math.floor(rng() * open.length)];
  }

  // How many shots each level and each kid bot takes to sink a whole fleet alone, and how often the kid bots beat
  // the level meant for them (for tuning; not a pass / fail check).
  function rates(games = 200, seed = 7) {
    const rng = rngFrom(seed), out = {};
    const shoot = (sea, who) => (who === 'kid' || who === 'little' ? kidShot(sea, who, rng) : R.cpuShot(sea, who, rng));
    for (const n of R.SIZES) {
      const row = {};
      for (const who of ['little', 'easy', 'kid', 'normal', 'sharp']) {
        let sum = 0;
        for (let k = 0; k < games; k++) {
          const sea = R.randomPlace(R.newSea(n), rng);
          let shots = 0;
          while (sea.sunk < sea.ships.length && shots < n * n) {
            R.fire(sea, shoot(sea, who));
            shots++;
          }
          sum += shots;
        }
        row[who] = +(sum / games).toFixed(1);
      }
      for (const [kid, cpu] of [['little', 'easy'], ['kid', 'normal'], ['kid', 'easy']]) {
        let wins = 0;
        for (let k = 0; k < games; k++) {
          const g = R.newGame(n, { first: k % 2, rng });
          while (!g.over) R.play(g, g.turn === 0 ? shoot(g.seas[1], kid) : R.cpuShot(g.seas[0], cpu, rng));
          if (g.winner === 0) wins++;
        }
        row[`${kid} beats ${cpu}`] = `${Math.round((100 * wins) / games)}%`;
      }
      out[`${n}x${n}`] = row;
    }
    return out;
  }

  SEA.check = check;
  SEA.rates = rates;
  SEA.rngFrom = rngFrom;
})(typeof window !== 'undefined' ? window : globalThis);

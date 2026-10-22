/* TT Sea Battle: the menu, the games, the HUD, input and the main loop.
   Screens: home (LITTLE SEA 8 x 8 or BIG SEA 10 x 10, 1 or 2 players, who you are, the level), hide (drag your ships
   where you like, tap one to turn it, or 🎲 shuffle them; then READY), pass (2 players: hand the device over, the
   other one looks away), play (take turns shooting at the other sea), game over, pause.
   In 1 player you're Teddy or Tommy against 🦊 Foxy (🐣 EASY or 🔥 NORMAL), with 🐸 Froggy her lookout on her raft.
   Your brother isn't playing: he's the one you call for help (js/buddy.js). In 2 players Teddy and Tommy pass the
   device: each hides a fleet while the other looks away, and a "look away" screen comes between every turn.
   The score keeps running from game to game for the same two players (until the page is closed); your best (the
   fewest shots to sink Foxy's whole fleet) is kept per sea and level. Who shoots first swaps every game.
   window.game is a test hook: see the README. */
(function () {
  'use strict';
  const SEA = window.SEA;
  const R = SEA.rules;
  const ST = SEA.stage;
  const S = Kit.sound;
  const $ = (id) => document.getElementById(id);
  const { rand, emojiTexture } = Kit.gfx;

  const KEY = 'seaBattleTT.v1';
  const LOOK = {
    teddy: { color: '#2f6fe0', emblem: '🏀' },
    tommy: { color: '#ff8a1f', emblem: '✌️' },
    foxy: { color: '#21b38a', emblem: '🦊' },
  };
  const THINK = { easy: [0.9, 1.3], normal: [0.8, 1.15] }; // how long Foxy aims (s)

  const prefs = Object.assign({ players: 1, who: 'tommy', level: 'easy', size: 8, best: {} }, load());
  const G = {
    state: 'boot', players: 1, level: 'easy', size: 8, sides: null, game: null, starter: 0, viewer: 0, hideSide: -1,
    pass: null, cpuT: -1, waitT: -1, endT: -1, panelT: -1, turnId: 0, busy: false, token: 0, cursor: -1, hover: -1,
    press: null, drag: null, held: false, last: 0, auto: false, autoLevel: 'sharp', demo: null, scores: {}, key: '',
    games: 0, shotsFired: 0, lastEv: null, pausedFrom: null, focus: -1,
  };
  const actors = [SEA.makeActor(), SEA.makeActor()];
  const froggy = SEA.makeActor();
  const badges = [];
  let ui = null, flyers = null, bursts = null, spots = null, art = null;

  function load() {
    try {
      return JSON.parse(localStorage.getItem(KEY)) || {};
    } catch (e) {
      return {};
    }
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch (e) { /* private mode */ }
  }

  // ---------------------------------------------------------------- who's playing

  const nameOf = (id) => Kit.roster.get(id).name;
  // sides[0] is on the left / in front (you, or Teddy in 2 players), sides[1] the other sea
  function makeSides(players, who) {
    if (players === 2) return [{ id: 'teddy', human: true }, { id: 'tommy', human: true }];
    return [{ id: who, human: true }, { id: 'foxy', human: false }];
  }
  const current = () => (G.game ? G.sides[G.game.turn] : null);
  const kid = () => G.sides[0];
  const score = () => (G.scores[G.key] = G.scores[G.key] || [0, 0]);
  const bestKey = () => `${G.size}-${G.level}`;

  function setActors() {
    G.sides.forEach((s, k) => {
      const a = actors[k];
      if (!a.entry || a.entry.id !== s.id) {
        a.set(s.id, 1);
        const e = Kit.roster.get(s.id);
        const tag = Kit.gfx.nameTag(e.name, e.tag || LOOK[s.id].color);
        tag.position.y = 2.75;
        a.person.root.add(tag);
      }
      s.actor = a;
      a.visible = true;
      ST.setLook(k, LOOK[s.id].color, LOOK[s.id].emblem);
      setBadge(k, LOOK[s.id].emblem);
    });
    froggy.visible = G.players === 1 && G.state !== 'home';
    SEA.buddy.setFor(kid().id);
  }

  // the emblem that bobs over the head of whoever shoots next
  function setBadge(k, emblem) {
    if (!badges[k]) {
      badges[k] = new THREE.Sprite(new THREE.SpriteMaterial({ depthTest: false, transparent: true }));
      badges[k].renderOrder = 23;
      badges[k].scale.setScalar(0.6);
      ST.scene.add(badges[k]);
    }
    badges[k].material.map = emojiTexture(emblem);
    badges[k].material.needsUpdate = true;
  }

  // ---------------------------------------------------------------- layout

  // snap: put the seas straight in place (a resize, the menu); otherwise they glide to a new focus
  function layout(snap = false) {
    ST.resize();
    SEA.fx.overlay.resize();
    const Wd = ST.W, Ht = ST.H;
    if (Wd < 2 || Ht < 2) return;
    const wideScreen = Wd / Ht >= 1.15, home = G.state === 'home';
    // on the menu the seas only get the space beside it (or above it): arrange them for that shape
    const wide = home ? (wideScreen ? (Wd * 0.44 - 72) / (Ht - 28) : (Wd - 76) / (Ht * 0.36 - 14)) >= 0.9 : wideScreen;
    spots = ST.layout(wide, G.focus, snap || home || !spots || spots.wide !== wide);
    const V = THREE.Vector3, pts = [];
    ST.corners(0, pts);
    ST.corners(1, pts);
    const people = spots.owners.concat(home ? [] : [spots.buddy].concat(G.players === 1 ? [spots.extra] : []));
    for (const s of people) pts.push(new V(s.x - 0.55, 0, s.z), new V(s.x + 0.55, 0, s.z), new V(s.x, 2.9, s.z));
    // the kit's round ? and language buttons sit on the left edge: keep the seas and the boys clear of them
    const m = { l: 62, r: 14, t: 14, b: 14 };
    if (!wideScreen && !home) m.l = m.r = 8; // in a game on a tall screen they're down in the bottom left corner
    if (home) {
      if (wideScreen) m.r = Wd * 0.56 + 10;
      else {
        m.b = Ht * 0.64 + 6;
        m.t = 8;
      }
    } else {
      const top = ui.hudtop.getBoundingClientRect(), mid = ui.hudmid.getBoundingClientRect();
      m.t = top.bottom + 6;
      if (getComputedStyle(ui.hudmid).position === 'fixed') {
        // a phone on its side: the score is a column on the right, the buttons a column on the left
        m.t = 8;
        m.r = Wd - mid.left + 6;
        m.l = 66;
      }
      if (!wideScreen) m.b = Math.min(Ht * 0.12, 112);
      else if (G.state === 'hide') m.b = ui.hidebar.getBoundingClientRect().height + 20;
    }
    ST.fit(pts, wide ? 1.0 : 1.25, m);
    G.sides && G.sides.forEach((s, k) => {
      const sp = spots.owners[k];
      s.actor.faceDefault = sp.face;
      if (!SEA.highFive.on) s.actor.place(sp.x, sp.y, sp.z);
    });
    ST.spareRafts(!home && G.players === 1, !home && G.players === 1);
    froggy.faceDefault = spots.extra.face;
    froggy.place(spots.extra.x, spots.extra.y, spots.extra.z);
  }

  // ---------------------------------------------------------------- the games

  function startMatch(opts = {}) {
    gesture();
    for (const k of ['players', 'level', 'size', 'who']) if (opts[k] !== undefined) prefs[k] = opts[k];
    save();
    Object.assign(G, { players: prefs.players, level: prefs.level, size: prefs.size });
    G.sides = makeSides(G.players, prefs.who);
    G.key = G.sides.map((s) => s.id).join('|') + (G.players === 1 ? '|' + G.level : '');
    G.state = 'hide';
    setActors();
    G.starter = 0;
    show(ui.home, false);
    show(ui.hud, true);
    show(ui.callBtn, true);
    show(ui.over, false);
    G.demo = null;
    SEA.highFive.cancel();
    setupHud();
    S.music('title');
    startGame();
  }

  function startGame() {
    G.token++;
    G.game = R.newGame(G.size, { first: G.starter });
    Object.assign(G, { endT: -1, cpuT: -1, waitT: -1, panelT: -1, busy: false, cursor: -1, hover: -1, press: null, drag: null, lastEv: null, shotsFired: 0 });
    ST.setSize(G.size);
    ST.setFleet(0, G.game.seas[0], 'none');
    ST.setFleet(1, G.game.seas[1], 'none');
    ST.hint(-1, -1);
    ST.cursor(-1, -1);
    ST.target(-1);
    SEA.buddy.reset();
    SEA.fx.overlay.clear();
    flyers.clear();
    bursts.clear();
    clearToasts();
    G.sides.forEach((s) => {
      s.actor.react('idle');
      s.actor.drop();
    });
    froggy.react('idle');
    show(ui.over, false);
    show(ui.pause, false);
    renderScore();
    // hide the fleets: in 1 player yours (Foxy's is hidden already); in 2 players Teddy's then Tommy's, each with
    // the other looking away
    if (G.players === 2) showPass('hide', 0);
    else beginHide(0);
  }

  function beginHide(side) {
    G.state = 'hide';
    G.hideSide = side;
    G.focus = side;
    G.viewer = side;
    document.body.dataset.screen = 'hide';
    show(ui.hidebar, true);
    show(ui.pass, false);
    applyView();
    ST.target(side);
    updateTurnText();
    layout();
  }

  function shuffle() {
    if (G.state !== 'hide') return false;
    const sea = G.game.seas[G.hideSide];
    R.randomPlace(sea);
    ST.setFleet(G.hideSide, sea, 'all');
    ST.board(G.hideSide).ships.forEach((sh) => (sh.pop = 0.25));
    SEA.sfx.shuffle();
    G.sides[G.hideSide].actor.react('hop');
    return true;
  }

  function ready() {
    gesture();
    if (G.state !== 'hide' || G.drag) return false;
    if (R.checkFleet(G.game.seas[G.hideSide])) return false; // can't happen: every move keeps the rules
    SEA.sfx.nice();
    G.sides[G.hideSide].actor.react('cheer');
    show(ui.hidebar, false);
    ST.target(-1);
    if (G.players === 2 && G.hideSide === 0) return showPass('hide', 1), true;
    if (G.players === 2) return showPass('play', G.game.turn), true;
    G.state = 'play';
    G.focus = 1; // Foxy's sea grows: it's the one you shoot at
    document.body.dataset.screen = 'play';
    layout();
    toast('⚓ GO!', 'buddy');
    beginTurn();
    return true;
  }

  // 2 players: the "look away" screen. Both fleets hide; READY shows the next one's own fleet.
  function showPass(then, side) {
    G.state = 'pass';
    G.pass = { then, side };
    G.viewer = -1;
    G.focus = then === 'hide' ? side : 1 - side; // the seas move to their new places behind the screen
    document.body.dataset.screen = 'pass';
    applyView();
    ST.target(-1);
    ST.cursor(-1, -1);
    show(ui.hidebar, false);
    const me = G.sides[side], other = G.sides[1 - side];
    ui.passFace.src = art[me.id];
    ui.passTitle.textContent = then === 'hide' ? `${nameOf(me.id)}: HIDE YOUR SHIPS!` : `${nameOf(me.id)}'S TURN!`;
    ui.passSub.textContent = `${nameOf(other.id)}, LOOK AWAY! 🙈`;
    show(ui.pass, true);
    SEA.sfx.bell();
    updateTurnText();
    layout(true);
  }

  function passReady() {
    gesture();
    if (G.state !== 'pass') return false;
    const { then, side } = G.pass;
    G.pass = null;
    show(ui.pass, false);
    SEA.sfx.kit('click');
    if (then === 'hide') beginHide(side);
    else {
      G.state = 'play';
      G.viewer = side;
      G.focus = 1 - side; // the sea you shoot at grows
      document.body.dataset.screen = 'play';
      applyView();
      layout();
      beginTurn();
    }
    return true;
  }

  // Which ships show. Your own fleet, and only the sunk ships of the other one; in 2 players "your own" is whoever's
  // turn it is (none while the look-away screen is up); everything once the game is over.
  function applyView() {
    if (!G.game) return;
    const all = G.state === 'ended' || G.state === 'over' || (G.game.over && G.state !== 'hide');
    for (const side of [0, 1]) {
      const mine = G.players === 1 ? side === 0 : side === G.viewer;
      ST.showShips(side, all || mine ? 'all' : 'sunk');
    }
  }

  function beginTurn() {
    G.turnId++;
    const s = current();
    ST.target(1 - G.game.turn);
    if (!s.human) {
      const [a, b] = THINK[G.level];
      G.cpuT = rand(a, b);
      s.actor.act('think', G.cpuT + 0.2, 0, true);
      SEA.sfx.think();
      const p = s.actor.root.position;
      flyers.add('🤔', p.x, 3, p.z, 0, 0.3, 0.6, G.cpuT, 0, 0);
    } else if (G.auto) G.cpuT = 0.35;
    updateTurnText();
  }

  // The side to move shoots square i of the other sea. Returns false if it can't be shot.
  function fireAt(i, byKid) {
    const st = G.game;
    if (!st || st.over || G.state !== 'play' || G.busy) return false;
    const side = st.turn, sea = st.seas[1 - side];
    if (!R.canShoot(sea, i)) {
      if (byKid) {
        SEA.sfx.nope();
        if (i >= 0 && sea.water[i]) toast('NO SHIPS THERE!', 'hint');
      }
      return false;
    }
    const s = current();
    G.busy = true;
    G.cpuT = -1;
    G.cursor = -1;
    G.hover = -1;
    ST.cursor(-1, -1);
    if (s.human) {
      ST.hint(-1, -1);
      SEA.buddy.moved();
      G.shotsFired++;
    }
    s.actor.act('point', 0.9, 0, true);
    s.actor.face = null;
    const token = G.token;
    ST.shoot(side, 1 - side, i, () => token === G.token && land(i), flyers);
    updateTurnText();
    return true;
  }

  const KIND_NAME = (k) => R.KINDS[k].name;
  function land(i) {
    const st = G.game, side = st.turn, s = G.sides[side], foe = G.sides[1 - side];
    const ev = R.play(st, i);
    if (!ev) return;
    G.lastEv = ev;
    const p = ST.cellPos(1 - side, i);
    const good = G.players === 2 || s.human; // a kid did something good (in 2 players, always)
    if (ev.result === 'miss') {
      ST.mark(1 - side, i, 'miss');
      ST.splash(1 - side, i, flyers);
      bursts.add('SPLASH!', p.x, p.y + 1, p.z, 1.3, '#bff0ff', '#2f7cf0');
      SEA.sfx.splash();
    } else {
      ST.mark(1 - side, i, 'hit');
      ST.bonk(1 - side, i, flyers);
      SEA.sfx.bonk();
      s.actor.react('cheer');
      foe.actor.react('oops');
      if (G.players === 1) froggy.react(side === 1 ? 'cheer' : 'oops');
      if (ev.result === 'hit') bursts.add('BONK!', p.x, p.y + 1, p.z, 1.4, '#ffd400', '#e8372c');
      else {
        // sunk: the ship comes up (if it was hidden), tips over; the water round it is marked clear
        ST.sink(1 - side, ev.ship);
        const mid = ST.cellPos(1 - side, ev.cells[ev.cells.length >> 1]);
        bursts.add('SUNK!', mid.x, mid.y + 1.2, mid.z, 2, '#ffffff', '#14121f');
        for (const c of ev.cells) ST.ringAt(1 - side, c, '#ffffff', 0.6);
        for (let k = 0; k < 8; k++) flyers.add('🫧', mid.x + rand(-0.8, 0.8), mid.y + 0.2, mid.z + rand(-0.8, 0.8), rand(-0.3, 0.3), rand(0.8, 1.6), rand(0.25, 0.4), 1.4, 0, -0.4);
        const token = G.token;
        ev.water.forEach((w, k) => setTimeout(() => token === G.token && ST.mark(1 - side, w, 'water'), 250 + k * 25));
        const ship = st.seas[1 - side].ships[ev.ship];
        const whose = G.players === 1 ? (side === 0 ? "FOXY'S" : 'YOUR') : `${nameOf(foe.id)}'S`;
        toast(`${G.players === 1 && side === 0 ? 'YOU' : nameOf(s.id)} SANK ${whose} ${KIND_NAME(ship.kind)}!`, good ? 'save' : 'buddy');
        setTimeout(() => token === G.token && SEA.sfx.sink(good), 250);
      }
    }
    G.busy = false;
    if (ev.win) G.endT = 1.1;
    else G.waitT = ev.result === 'miss' ? 0.9 : 1.3;
    updateTurnText();
  }

  // after a shot: the next turn (2 players: the look-away screen first)
  function nextTurn() {
    if (G.players === 2) showPass('play', G.game.turn);
    else beginTurn();
  }

  function endGame() {
    const st = G.game;
    G.starter = 1 - G.starter;
    G.games++;
    const sc = score();
    const win = G.sides[st.winner], lose = G.sides[1 - st.winner];
    sc[st.winner]++;
    G.state = 'ended';
    G.viewer = -1;
    applyView(); // the rest of the losing fleet shows where it was hiding
    ST.target(-1);
    ST.cursor(-1, -1);
    ST.hint(-1, -1);
    win.actor.react('signature'); // Teddy's boxing or jump shot (in turn), Tommy's Y with ✌️; Foxy waves
    setTimeout(() => G.state === 'ended' && lose.actor.react('shrug'), 250);
    if (G.players === 1) froggy.react(win.human ? 'shrug' : 'signature');
    const a = ST.toScreen(ST.cellPos(1 - st.winner, (st.n * st.n) >> 1));
    if (win.human) {
      SEA.sfx.win();
      SEA.fx.overlay.burst(a.x, a.y, 80, ['⭐', '🎉', '⚓', '🚢'], 1.2);
      SEA.fx.overlay.rain(120);
      if (G.players === 1) {
        const shots = st.shots[0], b = prefs.best[bestKey()];
        G.newBest = !b || shots < b;
        if (G.newBest) {
          prefs.best[bestKey()] = shots;
          save();
        }
      }
    } else SEA.sfx.lose();
    bumpScore(st.winner === 0 ? ui.scoreL : ui.scoreR);
    renderScore();
    updateTurnText();
    G.panelT = 2.6;
  }

  function showPanel() {
    const st = G.game, win = G.sides[st.winner];
    ui.oFace.innerHTML = `<img alt="" src="${art[win.id]}"><span class="big">🏆</span>`;
    ui.oTitle.textContent = `${nameOf(win.id)} WINS!`;
    const [a, b] = G.sides, sc = score();
    ui.oScore.innerHTML = `<img alt="" src="${art[a.id]}"><span>${sc[0]}</span><span class="dash">–</span><span>${sc[1]}</span><img alt="" src="${art[b.id]}">`;
    if (G.players === 1 && win.human) {
      ui.oShots.textContent = G.newBest ? `${st.shots[0]} SHOTS · NEW BEST!` : `${st.shots[0]} SHOTS · BEST ${prefs.best[bestKey()]}`;
    } else ui.oShots.textContent = `${st.shots[st.winner]} SHOTS`;
    G.state = 'over';
    clearToasts();
    show(ui.over, true);
    win.actor.react('over');
    G.sides[1 - st.winner].actor.react('sulk');
  }

  function next() {
    gesture();
    if (G.state === 'over' || G.state === 'ended') startGame();
  }

  // R / 🔄: a new game. A game not finished yet doesn't count (and the same side starts again).
  function restartGame() {
    if (!['play', 'paused', 'ended', 'over', 'hide', 'pass'].includes(G.state)) return;
    show(ui.pause, false);
    startGame();
    toast('🔄', 'hint');
  }

  // ---------------------------------------------------------------- home

  function goHome() {
    G.token++;
    G.state = 'home';
    G.focus = -1;
    document.body.dataset.screen = 'home';
    show(ui.hud, false);
    show(ui.callBtn, false);
    show(ui.over, false);
    show(ui.pause, false);
    show(ui.pass, false);
    show(ui.hidebar, false);
    show(ui.home, true);
    SEA.buddy.reset();
    SEA.highFive.cancel();
    ST.hint(-1, -1);
    ST.cursor(-1, -1);
    ST.target(-1);
    clearToasts();
    SEA.fx.overlay.clear();
    G.sides = [{ id: 'teddy', human: false }, { id: 'tommy', human: false }];
    setActors();
    layout();
    G.sides.forEach((s) => s.actor.react('hello'));
    refreshHome();
    demoStart();
    S.music('title');
  }

  // the boys play a slow game behind the menu, with both fleets showing, on the sea you played last
  function demoStart() {
    const g = R.newGame(prefs.size, { first: Math.random() < 0.5 ? 0 : 1 });
    G.game = g;
    G.demo = { g, t: 1.2, end: -1, token: ++G.token };
    ST.setSize(prefs.size);
    ST.setFleet(0, g.seas[0], 'all');
    ST.setFleet(1, g.seas[1], 'all');
  }
  function demoUpdate(dt) {
    const d = G.demo;
    if (!d || G.busy) return;
    const g = d.g;
    d.t -= dt;
    if (d.end >= 0) {
      d.end -= dt;
      if (d.end < 0) demoStart();
      return;
    }
    if (d.t > 0) return;
    if (g.over) {
      d.end = 3.6;
      G.sides[g.winner].actor.react('signature');
      G.sides[1 - g.winner].actor.react('shrug');
      return;
    }
    const side = g.turn;
    const i = R.cpuShot(g.seas[1 - side], 'normal');
    G.busy = true;
    G.sides[side].actor.act('point', 0.9, 0, true);
    ST.shoot(side, 1 - side, i, () => {
      G.busy = false;
      if (G.state !== 'home' || G.demo !== d) return;
      const ev = R.play(g, i);
      if (!ev) return;
      ST.mark(1 - side, i, ev.result === 'miss' ? 'miss' : 'hit');
      if (ev.result === 'miss') ST.splash(1 - side, i, flyers);
      else {
        ST.bonk(1 - side, i, flyers);
        G.sides[side].actor.react('cheer');
      }
      if (ev.result === 'sunk') {
        ST.sink(1 - side, ev.ship);
        ev.water.forEach((w) => ST.mark(1 - side, w, 'water'));
      }
      d.t = 0.5;
    }, flyers);
  }

  function refreshHome() {
    const seg = (el, v) => {
      for (const b of el.children) {
        const on = b.dataset.v === String(v);
        b.classList.toggle('on', on);
        b.setAttribute('aria-checked', on);
        b.setAttribute('role', 'radio');
      }
    };
    seg(ui.segPlayers, prefs.players);
    seg(ui.segWho, prefs.who);
    seg(ui.segLevel, prefs.level);
    ui.segWho.style.display = ui.segLevel.style.display = prefs.players === 1 ? '' : 'none';
    ui.duo.style.display = prefs.players === 2 ? '' : 'none';
    for (const t of ui.tiles.children) t.classList.toggle('last', +t.dataset.n === prefs.size);
  }

  function setPref(k, v) {
    gesture();
    prefs[k] = v;
    save();
    refreshHome();
    SEA.sfx.kit('click');
    if (k === 'who') {
      const s = G.sides && G.sides.find((x) => x.id === v);
      if (s && G.state === 'home') s.actor.react('hello');
    }
  }

  // ---------------------------------------------------------------- HUD

  function setupHud() {
    const [a, b] = G.sides;
    ui.faceL.src = art[a.id];
    ui.faceR.src = art[b.id];
    if (G.players === 1) {
      const bud = SEA.buddy.entry;
      ui.callBtn.innerHTML = `<img alt="" src="${art[bud.id]}"><kbd>T</kbd>`;
      const nice = bud.name[0] + bud.name.slice(1).toLowerCase();
      ui.callBtn.title = `Call ${nice} (T)`;
      ui.callBtn.setAttribute('aria-label', `Call ${nice}`);
    } else {
      ui.callBtn.innerHTML = '🙌<kbd>T</kbd>';
      ui.callBtn.title = 'High five! (T)';
      ui.callBtn.setAttribute('aria-label', 'High five!');
    }
  }

  function renderScore() {
    const sc = score();
    ui.scoreL.textContent = sc[0];
    ui.scoreR.textContent = sc[1];
  }
  function bumpScore(el) {
    el.classList.remove('bump');
    void el.offsetWidth;
    el.classList.add('bump');
  }

  const cache = {};
  function setText(el, key, v) {
    if (cache[key] !== v) {
      cache[key] = v;
      el.textContent = v;
    }
  }

  function updateTurnText() {
    if (!G.game || !ui) return;
    const st = G.game, s = current();
    let text = '', tip = '', mine = false;
    if (G.state === 'hide') {
      text = G.players === 1 ? 'HIDE YOUR SHIPS!' : `${nameOf(G.sides[G.hideSide].id)}: HIDE YOUR SHIPS!`;
      tip = 'Drag a ship to move it. Tap it to turn it.';
      mine = true;
    } else if (G.state === 'pass') text = '🙈';
    else if (G.state === 'ended' || G.state === 'over' || st.over) text = `${nameOf(G.sides[st.winner].id)} WINS!`;
    else if (!s.human) text = G.busy ? 'BOOM!' : `${nameOf(s.id)} IS AIMING…`;
    else if (G.busy) text = 'BOOM!';
    else if (G.players === 1) {
      text = "YOUR TURN: SHOOT AT FOXY'S SEA!";
      mine = true;
    } else {
      text = `${nameOf(s.id)}'S TURN!`;
      mine = true;
    }
    setText(ui.turn, 'turn', text);
    setText(ui.tip, 'tip', tip);
    ui.turn.classList.toggle('mine', mine);
    const shooting = G.state === 'play' && !st.over ? st.turn : -1;
    ui.sideL.classList.toggle('now', shooting === 0 || (G.state === 'hide' && G.hideSide === 0));
    ui.sideR.classList.toggle('now', shooting === 1 || (G.state === 'hide' && G.hideSide === 1));
  }

  function toast(text, cls) {
    const el = document.createElement('div');
    el.className = 'toast' + (cls ? ' ' + cls : '');
    el.textContent = text;
    ui.toasts.appendChild(el);
    setTimeout(() => el.remove(), cls === 'save' ? 2450 : 1950);
    while (ui.toasts.children.length > 3) ui.toasts.firstChild.remove();
  }
  function clearToasts() {
    if (ui) ui.toasts.innerHTML = '';
  }

  function show(el, on) {
    el.classList.toggle('hidden', !on);
  }

  // ---------------------------------------------------------------- your brother and the high five

  function call() {
    gesture();
    if (!G.sides || !['play', 'ended', 'over', 'hide'].includes(G.state)) return 'none';
    if (G.players === 2) return SEA.highFive.start();
    return SEA.buddy.call();
  }

  const buddyApi = {
    toast: (t, c) => toast(t, c),
    player: () => kid().actor,
    spot: () => spots.buddy,
    turnId: () => G.turnId,
    targetSide: () => 1,
    canHint: () => G.state === 'play' && G.game && !G.game.over && current() === kid() && !G.busy && G.waitT <= 0,
    roundOver: () => G.state !== 'play' && G.state !== 'hide',
    showHint() {
      const h = R.hint(G.game.seas[1]);
      if (!h) return null;
      ST.hint(1, h.cell);
      return h;
    },
    clearHint: () => ST.hint(-1, -1),
    players: () => [G.sides[0].actor, G.sides[1].actor],
    meet: () => spots.meet,
    homes: () => spots.owners,
    get flyers() { return flyers; },
  };

  // ---------------------------------------------------------------- input

  let audioReady = false;
  function gesture() {
    if (!audioReady) {
      audioReady = true;
      S.init();
      S.music('title');
    } else S.init();
  }

  // is it a kid's turn to shoot, with nothing flying?
  const aiming = () => G.state === 'play' && G.game && !G.game.over && current() && current().human && !G.auto && !G.busy && G.waitT <= 0;
  const targetSide = () => (G.game ? 1 - G.game.turn : 1);

  function moveCursor(dx, dy) {
    if (!aiming()) return;
    const n = G.size;
    let c = G.cursor;
    const tip = ST.hintAt;
    if (c < 0) c = tip.side === targetSide() && tip.cell >= 0 ? tip.cell : ((n / 2) | 0) * n + ((n / 2) | 0) - (n % 2 ? 0 : 1);
    else {
      const col = Math.min(n - 1, Math.max(0, (c % n) + dx)), row = Math.min(n - 1, Math.max(0, Math.floor(c / n) + dy));
      c = row * n + col;
    }
    G.cursor = c;
    G.hover = -1;
    SEA.sfx.tick();
  }

  // hiding ships: press a ship to pick it up, drag it, let go to put it down; a tap without moving turns it
  function dragStart(at) {
    const sea = G.game.seas[G.hideSide];
    const k = sea.at[at.cell] - 1;
    if (k < 0) return;
    const s = sea.ships[k];
    const off = s.dir ? at.r - s.r : at.c - s.c;
    G.drag = { k, off, from: at.cell, moved: false, r: s.r, c: s.c, ok: true };
    SEA.sfx.lift();
  }
  function dragMove(at) {
    const d = G.drag, sea = G.game.seas[G.hideSide], s = sea.ships[d.k], n = sea.n;
    if (!at || at.side !== G.hideSide) return;
    if (at.cell !== d.from) d.moved = true;
    if (!d.moved) return;
    let r = at.r - (s.dir ? d.off : 0), c = at.c - (s.dir ? 0 : d.off);
    r = Math.max(0, Math.min(n - (s.dir ? s.len : 1), r));
    c = Math.max(0, Math.min(n - (s.dir ? 1 : s.len), c));
    if (r !== d.r || c !== d.c) SEA.sfx.tick();
    d.r = r;
    d.c = c;
    d.ok = R.fits(sea, d.k, r, c, s.dir);
    ST.previewShip(G.hideSide, d.k, r, c, s.dir, d.ok);
  }
  function dragEnd() {
    const d = G.drag, sea = G.game.seas[G.hideSide];
    G.drag = null;
    if (!d) return;
    if (!d.moved) {
      if (R.rotateShip(sea, d.k)) SEA.sfx.turn();
      else SEA.sfx.nope();
    } else if (d.ok && R.moveShip(sea, d.k, d.r, d.c)) SEA.sfx.drop();
    else {
      SEA.sfx.nope();
      toast('SHIPS CAN\'T TOUCH!', 'hint');
    }
    ST.settleShip(G.hideSide, d.k);
  }

  function bindInput() {
    ui.canvas.addEventListener('pointerdown', (e) => {
      gesture();
      const at = ST.pick(e.clientX, e.clientY);
      if (G.state === 'hide') {
        if (at && at.side === G.hideSide) dragStart(at);
      } else if (aiming()) {
        G.press = { id: e.pointerId };
        G.hover = at && at.side === targetSide() ? at.cell : -1;
        G.cursor = -1;
      } else return;
      try {
        ui.canvas.setPointerCapture(e.pointerId);
      } catch (err) { /* old browsers */ }
    });
    ui.canvas.addEventListener('pointermove', (e) => {
      const at = ST.pick(e.clientX, e.clientY);
      if (G.drag) return dragMove(at);
      const pressed = G.press && e.pointerId === G.press.id;
      if (!pressed && e.pointerType !== 'mouse') return;
      const i = aiming() && at && at.side === targetSide() ? at.cell : -1;
      if (i !== G.hover && i >= 0 && R.canShoot(G.game.seas[targetSide()], i)) SEA.sfx.tick();
      G.hover = i;
      ui.canvas.style.cursor = i >= 0 || (G.state === 'hide' && at && at.side === G.hideSide && G.game.seas[G.hideSide].at[at.cell]) ? 'pointer' : '';
    });
    ui.canvas.addEventListener('pointerup', (e) => {
      if (G.drag) return dragEnd();
      if (!G.press || e.pointerId !== G.press.id) return;
      G.press = null;
      const at = ST.pick(e.clientX, e.clientY);
      if (e.pointerType !== 'mouse') G.hover = -1;
      if (at && at.side === targetSide() && aiming()) fireAt(at.cell, true);
    });
    ui.canvas.addEventListener('pointercancel', () => {
      if (G.drag) {
        const d = G.drag;
        G.drag = null;
        ST.settleShip(G.hideSide, d.k);
      }
      G.press = null;
      G.hover = -1;
    });
    ui.canvas.addEventListener('pointerleave', (e) => {
      if (e.pointerType === 'mouse' && !G.press) G.hover = -1;
    });
    const tap = (el, fn) => el.addEventListener('click', (e) => {
      e.stopPropagation();
      gesture();
      fn();
    });
    for (const t of ui.tiles.children) tap(t, () => startMatch({ size: +t.dataset.n }));
    for (const b of ui.segPlayers.children) tap(b, () => setPref('players', +b.dataset.v));
    for (const b of ui.segWho.children) tap(b, () => setPref('who', b.dataset.v));
    for (const b of ui.segLevel.children) tap(b, () => setPref('level', b.dataset.v));
    ui.callBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      call();
    });
    tap(ui.pauseBtn, () => pause(true));
    tap(ui.shuffleBtn, shuffle);
    tap(ui.readyBtn, ready);
    tap(ui.passBtn, passReady);
    tap(ui.pResume, () => pause(false));
    tap(ui.pRestart, restartGame);
    tap(ui.pHome, goHome);
    tap(ui.oAgain, next);
    tap(ui.oHome, goHome);
    tap(ui.muteBtn, toggleMute);
    addEventListener('keydown', (e) => {
      if (e.repeat && !e.key.startsWith('Arrow')) return;
      gesture();
      const k = e.key.toLowerCase();
      if (k === 'm') return toggleMute();
      if (G.state === 'home') {
        const size = { 1: 8, 2: 10 }[e.key];
        if (size) startMatch({ size });
        else if (k === 'arrowleft' || k === 'arrowright') setPref('who', prefs.who === 'teddy' ? 'tommy' : 'teddy');
        else if (k === 'arrowup' || k === 'arrowdown') setPref('players', prefs.players === 1 ? 2 : 1);
        else if (k === 'l') setPref('level', prefs.level === 'easy' ? 'normal' : 'easy');
        else if (k === 'enter' || k === ' ') startMatch({});
        if (k.startsWith('arrow') || k === ' ') e.preventDefault();
        return;
      }
      if (k === 't') return call();
      if (G.state === 'paused') {
        if (k === 'escape' || k === 'p' || k === 'enter' || k === ' ') pause(false);
        else if (k === 'r') restartGame();
        return;
      }
      if (G.state === 'over') {
        if (k === 'enter' || k === ' ' || k === 'r') next();
        else if (k === 'escape') goHome();
        e.preventDefault();
        return;
      }
      if (k === 'escape' || k === 'p') return pause(true);
      if (k === 'r') return restartGame();
      if (G.state === 'pass') {
        if (k === 'enter' || k === ' ') passReady();
        e.preventDefault();
        return;
      }
      if (G.state === 'hide') {
        if (k === 's') shuffle();
        else if (k === 'enter' || k === ' ') ready();
        if (k === ' ') e.preventDefault();
        return;
      }
      if (G.state !== 'play') return;
      if (k === 'arrowleft') moveCursor(-1, 0);
      else if (k === 'arrowright') moveCursor(1, 0);
      else if (k === 'arrowup') moveCursor(0, -1);
      else if (k === 'arrowdown') moveCursor(0, 1);
      else if (k === 'enter' || k === ' ') {
        if (G.cursor < 0) moveCursor(0, 0);
        else fireAt(G.cursor, true);
      }
      if (k.startsWith('arrow') || k === ' ') e.preventDefault();
    });
    addEventListener('resize', () => layout(true));
    document.addEventListener('visibilitychange', () => (document.hidden ? S.suspend() : S.resume()));
  }

  function pause(on) {
    if (on && ['play', 'ended', 'hide', 'pass'].includes(G.state)) {
      G.pausedFrom = G.state;
      G.state = 'paused';
      show(ui.pause, true);
      S.music('pause');
    } else if (!on && G.state === 'paused') {
      G.state = G.pausedFrom || 'play';
      show(ui.pause, false);
      S.music('title');
    }
  }

  function toggleMute() {
    const muted = S.toggleMute();
    ui.muteBtn.textContent = muted ? '🔇' : '🔊';
  }

  // ---------------------------------------------------------------- the loop

  const tmp = new THREE.Vector3();
  function step(dt, draw = true) {
    dt = Math.min(dt, 0.1);
    // the window can start at 0 x 0 (a hidden tab) and resize without an event reaching us: re-fit when it changes
    if ((innerWidth || 1) !== ST.W || (innerHeight || 1) !== ST.H) layout(true);
    const running = G.state !== 'paused' && G.state !== 'boot';
    if (running) {
      if (G.state === 'home') demoUpdate(dt);
      if (G.state === 'play') {
        if (G.waitT > 0) {
          G.waitT -= dt;
          if (G.waitT <= 0 && !G.game.over) nextTurn();
        } else if (G.cpuT > 0) {
          G.cpuT -= dt;
          if (G.cpuT <= 0) {
            const s = current(), sea = G.game.seas[1 - G.game.turn];
            // the test bot (game.auto) plays the kid's side
            fireAt(R.cpuShot(sea, s.human ? G.autoLevel : G.level), false);
          }
        }
        if (G.endT > 0) {
          G.endT -= dt;
          if (G.endT <= 0) endGame();
        }
      }
      if (G.auto && G.state === 'hide') ready();
      if (G.auto && G.state === 'pass') passReady();
      if (G.state === 'ended' && G.panelT > 0) {
        G.panelT -= dt;
        if (G.panelT <= 0) showPanel();
      }
      ST.update(dt);
      flyers.update(dt);
      bursts.update(dt);
      if (G.sides) G.sides.forEach((s) => s.actor.update(dt));
      if (froggy.visible) froggy.update(dt);
      SEA.buddy.update(dt);
      SEA.highFive.update(dt);
    }
    // the emblem over whoever shoots next, and the aim square
    const st = G.game;
    if (G.sides) {
      G.sides.forEach((s, k) => {
        const on = st && !st.over && st.turn === k && (G.state === 'play' || G.state === 'home');
        const bdg = badges[k];
        bdg.visible = !!on;
        if (on) {
          s.actor.root.getWorldPosition(tmp);
          bdg.position.set(tmp.x, tmp.y + 3.3 + Math.abs(Math.sin(performance.now() / 260)) * 0.18, tmp.z);
        }
      });
    }
    if (aiming()) {
      const c = G.hover >= 0 ? G.hover : G.cursor;
      ST.cursor(c >= 0 && R.canShoot(st.seas[targetSide()], c) ? targetSide() : -1, c);
    } else ST.cursor(-1, -1);
    SEA.fx.overlay.update(dt);
    ui.callBtn.classList.toggle('here', SEA.buddy.on || SEA.highFive.on);
    if (draw) ST.render();
  }

  function frame(now) {
    const dt = G.last ? (now - G.last) / 1000 : 0.016;
    G.last = now;
    if (!G.held) step(dt);
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- boot

  function boot() {
    ui = {
      canvas: $('game'), home: $('home'), hud: $('hud'), hudtop: document.querySelector('.hudtop'), hudmid: document.querySelector('.hudmid'), logo: $('logo'), tiles: $('tiles'),
      segPlayers: $('segPlayers'), segWho: $('segWho'), segLevel: $('segLevel'), duo: $('duo'), duoA: $('duoA'), duoB: $('duoB'),
      pauseBtn: $('pauseBtn'), muteBtn: $('muteBtn'), sideL: $('sideL'), sideR: $('sideR'), faceL: $('faceL'), faceR: $('faceR'),
      scoreL: $('scoreL'), scoreR: $('scoreR'), turn: $('turn'), tip: $('tip'), callBtn: $('callBtn'), toasts: $('toasts'),
      hidebar: $('hidebar'), shuffleBtn: $('shuffleBtn'), readyBtn: $('readyBtn'),
      pass: $('pass'), passFace: $('passFace'), passTitle: $('passTitle'), passSub: $('passSub'), passBtn: $('passBtn'),
      over: $('over'), oFace: $('oFace'), oTitle: $('oTitle'), oScore: $('oScore'), oShots: $('oShots'), oAgain: $('oAgain'), oHome: $('oHome'),
      pause: $('pause'), pResume: $('pResume'), pRestart: $('pRestart'), pHome: $('pHome'),
    };
    // the logo: the first word small on top, the rest big ("TT" / "Sea Battle"); a one-word name is all big
    const words = window.SEA_TITLE.split(' ');
    ui.logo.querySelector('small').textContent = words.length > 1 ? words[0] : '';
    ui.logo.querySelector('big').textContent = words.length > 1 ? words.slice(1).join(' ') : words[0];
    // the little seas on the menu tiles: two boats, a splash and a bonk
    for (const t of ui.tiles.children) {
      const n = +t.dataset.n, m = t.querySelector('.mini'), u = 100 / n;
      const boat = (r, c, len, down) => {
        const i = document.createElement('i');
        if (down) i.className = 'v';
        Object.assign(i.style, { left: `${c * u + u * 0.12}%`, top: `${r * u + u * 0.12}%`, width: `${(down ? 1 : len) * u - u * 0.24}%`, height: `${(down ? len : 1) * u - u * 0.24}%` });
        m.appendChild(i);
      };
      const mark = (r, c, e) => {
        const x = document.createElement('em');
        x.textContent = e;
        Object.assign(x.style, { left: `${(c + 0.5) * u}%`, top: `${(r + 0.5) * u}%` });
        m.appendChild(x);
      };
      boat(1, 1, 3, false);
      boat(3, n - 2, 4, true);
      mark(n - 2, 2, '💥');
      mark(2, n - 4, '💧');
    }
    ui.muteBtn.textContent = S.isMuted() ? '🔇' : '🔊';
    ST.init(ui.canvas);
    SEA.fx.overlay.init($('fx'));
    flyers = SEA.fx.flyers(ST.scene, 70);
    bursts = SEA.fx.bursts(ST.scene, 6);
    actors.forEach((a) => a.attach(ST.scene, flyers));
    froggy.attach(ST.scene, flyers);
    froggy.set('froggy', 0.8);
    const fe = Kit.roster.get('froggy');
    const ftag = Kit.gfx.nameTag(fe.name, fe.tag);
    ftag.position.y = 2.75;
    froggy.person.root.add(ftag);
    froggy.visible = false;
    art = Kit.portraits(['teddy', 'tommy', 'foxy', 'froggy'].map((id) => Kit.roster.get(id)), { size: 160 });
    ui.segWho.children[0].querySelector('img').src = art.teddy;
    ui.segWho.children[1].querySelector('img').src = art.tommy;
    for (const b of ui.segLevel.children) b.querySelector('img').src = art.foxy;
    ui.duoA.src = art.teddy;
    ui.duoB.src = art.tommy;
    SEA.buddy.init(buddyApi);
    bindInput();
    goHome();
    $('loading').classList.add('hidden');
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- test hook

  window.game = {
    // advance `secs` of game time in 1/60 s steps, rendering once at the end (works while the pane is hidden)
    step(secs = 0.1) {
      const n = Math.max(1, Math.round(secs * 60));
      for (let i = 0; i < n; i++) step(1 / 60, i === n - 1);
      return game.info();
    },
    hold(on = true) { G.held = on; },
    // start({ size: 8 | 10, players: 1 | 2, who: 'teddy' | 'tommy', level: 'easy' | 'normal' })
    start(opts = {}) {
      startMatch(opts);
      return game.info();
    },
    home: () => goHome(),
    shuffle: () => shuffle(),
    ready: () => ready(),
    passReady: () => passReady(),
    // hiding ships, the way a drag does it: ship k to row r, column c (dir 0 across, 1 down); turn(k) is a tap
    moveShip(k, r, c, dir) {
      const sea = G.game.seas[G.hideSide], s = sea.ships[k];
      const ok = G.state === 'hide' && R.moveShip(sea, k, r, c, dir === undefined ? s.dir : dir);
      if (G.state === 'hide') ST.settleShip(G.hideSide, k);
      return ok;
    },
    turn(k) {
      if (G.state !== 'hide') return false;
      const ok = R.rotateShip(G.game.seas[G.hideSide], k);
      ST.settleShip(G.hideSide, k);
      return ok;
    },
    tap: (i) => aiming() && fireAt(i, true), // shoot square i (row * size + col) of the other sea
    tapRC: (r, c) => aiming() && fireAt(r * G.size + c, true),
    key: (k) => dispatchEvent(new KeyboardEvent('keydown', { key: k })),
    call: () => call(),
    pause: (on = true) => pause(on),
    next: () => next(),
    restart: () => restartGame(),
    // let a test bot play the kids' side too ('sharp', 'normal' or 'easy'): it hides at random, passes and shoots
    auto(on = true, level = 'sharp') {
      G.auto = on;
      G.autoLevel = level;
      if (on && G.state === 'play' && current() && current().human && G.cpuT < 0 && G.waitT <= 0 && !G.busy) G.cpuT = 0.35;
    },
    check: (opts) => SEA.check(opts),
    rates: (n) => SEA.rates(n),
    info() {
      const st = G.game;
      const sea = (k) => st && { shots: st.seas[k].shots, hits: st.seas[k].hits, sunk: st.seas[k].sunk, ships: st.seas[k].ships.length, shown: ST.board(k).shipShow };
      return {
        state: G.state, players: G.players, level: G.level, size: G.size, hideSide: G.hideSide, viewer: G.viewer,
        pass: G.pass && Object.assign({}, G.pass), sides: G.sides && G.sides.map((s) => ({ id: s.id, human: s.human, pose: s.actor.pose })),
        turn: st && st.turn, over: st && st.over, winner: st && st.winner, shots: st && st.shots.slice(), seas: st && [sea(0), sea(1)],
        busy: G.busy, last: G.lastEv && { cell: G.lastEv.cell, result: G.lastEv.result, side: G.lastEv.side }, score: score().slice(),
        best: Object.assign({}, prefs.best), games: G.games, buddy: SEA.buddy.info(), hint: ST.hintAt, cursor: ST.cursorAt,
        target: ST.targetSide, panel: !ui.over.classList.contains('hidden') ? 'over' : null, passShown: !ui.pass.classList.contains('hidden'),
        step: ST.stepPx(1), froggy: froggy.visible,
      };
    },
    get G() { return G; },
    get rules() { return R; },
  };

  let booted = false;
  const go = () => {
    if (booted) return;
    booted = true;
    boot();
  };
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(go, go);
  setTimeout(go, 1500);
})();

/* TT Sea Battle: the renderer, the ocean and the two seas.
   Each player's sea is a toy tray floating on the ocean: a grid of water squares in a wooden frame painted in the
   owner's colour, numbers along the top and letters down the left, and along the front a strip of little ships
   showing which of that fleet are still afloat. The owner stands on a raft beside it with a toy cannon.
   The sea being shot at is big and the other one small (your own is big while you hide your ships), so the squares
   you tap are as big as the screen allows. Wide screens: the two seas side by side, the owners behind them. Tall
   screens: your sea in front, the other behind; you stand on a raft beside whichever is small.
     layout(wide, focus)   place everything for this screen shape, with the `focus` sea big and the other small;
                           returns the spots (where people stand)
     setSize(n)            a new grid on both seas, cleared
     setFleet(side, sea, show)   build that side's ships; show: 'all' (yours), 'sunk' (the other side's), 'none'
     showShips(side, show) / previewShip(side, k, r, c, dir, ok)   (hiding ships: drag and turn)
     mark(side, cell, kind)       a peg: 'miss' (white), 'hit' (red, with a little flame) or 'water' (a clear dot)
     sink(side, k)                the ship rises into view (if hidden), tips over and settles, grey
     shoot(from, toSide, cell, cb)   the cannon turns, booms, and the ball arcs over; cb() when it lands
     splash(side, cell), bonk(side, cell)   the landing
     cursor(side, cell), hint(side, cell), target(side)   where you aim, your brother's tip, the sea being shot at
     pick(x, y)            { side, cell } under a screen point, or null
   fit(points, elev, margins) aims the camera so world points fill the screen minus margins (in pixels). */
(function () {
  'use strict';
  const T = THREE;
  const SEA = (window.SEA = window.SEA || {});
  const { makeCanvas, toTexture, std, rand, radialTexture, emojiTexture, glowTexture, shade, FONT } = Kit.gfx;

  const SPAN = 6; // the grid, edge to edge
  const RIM = 0.48; // the frame round it
  const OUT = SPAN / 2 + RIM; // half the tray, frame and all
  const WATER_Y = 0.22, RIM_TOP = 0.4, DOCK_Y = 0.24;
  const GAP = { wide: 1.3, tall: 2.5 }; // between the two trays

  let renderer = null, W = 1, H = 1, n = 10, pitch = SPAN / 10;
  const scene = new T.Scene();
  const cam = new T.PerspectiveCamera(36, 1, 0.1, 400);
  const tmp = new T.Vector3(), tmp2 = new T.Vector3();
  const boards = [], cannons = [], rafts = [];
  const look = [{ color: '#2f6fe0', emblem: '🏀' }, { color: '#21b38a', emblem: '🦊' }];
  const fx = { t: 0, target: -1, cursor: { side: -1, cell: -1 }, hint: { side: -1, cell: -1 } };
  let oceanTex = null, gridTex = null, cursorMesh = null, cursorSprite = null, hintGlow = null, hintFinger = null;
  const balls = [], rings = [];

  function init(canvas) {
    renderer = new T.WebGLRenderer({ canvas, antialias: true });
    renderer.outputEncoding = T.sRGBEncoding;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    buildOcean();
    for (let s = 0; s < 2; s++) {
      boards.push(buildBoard(s));
      cannons.push(buildCannon(s));
    }
    for (let k = 0; k < 4; k++) rafts.push(buildRaft()); // the two owners' (with their cannons), your brother's, Froggy's
    buildPointers();
    setSize(10);
    resize();
  }

  function resize() {
    W = Math.max(1, innerWidth || 1);
    H = Math.max(1, innerHeight || 1);
    if (renderer) renderer.setSize(W, H, false);
    cam.aspect = W / H;
    cam.updateProjectionMatrix();
  }

  // ---------------------------------------------------------------- the ocean and the islands

  function oceanTexture() {
    const [c, g] = makeCanvas(256, 256);
    g.fillStyle = '#2b9be0';
    g.fillRect(0, 0, 256, 256);
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 3;
    g.lineCap = 'round';
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 256, y = Math.random() * 256;
      g.beginPath();
      g.arc(x, y, 9, Math.PI * 1.15, Math.PI * 1.85);
      g.arc(x + 17, y, 9, Math.PI * 1.15, Math.PI * 1.85);
      g.stroke();
    }
    return toTexture(c, true);
  }

  function palm(x, z, s = 1) {
    const g = new T.Group();
    const trunkMat = std('#a8743f', { roughness: 0.9 }), leafMat = std('#3fbf4a', { roughness: 0.8 });
    for (let k = 0; k < 5; k++) {
      const seg = new T.Mesh(new T.CylinderGeometry(0.17 - k * 0.015, 0.19 - k * 0.015, 0.6, 8), trunkMat);
      seg.position.set(k * 0.08, 0.3 + k * 0.56, 0);
      seg.rotation.z = -0.1;
      g.add(seg);
    }
    for (let k = 0; k < 6; k++) {
      const leaf = new T.Mesh(new T.BoxGeometry(1.6, 0.06, 0.42), leafMat);
      const a = (k / 6) * Math.PI * 2;
      leaf.position.set(0.4 + Math.cos(a) * 0.7, 2.95, Math.sin(a) * 0.7);
      leaf.rotation.set(0, -a, -0.35);
      g.add(leaf);
    }
    const nut = new T.Mesh(new T.SphereGeometry(0.16, 8, 6), std('#6b4a24'));
    nut.position.set(0.4, 2.75, 0.15);
    g.add(nut);
    g.position.set(x, 0, z);
    g.scale.setScalar(s);
    scene.add(g);
  }

  function island(x, z, r, palms) {
    const sand = new T.Mesh(new T.CylinderGeometry(r * 0.85, r, 0.5, 24), std('#f3d48a', { roughness: 1 }));
    sand.position.set(x, 0.05, z);
    sand.scale.z = 0.7;
    scene.add(sand);
    palms.forEach(([dx, dz, s]) => palm(x + dx, z + dz, s));
  }

  function lighthouse(x, z) {
    const g = new T.Group();
    const red = std('#e8372c'), white = std('#ffffff');
    for (let k = 0; k < 5; k++) {
      const seg = new T.Mesh(new T.CylinderGeometry(0.55 - (k + 1) * 0.05, 0.55 - k * 0.05, 0.7, 16), k % 2 ? white : red);
      seg.position.y = 0.6 + k * 0.7;
      g.add(seg);
    }
    const lamp = new T.Mesh(new T.CylinderGeometry(0.32, 0.32, 0.45, 12), std('#fff6a0', { emissive: '#ffe066', emissiveIntensity: 0.8 }));
    lamp.position.y = 4.3;
    g.add(lamp);
    const roof = new T.Mesh(new T.ConeGeometry(0.45, 0.5, 12), red);
    roof.position.y = 4.78;
    g.add(roof);
    const rock = new T.Mesh(new T.CylinderGeometry(1.2, 1.5, 0.6, 9), std('#8d8f99', { roughness: 1 }));
    rock.position.y = 0.1;
    g.add(rock);
    g.position.set(x, 0, z);
    scene.add(g);
  }

  function buildOcean() {
    scene.background = new T.Color('#9fdcff');
    scene.add(new T.HemisphereLight('#ffffff', '#3a6f9a', 0.9));
    const sun = new T.DirectionalLight('#fff3dc', 0.95);
    sun.position.set(-6, 14, 8);
    scene.add(sun);
    oceanTex = oceanTexture();
    oceanTex.repeat.set(36, 36);
    const sea = new T.Mesh(new T.PlaneGeometry(260, 260), std('#ffffff', { map: oceanTex, roughness: 0.55, metalness: 0.05 }));
    sea.rotation.x = -Math.PI / 2;
    scene.add(sea);
    island(-15, -10, 3, [[0, 0, 1], [1.2, 0.5, 0.8]]);
    island(15, -9, 2.6, [[0, 0, 0.9]]);
    island(-17, 6, 2.4, [[0.3, 0, 0.85]]);
    island(16, 8, 3.2, [[-0.6, 0, 1], [0.9, -0.4, 0.75]]);
    island(0, -17, 2.8, [[0, 0, 1]]);
    lighthouse(-9, -15);
    // a few clouds' shadows would be nice; puffy clouds far off instead
    const cloudMat = std('#ffffff', { roughness: 1, emissive: '#ffffff', emissiveIntensity: 0.35 });
    for (const [x, y, z, s] of [[-20, 9, -30, 1.3], [12, 10, -34, 1.6], [28, 8, -20, 1.1], [-32, 7, -12, 1.2]]) {
      const c = new T.Group();
      for (let k = 0; k < 4; k++) {
        const b = new T.Mesh(new T.SphereGeometry(1.4 - k * 0.15, 12, 10), cloudMat);
        b.position.set(k * 1.3 - 2, Math.sin(k * 2) * 0.4, 0);
        c.add(b);
      }
      c.position.set(x, y, z);
      c.scale.setScalar(s);
      scene.add(c);
    }
  }

  // ---------------------------------------------------------------- the trays

  // the water squares of a tray: light sea blue, little waves, white grid lines
  function gridTexture(size) {
    const px = 512, cell = px / size;
    const [c, g] = makeCanvas(px, px);
    const grad = g.createLinearGradient(0, 0, px, px);
    grad.addColorStop(0, '#5cc3ff');
    grad.addColorStop(1, '#2f9be8');
    g.fillStyle = grad;
    g.fillRect(0, 0, px, px);
    g.strokeStyle = 'rgba(255,255,255,0.22)';
    g.lineWidth = 2;
    for (let r = 0; r < size; r++) for (let col = 0; col < size; col++) {
      if ((r * 7 + col * 3) % 4) continue;
      const x = (col + 0.3) * cell, y = (r + 0.55) * cell;
      g.beginPath();
      g.arc(x, y, cell * 0.12, Math.PI * 1.1, Math.PI * 1.9);
      g.arc(x + cell * 0.24, y, cell * 0.12, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = 2.5;
    for (let k = 1; k < size; k++) {
      g.beginPath();
      g.moveTo(k * cell, 0);
      g.lineTo(k * cell, px);
      g.moveTo(0, k * cell);
      g.lineTo(px, k * cell);
      g.stroke();
    }
    return toTexture(c);
  }

  // numbers along the top (columns) or letters down the left (rows), white on the painted frame
  function labelTexture(size, letters) {
    const len = 512, wide = 64;
    const [c, g] = letters ? makeCanvas(wide, len) : makeCanvas(len, wide);
    g.font = `${size > 8 ? 34 : 40}px ${FONT}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(20,18,31,0.55)';
    g.fillStyle = '#ffffff';
    for (let k = 0; k < size; k++) {
      const t = letters ? String.fromCharCode(65 + k) : String(k + 1);
      const at = ((k + 0.5) / size) * len;
      const [x, y] = letters ? [wide / 2, at] : [at, wide / 2 + 2];
      g.strokeText(t, x, y);
      g.fillText(t, x, y);
    }
    return toTexture(c);
  }

  function buildBoard(side) {
    const grp = new T.Group();
    scene.add(grp);
    const b = { side, grp, ships: [], shipShow: 'none', marks: new Map(), sunk: new Set(), bars: [], labels: [], s: undefined, sTo: 1, pTo: new T.Vector3() };
    // the tray's bottom, the water squares and a soft glow underneath (the sea being shot at)
    const base = new T.Mesh(new T.BoxGeometry(OUT * 2, 0.26, OUT * 2), std('#6b4a2a', { roughness: 0.9 }));
    base.position.y = 0.02; // its top stays under the water squares (no flicker between the two)
    grp.add(base);
    b.water = new T.Mesh(new T.PlaneGeometry(SPAN, SPAN), std('#ffffff', { roughness: 0.35, metalness: 0.05 }));
    b.water.rotation.x = -Math.PI / 2;
    b.water.position.y = WATER_Y;
    grp.add(b.water);
    b.glow = new T.Mesh(new T.PlaneGeometry(OUT * 2 + 2.2, OUT * 2 + 2.2), new T.MeshBasicMaterial({ map: radialTexture(128, [[0, 'rgba(255,224,90,0.9)'], [0.62, 'rgba(255,224,90,0.55)'], [1, 'rgba(255,224,90,0)']]), transparent: true, depthWrite: false }));
    b.glow.rotation.x = -Math.PI / 2;
    b.glow.position.y = 0.03;
    b.glow.visible = false;
    grp.add(b.glow);
    // the frame: top (numbers), left (letters), front (the fleet strip), right
    b.paint = std(look[side].color, { roughness: 0.6 });
    const barH = RIM_TOP - WATER_Y + 0.06;
    const mk = (w, d, x, z) => {
      const mats = [b.paint, b.paint, b.paint, b.paint, b.paint, b.paint];
      const m = new T.Mesh(new T.BoxGeometry(w, barH, d), mats);
      m.position.set(x, WATER_Y - 0.06 + barH / 2, z);
      grp.add(m);
      b.bars.push(m);
      return m;
    };
    b.top = mk(OUT * 2, RIM, 0, -(SPAN / 2 + RIM / 2));
    b.front = mk(OUT * 2, RIM, 0, SPAN / 2 + RIM / 2);
    b.left = mk(RIM, SPAN, -(SPAN / 2 + RIM / 2), 0);
    b.right = mk(RIM, SPAN, SPAN / 2 + RIM / 2, 0);
    // flat planes on the bars for the labels and the fleet strip
    const flat = (w, d, x, z) => {
      const m = new T.Mesh(new T.PlaneGeometry(w, d), new T.MeshBasicMaterial({ transparent: true, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.set(x, RIM_TOP + 0.005, z);
      m.renderOrder = 2;
      grp.add(m);
      return m;
    };
    b.numbers = flat(SPAN, RIM * 0.9, 0, -(SPAN / 2 + RIM / 2));
    b.letters = flat(RIM * 0.9, SPAN, -(SPAN / 2 + RIM / 2), 0);
    b.strip = flat(OUT * 2 - 0.2, RIM * 0.92, 0, SPAN / 2 + RIM / 2);
    b.stripCanvas = makeCanvas(1024, 72);
    b.strip.material.map = toTexture(b.stripCanvas[0]);
    b.marksGrp = new T.Group();
    grp.add(b.marksGrp);
    b.shipsGrp = new T.Group();
    grp.add(b.shipsGrp);
    return b;
  }

  // a side's colour and emblem (Teddy blue 🏀, Tommy orange ✌️, Foxy teal 🦊)
  function setLook(side, color, emblem) {
    look[side] = { color, emblem };
    const b = boards[side];
    if (!b) return;
    b.paint.color.set(color);
    cannons[side].flag.material.map = emojiTexture(emblem);
    cannons[side].flag.material.needsUpdate = true;
  }

  // the strip along the front of a tray: one little ship per ship in the fleet, sunk ones grey and crossed out
  function drawStrip(side, sea) {
    const b = boards[side], [c, g] = b.stripCanvas;
    g.clearRect(0, 0, c.width, c.height);
    if (!sea) {
      b.strip.material.map.needsUpdate = true;
      return;
    }
    const total = sea.ships.reduce((a, s) => a + s.len, 0) + (sea.ships.length - 1) * 0.8;
    const u = Math.min(64, (c.width - 40) / total), h = 40, y = (c.height - h) / 2;
    let x = (c.width - total * u) / 2;
    for (const s of sea.ships) {
      const w = s.len * u - 6;
      g.save();
      g.beginPath();
      g.moveTo(x, y + 6);
      g.lineTo(x + w - h * 0.55, y + 6);
      g.lineTo(x + w, y + h / 2 + 3);
      g.lineTo(x + w - h * 0.55, y + h);
      g.lineTo(x + 4, y + h);
      g.quadraticCurveTo(x, y + h, x, y + h - 6);
      g.closePath();
      g.fillStyle = s.sunk ? '#8a8f9c' : '#ffffff';
      g.fill();
      g.lineWidth = 4;
      g.strokeStyle = '#14121f';
      g.stroke();
      // a cabin
      g.fillStyle = s.sunk ? '#6b707c' : look[side].color;
      g.fillRect(x + w * 0.22, y - 2, Math.max(10, w * 0.28), 12);
      g.strokeRect(x + w * 0.22, y - 2, Math.max(10, w * 0.28), 12);
      if (s.sunk) {
        g.strokeStyle = '#e8372c';
        g.lineWidth = 7;
        g.beginPath();
        g.moveTo(x + 4, y + 4);
        g.lineTo(x + w - 4, y + h);
        g.moveTo(x + w - 4, y + 4);
        g.lineTo(x + 4, y + h);
        g.stroke();
      }
      g.restore();
      x += w + 6 + u * 0.8;
    }
    b.strip.material.map.needsUpdate = true;
  }

  // ---------------------------------------------------------------- ships

  // A toy ship `len` squares long, built for squares 1 unit wide (scaled by the pitch), along +x, bow at +x.
  function hullGeo(L, w, h) {
    const s = new T.Shape(), x0 = -L / 2, x1 = L / 2, hw = w / 2, bow = Math.min(0.55, L * 0.22);
    s.moveTo(x0 + 0.1, -hw);
    s.lineTo(x1 - bow, -hw);
    s.quadraticCurveTo(x1 - 0.06, -hw * 0.9, x1, 0);
    s.quadraticCurveTo(x1 - 0.06, hw * 0.9, x1 - bow, hw);
    s.lineTo(x0 + 0.1, hw);
    s.quadraticCurveTo(x0, hw, x0, hw - 0.1);
    s.lineTo(x0, -hw + 0.1);
    s.quadraticCurveTo(x0, -hw, x0 + 0.1, -hw);
    const g = new T.ExtrudeGeometry(s, { depth: h, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 2, curveSegments: 8 });
    g.rotateX(-Math.PI / 2);
    return g;
  }

  function makeShip(kind, len, side) {
    const color = look[side].color;
    const grp = new T.Group(), body = new T.Group();
    grp.add(body);
    const hullMat = std(color, { roughness: 0.45 }), white = std('#ffffff', { roughness: 0.5 }), dark = std('#2a2d3a', { roughness: 0.5 });
    const deckMat = std(new T.Color(color).lerp(new T.Color('#fff6e0'), 0.45), { roughness: 0.8 }), glass = std('#9fe3ff', { roughness: 0.2, metalness: 0.1 });
    const L = len * 0.9;
    const add = (geo, mat, x, y, z) => {
      const m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      body.add(m);
      return m;
    };
    const windows = (x, y, w, z) => add(new T.BoxGeometry(w, 0.07, 0.02), dark, x, y, z);
    let emblemAt = [-L / 2 + 0.45, 0.24];
    if (kind === 'sub') {
      // a round tube, low in the water, with a tower and a periscope
      const tube = add(new T.CylinderGeometry(0.27, 0.27, L - 0.5, 16), hullMat, 0, 0.02, 0);
      tube.rotation.z = Math.PI / 2;
      add(new T.SphereGeometry(0.27, 14, 10), hullMat, (L - 0.5) / 2, 0.02, 0);
      add(new T.SphereGeometry(0.27, 14, 10), hullMat, -(L - 0.5) / 2, 0.02, 0);
      add(new T.BoxGeometry(0.62, 0.34, 0.3), hullMat, -0.1, 0.36, 0);
      add(new T.BoxGeometry(0.66, 0.05, 0.34), white, -0.1, 0.54, 0);
      add(new T.CylinderGeometry(0.03, 0.03, 0.3, 6), dark, 0.05, 0.7, 0);
      add(new T.BoxGeometry(0.14, 0.05, 0.05), dark, 0.11, 0.84, 0);
      const fin = add(new T.BoxGeometry(0.3, 0.04, 0.7), hullMat, -L / 2 + 0.3, 0.06, 0);
      fin.rotation.y = 0;
      emblemAt = [-0.1, 0.575];
    } else {
      const w = kind === 'speed' ? 0.5 : kind === 'tug' ? 0.7 : 0.64;
      const h = kind === 'speed' ? 0.2 : 0.28;
      const hull = new T.Mesh(hullGeo(L, w, h), hullMat);
      hull.position.y = -0.1;
      body.add(hull);
      const deck = new T.Mesh(hullGeo(L - 0.16, w - 0.14, 0.02), deckMat);
      deck.position.y = h - 0.08;
      body.add(deck);
      const top = h - 0.06;
      if (kind === 'giant') {
        add(new T.BoxGeometry(1.5, 0.3, 0.46), white, -0.45, top + 0.15, 0);
        add(new T.BoxGeometry(0.9, 0.24, 0.38), white, -0.55, top + 0.42, 0);
        windows(-0.45, top + 0.2, 1.3, 0.235);
        windows(-0.45, top + 0.2, 1.3, -0.235);
        for (const fx of [0.55, 1.05]) {
          add(new T.CylinderGeometry(0.13, 0.15, 0.5, 12), hullMat, fx, top + 0.25, 0);
          add(new T.CylinderGeometry(0.135, 0.135, 0.1, 12), dark, fx, top + 0.53, 0);
        }
        emblemAt = [-1.65, top + 0.03];
      } else if (kind === 'big') {
        add(new T.BoxGeometry(1.0, 0.32, 0.46), white, -0.35, top + 0.16, 0);
        windows(-0.35, top + 0.22, 0.85, 0.235);
        windows(-0.35, top + 0.22, 0.85, -0.235);
        add(new T.CylinderGeometry(0.14, 0.16, 0.5, 12), hullMat, 0.3, top + 0.25, 0);
        add(new T.CylinderGeometry(0.145, 0.145, 0.1, 12), dark, 0.3, top + 0.53, 0);
        add(new T.CylinderGeometry(0.2, 0.22, 0.14, 14), white, 1.05, top + 0.07, 0);
        const gun = add(new T.CylinderGeometry(0.04, 0.04, 0.45, 8), dark, 1.3, top + 0.12, 0);
        gun.rotation.z = Math.PI / 2;
        emblemAt = [-1.25, top + 0.03];
      } else if (kind === 'speed') {
        const shield = add(new T.BoxGeometry(0.1, 0.16, 0.4), glass, 0.25, top + 0.08, 0);
        shield.rotation.z = -0.5;
        add(new T.BoxGeometry(0.3, 0.12, 0.34), white, -0.1, top + 0.06, 0);
        add(new T.BoxGeometry(L - 0.5, 0.012, 0.08), white, -0.05, top + 0.005, 0);
        add(new T.BoxGeometry(0.16, 0.2, 0.2), dark, -L / 2 + 0.12, top + 0.02, 0);
        emblemAt = [-0.75, top + 0.03];
      } else {
        // the tug: a tall cabin, a fat funnel, tyres on its sides
        add(new T.BoxGeometry(0.62, 0.42, 0.52), white, 0.0, top + 0.21, 0);
        windows(0.0, top + 0.3, 0.5, 0.265);
        windows(0.0, top + 0.3, 0.5, -0.265);
        add(new T.BoxGeometry(0.68, 0.05, 0.58), hullMat, 0.0, top + 0.44, 0);
        add(new T.CylinderGeometry(0.15, 0.17, 0.42, 12), hullMat, -0.5, top + 0.21, 0);
        add(new T.CylinderGeometry(0.155, 0.155, 0.08, 12), dark, -0.5, top + 0.44, 0);
        const tyreGeo = new T.TorusGeometry(0.09, 0.04, 6, 12);
        for (const tx of [-0.35, 0.3]) for (const tz of [-1, 1]) {
          const t = add(tyreGeo, dark, tx, 0.1, tz * 0.37);
          t.rotation.y = 0;
        }
        emblemAt = [0.0, top + 0.475];
      }
    }
    // the owner's emblem on the deck (or the tower, or the cabin roof), facing up
    const em = new T.Mesh(new T.CircleGeometry(0.17, 20), new T.MeshBasicMaterial({ map: emojiTexture(look[side].emblem), transparent: true, depthWrite: false }));
    em.rotation.x = -Math.PI / 2;
    em.position.set(emblemAt[0], emblemAt[1] + 0.012, 0);
    em.renderOrder = 3;
    body.add(em);
    const disc = new T.Mesh(new T.CircleGeometry(0.21, 20), white);
    disc.rotation.x = -Math.PI / 2;
    disc.position.set(emblemAt[0], emblemAt[1] + 0.006, 0);
    body.add(disc);
    return { grp, body, kind, len, phase: rand(0, 6), sunkT: -1, rise: 0, tint: null };
  }

  // the centre of a ship lying at (r, c, dir), in the tray's own coordinates
  function shipCentre(len, r, c, dir, out) {
    const cc = c + (dir ? 0 : (len - 1) / 2), rr = r + (dir ? (len - 1) / 2 : 0);
    return out.set(-SPAN / 2 + (cc + 0.5) * pitch, WATER_Y, -SPAN / 2 + (rr + 0.5) * pitch);
  }

  function placeShipMesh(sh, r, c, dir) {
    shipCentre(sh.len, r, c, dir, sh.grp.position);
    sh.grp.rotation.y = dir ? -Math.PI / 2 : 0;
  }

  // Build a side's fleet from its sea. show: 'all' every ship, 'sunk' only sunk ones, 'none'.
  function setFleet(side, sea, show = 'all') {
    const b = boards[side];
    for (const sh of b.ships) b.shipsGrp.remove(sh.grp);
    b.ships = sea.ships.map((s) => {
      const sh = makeShip(s.kind, s.len, side);
      sh.grp.scale.setScalar(pitch);
      placeShipMesh(sh, s.r, s.c, s.dir);
      b.shipsGrp.add(sh.grp);
      return sh;
    });
    b.sea = sea;
    showShips(side, show);
    drawStrip(side, sea);
  }

  function showShips(side, show) {
    const b = boards[side];
    b.shipShow = show;
    b.ships.forEach((sh, k) => {
      const s = b.sea.ships[k];
      sh.grp.visible = show === 'all' || (show === 'sunk' && s.sunk);
      if (sh.grp.visible && s.sunk && sh.sunkT < 0) sh.sunkT = 9; // shown already sunk: settled
    });
  }

  // hiding ships: ship k follows a drag; ok false tints it red (it won't fit there)
  function previewShip(side, k, r, c, dir, ok) {
    const sh = boards[side].ships[k];
    if (!sh) return;
    placeShipMesh(sh, r, c, dir);
    sh.grp.position.y = WATER_Y + 0.12;
    tintShip(sh, ok ? null : '#ff5050');
  }
  function settleShip(side, k) {
    const b = boards[side], sh = b.ships[k], s = b.sea.ships[k];
    placeShipMesh(sh, s.r, s.c, s.dir);
    tintShip(sh, null);
    sh.pop = 0.25;
  }
  function tintShip(sh, color) {
    if (sh.tint === color) return;
    sh.tint = color;
    sh.body.traverse((o) => {
      if (!o.isMesh || !o.material.emissive) return;
      if (!o.userData.own) {
        o.material = o.material.clone();
        o.userData.own = true;
      }
      o.material.emissive.set(color || '#000000');
      o.material.emissiveIntensity = color ? 0.55 : 0;
    });
  }

  function sink(side, k) {
    const b = boards[side], sh = b.ships[k];
    if (!sh) return;
    b.sunk.add(k);
    sh.grp.visible = true;
    sh.sunkT = 0;
    sh.rise = b.shipShow === 'all' ? 0 : 1; // a hidden ship comes up from below first
    // grey it down
    sh.body.traverse((o) => {
      if (!o.isMesh || !o.material.color || o.material.isMeshBasicMaterial) return;
      if (!o.userData.own) {
        o.material = o.material.clone();
        o.userData.own = true;
      }
      o.material.color.lerp(new T.Color('#7b8190'), 0.55);
    });
    drawStrip(side, b.sea);
    // the flames on its squares go out
    for (const i of R().cellsOf(b.sea.n, b.sea.ships[k])) {
      const m = b.marks.get(i);
      if (m && m.flame) m.flame.visible = false;
    }
  }
  const R = () => SEA.rules;

  // ---------------------------------------------------------------- pegs and marks

  const pegGeo = new T.CylinderGeometry(0.09, 0.1, 0.26, 12), pegTop = new T.SphereGeometry(0.1, 12, 8), dotGeo = new T.CircleGeometry(0.08, 14);
  const pegMat = { miss: std('#ffffff', { roughness: 0.4 }), hit: std('#ff3b3b', { roughness: 0.35, emissive: '#7a0000', emissiveIntensity: 0.4 }) };
  const dotMat = new T.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.5, depthWrite: false });

  function mark(side, cell, kind) {
    const b = boards[side];
    const old = b.marks.get(cell);
    if (old) b.marksGrp.remove(old.grp);
    const grp = new T.Group();
    cellLocal(cell, grp.position);
    const m = { grp, kind, flame: null, t: 0 };
    if (kind === 'water') {
      const d = new T.Mesh(dotGeo, dotMat);
      d.rotation.x = -Math.PI / 2;
      d.position.y = 0.01;
      d.scale.setScalar(pitch / 0.6);
      grp.add(d);
    } else {
      const s = pitch / 0.6;
      const peg = new T.Mesh(pegGeo, pegMat[kind]);
      peg.position.y = 0.16 * s;
      const top = new T.Mesh(pegTop, pegMat[kind]);
      top.position.y = 0.29 * s;
      grp.add(peg, top);
      peg.scale.setScalar(s);
      top.scale.setScalar(s);
      // the peg sits on top of the ship if there is one there
      if (kind === 'hit') {
        grp.position.y += 0.2 * s;
        m.flame = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🔥'), transparent: true, depthWrite: false }));
        m.flame.position.y = 0.42 * s;
        m.flame.scale.setScalar(0.42 * s);
        m.flame.renderOrder = 6;
        grp.add(m.flame);
      }
      m.pop = 0;
    }
    b.marksGrp.add(grp);
    b.marks.set(cell, m);
  }

  function clearMarks(side) {
    const b = boards[side];
    for (const m of b.marks.values()) b.marksGrp.remove(m.grp);
    b.marks.clear();
    b.sunk.clear();
  }

  // ---------------------------------------------------------------- the cannons and rafts

  function buildRaft() {
    const g = new T.Group();
    const wood = std('#b07a43', { roughness: 0.9 }), dark = std('#8a5a2e', { roughness: 0.9 });
    for (let k = 0; k < 5; k++) {
      const plank = new T.Mesh(new T.BoxGeometry(0.36, 0.16, 1.5), k % 2 ? wood : dark);
      plank.position.set(-0.76 + k * 0.38, DOCK_Y - 0.08, 0);
      g.add(plank);
    }
    for (const x of [-0.95, 0.95]) {
      const barrel = new T.Mesh(new T.CylinderGeometry(0.16, 0.16, 1.5, 10), std('#6b4a2a'));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(x, 0.06, 0);
      g.add(barrel);
    }
    scene.add(g);
    return g;
  }

  function buildCannon(side) {
    const g = new T.Group(), yaw = new T.Group(), pitchG = new T.Group();
    g.add(yaw);
    const wood = std('#8a5a2e', { roughness: 0.8 }), iron = std('#3a3f4f', { roughness: 0.35, metalness: 0.5 });
    const cart = new T.Mesh(new T.BoxGeometry(0.5, 0.2, 0.7), wood);
    cart.position.y = DOCK_Y + 0.22;
    yaw.add(cart);
    for (const x of [-0.29, 0.29]) for (const z of [-0.22, 0.22]) {
      const w = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 0.07, 14), wood);
      w.rotation.z = Math.PI / 2;
      w.position.set(x, DOCK_Y + 0.15, z);
      yaw.add(w);
    }
    pitchG.position.set(0, DOCK_Y + 0.38, 0.05);
    yaw.add(pitchG);
    const barrel = new T.Mesh(new T.CylinderGeometry(0.12, 0.16, 0.85, 14), iron);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.z = -0.25;
    pitchG.add(barrel);
    const lip = new T.Mesh(new T.TorusGeometry(0.12, 0.035, 8, 14), iron);
    lip.position.z = -0.67;
    pitchG.add(lip);
    const back = new T.Mesh(new T.SphereGeometry(0.15, 12, 8), iron);
    back.position.z = 0.17;
    pitchG.add(back);
    pitchG.rotation.x = 0.45;
    const muzzle = new T.Object3D();
    muzzle.position.z = -0.72;
    pitchG.add(muzzle);
    // a little flag with the side's emblem
    const flag = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture(look[side].emblem), transparent: true, depthWrite: false }));
    flag.position.set(0.3, DOCK_Y + 0.85, 0.3);
    flag.scale.setScalar(0.42);
    yaw.add(flag);
    scene.add(g);
    return { g, yaw, pitchG, muzzle, flag, want: 0, recoil: 0 };
  }

  // ---------------------------------------------------------------- layout

  const SMALL = 0.55; // the sea that isn't being shot at (or hidden in) shrinks to this
  let lastFront = -1; // which sea was in front on a tall screen (-1: a wide one)

  // Where the trays, rafts, cannons and people go. focus: the sea that's big (the one being shot at, or the one
  // whose ships are being hidden); the other one shrinks. -1: both big (the menu).
  // Wide: side by side, the owners behind them. Tall: the big sea in front and the small one behind it, the owners
  // either side of the small one (on the menu side 0's sea is in front, its owner on a raft between the two).
  function layout(wide, focus = -1, snap = false) {
    const small = wide ? SMALL : 0.5;
    const sc = [focus === 1 ? small : 1, focus === 0 ? small : 1];
    const hw = sc.map((k) => OUT * k);
    const gap = wide ? GAP.wide : focus < 0 ? GAP.tall : 0.8;
    // tall: the big sea in front (nearest your thumbs), the small one behind it; on the menu side 0's in front
    const front = focus < 0 ? 0 : focus, back = 1 - front;
    if (!wide && front !== lastFront) snap = true; // the seas trade places: gliding would slide one through the other
    lastFront = wide ? -1 : front;
    const centres = [];
    if (wide) centres.push([-(hw[0] + gap / 2), 0], [hw[1] + gap / 2, 0]);
    else {
      centres[front] = [0, hw[front] + gap / 2];
      centres[back] = [0, -(hw[back] + gap / 2)];
    }
    let owners, cannonAt, buddy, extra, meet = null;
    if (wide) {
      const z = (k) => -(hw[k] + 0.95);
      owners = [{ x: centres[0][0] - 1.55, z: z(0), face: Math.PI }, { x: centres[1][0] + 1.55, z: z(1), face: Math.PI }];
      cannonAt = [{ x: centres[0][0] + 0.1, z: z(0) + 0.05 }, { x: centres[1][0] - 0.1, z: z(1) + 0.05 }];
      buddy = { x: owners[0].x - 1.4, z: z(0) + 0.25, face: Math.PI + 0.35 };
      extra = { x: owners[1].x + 1.4, z: z(1) + 0.25, face: Math.PI - 0.35 };
      meet = [{ x: -0.55, z: Math.min(z(0), z(1)) }, { x: 0.55, z: Math.min(z(0), z(1)) }];
    } else if (focus < 0) {
      // the menu: side 0 on a raft between the seas, side 1 behind the far one
      const far = centres[1][1] - hw[1] - 0.95;
      owners = [{ x: -2.1, z: 0.35, face: Math.PI + 0.2 }, { x: -1.5, z: far, face: Math.PI }];
      cannonAt = [{ x: -0.7, z: 0.3 }, { x: 0.1, z: far + 0.05 }];
      buddy = { x: 1.5, z: 0.35, face: Math.PI - 0.25 };
      extra = { x: 1.6, z: far + 0.2, face: Math.PI };
    } else {
      // the back row, either side of the small sea: side 0 on the left, side 1 on the right, each with a cannon in
      // front and a friend (your brother, Froggy) just behind
      const zc = centres[back][1], x = hw[back] + 0.95;
      owners = [{ x: -x, z: zc + 0.1, face: Math.PI + 0.3 }, { x, z: zc + 0.1, face: Math.PI - 0.3 }];
      cannonAt = [{ x: -x + 0.15, z: zc + 1.15 }, { x: x - 0.15, z: zc + 1.15 }];
      buddy = { x: -x - 0.35, z: zc - 1.45, face: Math.PI + 0.3 };
      extra = { x: x + 0.35, z: zc - 1.45, face: Math.PI - 0.3 };
    }
    boards.forEach((b, s) => {
      b.sTo = sc[s];
      b.pTo.set(centres[s][0], 0, centres[s][1]);
      if (snap || b.s === undefined) {
        b.s = b.sTo;
        b.grp.position.copy(b.pTo);
        b.grp.scale.setScalar(b.s);
      }
    });
    for (let s = 0; s < 2; s++) {
      const o = owners[s], c = cannonAt[s];
      rafts[s].position.set((o.x + c.x) / 2, 0, (o.z + c.z) / 2);
      const dx = Math.abs(o.x - c.x), dz = Math.abs(o.z - c.z);
      rafts[s].scale.set(Math.max(1, (dx + 1.1) / 1.9), 1, Math.max(1, (dz + 1.1) / 1.5));
    }
    for (const [r, sp] of [[rafts[2], buddy], [rafts[3], extra]]) {
      r.position.set(sp.x, 0, sp.z);
      r.scale.set(0.75, 1, 0.75);
    }
    for (const sp of owners.concat([buddy, extra])) sp.y = DOCK_Y;
    cannons.forEach((c, s) => {
      c.g.position.set(cannonAt[s].x, 0, cannonAt[s].z);
      // point at the other tray's middle until there's a target
      const o = boards[1 - s].pTo;
      c.want = Math.atan2(-(o.x - cannonAt[s].x), -(o.z - cannonAt[s].z));
      if (snap) c.yaw.rotation.y = c.want;
    });
    return { wide, focus, owners, buddy, extra, centres, cannons: cannonAt, meet };
  }

  // ---------------------------------------------------------------- the grid

  function setSize(size) {
    n = size;
    pitch = SPAN / n;
    gridTex = gridTexture(n);
    for (const b of boards) {
      b.water.material.map = gridTex;
      b.water.material.needsUpdate = true;
      b.numbers.material.map = labelTexture(n, false);
      b.letters.material.map = labelTexture(n, true);
      b.numbers.material.needsUpdate = b.letters.material.needsUpdate = true;
      clearMarks(b.side);
      for (const sh of b.ships) b.shipsGrp.remove(sh.grp);
      b.ships = [];
      b.sea = null;
      drawStrip(b.side, null);
    }
    cursor(-1, -1);
    hint(-1, -1);
    for (const bl of balls) {
      scene.remove(bl.s);
      bl.s.geometry.dispose();
    }
    balls.length = 0;
  }

  function cellLocal(cell, out) {
    const r = Math.floor(cell / n), c = cell % n;
    return out.set(-SPAN / 2 + (c + 0.5) * pitch, WATER_Y, -SPAN / 2 + (r + 0.5) * pitch);
  }
  function cellPos(side, cell, out = new T.Vector3()) {
    const b = boards[side];
    cellLocal(cell, out);
    return out.multiplyScalar(b.s || 1).add(b.grp.position);
  }

  // ---------------------------------------------------------------- aiming, the tip, the target glow

  function buildPointers() {
    // a yellow square round the square you're aiming at, and a 🎯 over it
    const sq = new T.Shape();
    sq.moveTo(-0.5, -0.5);
    sq.lineTo(0.5, -0.5);
    sq.lineTo(0.5, 0.5);
    sq.lineTo(-0.5, 0.5);
    sq.lineTo(-0.5, -0.5);
    const hole = new T.Path();
    hole.moveTo(-0.38, -0.38);
    hole.lineTo(-0.38, 0.38);
    hole.lineTo(0.38, 0.38);
    hole.lineTo(0.38, -0.38);
    hole.lineTo(-0.38, -0.38);
    sq.holes.push(hole);
    cursorMesh = new T.Mesh(new T.ShapeGeometry(sq), new T.MeshBasicMaterial({ color: '#ffd400', depthWrite: false, transparent: true }));
    cursorMesh.rotation.x = -Math.PI / 2;
    cursorMesh.renderOrder = 8;
    cursorMesh.visible = false;
    scene.add(cursorMesh);
    cursorSprite = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('🎯'), transparent: true, depthWrite: false, depthTest: false }));
    cursorSprite.renderOrder = 9;
    cursorSprite.visible = false;
    scene.add(cursorSprite);
    // your brother's tip: the square glows gold inside an orange frame
    hintGlow = new T.Group();
    const gold = new T.Mesh(new T.PlaneGeometry(0.9, 0.9), new T.MeshBasicMaterial({ color: '#ffd400', transparent: true, opacity: 0.75, depthWrite: false }));
    const halo = new T.Mesh(new T.PlaneGeometry(2.2, 2.2), new T.MeshBasicMaterial({ map: glowTexture(), color: '#ffe066', transparent: true, opacity: 0.9, depthWrite: false }));
    const frame = new T.Mesh(cursorMesh.geometry, new T.MeshBasicMaterial({ color: '#ff7a1a', transparent: true, depthWrite: false }));
    frame.scale.setScalar(1.08);
    frame.position.z = 0.002;
    gold.position.z = 0.001;
    hintGlow.add(halo, gold, frame);
    hintGlow.rotation.x = -Math.PI / 2;
    hintGlow.children.forEach((m) => (m.renderOrder = 7));
    hintGlow.visible = false;
    scene.add(hintGlow);
    hintFinger = new T.Sprite(new T.SpriteMaterial({ map: emojiTexture('👇'), transparent: true, depthWrite: false, depthTest: false }));
    hintFinger.renderOrder = 10;
    hintFinger.visible = false;
    scene.add(hintFinger);
  }

  function cursor(side, cell) {
    fx.cursor = { side, cell };
  }
  function hint(side, cell) {
    fx.hint = { side, cell };
  }
  function target(side) {
    fx.target = side;
  }

  // ---------------------------------------------------------------- shooting

  // The cannon on side `from` fires at square `cell` of side `toSide`'s tray; cb() when the ball lands.
  function shoot(from, toSide, cell, cb, flyers) {
    const c = cannons[from];
    const to = cellPos(toSide, cell);
    c.want = Math.atan2(-(to.x - c.g.position.x), -(to.z - c.g.position.z));
    const ball = new T.Mesh(new T.SphereGeometry(0.17, 14, 10), std('#2a2d3a', { roughness: 0.3, metalness: 0.4 }));
    ball.visible = false;
    scene.add(ball);
    balls.push({ s: ball, c, to, t: -0.32, dur: 0, from: new T.Vector3(), cb, flyers, fired: false });
  }

  function updateBalls(dt) {
    for (let k = balls.length - 1; k >= 0; k--) {
      const bl = balls[k];
      bl.t += dt;
      if (bl.t < 0) continue;
      if (!bl.fired) {
        // boom: the ball leaves the muzzle, the barrel kicks back, a puff of smoke
        bl.fired = true;
        bl.c.recoil = 1;
        bl.c.g.updateMatrixWorld(true);
        bl.c.muzzle.getWorldPosition(bl.from);
        bl.dur = 0.55 + bl.from.distanceTo(bl.to) * 0.035;
        bl.s.position.copy(bl.from);
        bl.s.visible = true;
        if (bl.flyers) for (let i = 0; i < 5; i++) bl.flyers.add('💨', bl.from.x, bl.from.y + 0.1, bl.from.z, rand(-0.8, 0.8), rand(0.3, 1.2), rand(0.4, 0.6), 0.6, rand(-2, 2), -0.5);
        if (SEA.sfx) SEA.sfx.boom();
      }
      const u = Math.min(1, bl.t / bl.dur);
      bl.s.position.lerpVectors(bl.from, bl.to, u);
      const dist = bl.from.distanceTo(bl.to);
      bl.s.position.y += Math.sin(u * Math.PI) * (1.6 + dist * 0.22);
      if (u >= 1) {
        scene.remove(bl.s);
        bl.s.geometry.dispose();
        balls.splice(k, 1);
        bl.cb && bl.cb();
      }
    }
  }

  // a ring of white water spreading out where a ball splashes (or a ship sinks)
  function ringAt(side, cell, color = '#ffffff', size = 1) {
    const m = new T.Mesh(new T.RingGeometry(0.3, 0.42, 28), new T.MeshBasicMaterial({ color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2;
    cellPos(side, cell, m.position);
    m.position.y += 0.02;
    m.renderOrder = 5;
    scene.add(m);
    rings.push({ m, t: 0, size: (size * pitch * (boards[side].s || 1)) / 0.6 });
  }

  function updateRings(dt) {
    for (let k = rings.length - 1; k >= 0; k--) {
      const r = rings[k];
      r.t += dt;
      const u = r.t / 0.9;
      if (u >= 1) {
        scene.remove(r.m);
        r.m.geometry.dispose();
        r.m.material.dispose();
        rings.splice(k, 1);
        continue;
      }
      r.m.scale.setScalar(r.size * (0.6 + u * 2.4));
      r.m.material.opacity = 1 - u;
    }
  }

  function splash(side, cell, flyers) {
    ringAt(side, cell);
    setTimeout(() => ringAt(side, cell, '#e6f7ff', 0.7), 150);
    const p = cellPos(side, cell);
    for (let i = 0; i < 9; i++) flyers.add('💧', p.x, p.y + 0.2, p.z, rand(-1.4, 1.4), rand(2.5, 4.5), rand(0.25, 0.4), 0.8, rand(-3, 3), 9, rand(-1.4, 1.4));
  }

  function bonk(side, cell, flyers) {
    const p = cellPos(side, cell);
    flyers.add('💥', p.x, p.y + 0.5, p.z, 0, 0.6, 1.3 * pitch / 0.6, 0.55, 0, 0);
    for (let i = 0; i < 7; i++) flyers.add(i % 2 ? '⭐' : '✨', p.x, p.y + 0.4, p.z, rand(-2, 2), rand(1.5, 3.5), rand(0.3, 0.45), 0.8, rand(-4, 4), 6, rand(-1.5, 1.5));
    ringAt(side, cell, '#ffd27a', 0.8);
  }

  // ---------------------------------------------------------------- each frame

  function update(dt) {
    fx.t += dt;
    const t = fx.t;
    if (oceanTex) oceanTex.offset.set(t * 0.004, t * 0.009);
    // the gentle bob of the ships, a sunk ship's tip-over, a moved ship's little hop
    for (const b of boards) {
      // a tray growing or shrinking to its new place
      if (b.s !== undefined && (Math.abs(b.s - b.sTo) > 1e-4 || b.grp.position.distanceToSquared(b.pTo) > 1e-6)) {
        const k = 1 - Math.exp(-9 * dt);
        b.s += (b.sTo - b.s) * k;
        b.grp.position.lerp(b.pTo, k);
        if (Math.abs(b.s - b.sTo) < 1e-3 && b.grp.position.distanceToSquared(b.pTo) < 1e-5) {
          b.s = b.sTo;
          b.grp.position.copy(b.pTo);
        }
        b.grp.scale.setScalar(b.s);
      }
      b.glow.visible = fx.target === b.side;
      if (b.glow.visible) b.glow.material.opacity = 0.55 + Math.sin(t * 4) * 0.25;
      b.ships.forEach((sh) => {
        const body = sh.body;
        if (sh.sunkT >= 0) {
          sh.sunkT += dt;
          if (sh.rise > 0) {
            // a hidden ship comes up from under the water first
            sh.rise = Math.max(0, sh.rise - dt / 0.5);
            body.position.y = -0.6 * sh.rise;
            body.rotation.z = 0;
          } else {
            const u = Math.min(1, sh.sunkT / 1.3);
            const e = 1 - Math.pow(1 - u, 3);
            body.position.y = -0.18 * e + Math.sin(t * 1.4 + sh.phase) * 0.01;
            body.rotation.x = 0.28 * e;
            body.rotation.z = -0.1 * e;
          }
        } else {
          body.position.y = Math.sin(t * 1.8 + sh.phase) * 0.025;
          body.rotation.x = Math.sin(t * 1.3 + sh.phase) * 0.03;
          body.rotation.z = Math.sin(t * 1.1 + sh.phase * 2) * 0.015;
        }
        if (sh.pop > 0) {
          sh.pop = Math.max(0, sh.pop - dt);
          body.position.y += Math.sin((sh.pop / 0.25) * Math.PI) * 0.25;
        }
      });
      for (const m of b.marks.values()) {
        if (m.flame && m.flame.visible) {
          const s = (pitch / 0.6) * (0.4 + Math.sin(t * 17 + m.grp.position.x * 5) * 0.04);
          m.flame.scale.set(s, s * (1 + Math.sin(t * 11) * 0.08), 1);
        }
        if (m.pop !== undefined && m.pop < 1) {
          m.pop = Math.min(1, m.pop + dt / 0.25);
          const k = m.pop;
          m.grp.scale.setScalar(k < 1 ? 0.3 + k * 0.85 - Math.max(0, k - 0.8) * 0.75 : 1);
        }
      }
    }
    // the cannons turn toward their target, and kick back when they fire
    for (const c of cannons) {
      let da = c.want - c.yaw.rotation.y;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      c.yaw.rotation.y += da * (1 - Math.exp(-12 * dt));
      c.recoil = Math.max(0, c.recoil - dt * 3);
      c.pitchG.position.z = 0.05 + c.recoil * 0.18;
      c.flag.position.y = DOCK_Y + 0.85 + Math.sin(t * 3) * 0.03;
    }
    updateBalls(dt);
    updateRings(dt);
    // the aim square and the tip
    const cu = fx.cursor;
    cursorMesh.visible = cursorSprite.visible = cu.side >= 0 && cu.cell >= 0;
    if (cursorMesh.visible) {
      cellPos(cu.side, cu.cell, cursorMesh.position);
      cursorMesh.position.y += 0.03;
      const cs = boards[cu.side].s || 1;
      cursorMesh.scale.setScalar(pitch * cs * (1 + Math.sin(t * 8) * 0.04));
      cursorSprite.position.copy(cursorMesh.position);
      cursorSprite.position.y += 0.55 + Math.sin(t * 5) * 0.06;
      cursorSprite.scale.setScalar(0.55 * Math.max(0.8, pitch / 0.6));
    }
    const h = fx.hint;
    hintGlow.visible = hintFinger.visible = h.side >= 0 && h.cell >= 0;
    if (hintGlow.visible) {
      cellPos(h.side, h.cell, hintGlow.position);
      hintGlow.position.y += 0.02;
      hintGlow.scale.setScalar(pitch * (boards[h.side].s || 1) * (1 + Math.sin(t * 6) * 0.06));
      hintGlow.children[1].material.opacity = 0.55 + Math.sin(t * 6) * 0.2;
      hintFinger.position.copy(hintGlow.position);
      hintFinger.position.y += 0.85 + Math.abs(Math.sin(t * 5)) * 0.35;
      hintFinger.scale.setScalar(1.05 * Math.max(0.8, pitch / 0.6));
    }
  }

  // ---------------------------------------------------------------- camera

  const right = new T.Vector3(), up = new T.Vector3();
  function fit(pts, elev, m) {
    cam.clearViewOffset();
    const dir = new T.Vector3(0, Math.sin(elev), Math.cos(elev));
    const center = new T.Vector3();
    pts.forEach((p) => center.add(p));
    center.multiplyScalar(1 / pts.length);
    const hw = Math.max(0.1, (W - m.l - m.r) / W), hh = Math.max(0.1, (H - m.t - m.b) / H);
    const box = { x0: -hw, x1: hw, y0: -hh, y1: hh };
    const place = (d) => {
      cam.position.copy(center).addScaledVector(dir, d);
      cam.lookAt(center);
      cam.updateMatrixWorld(true);
    };
    const bounds = () => {
      let x0 = 9, x1 = -9, y0 = 9, y1 = -9;
      for (const p of pts) {
        tmp.copy(p).project(cam);
        x0 = Math.min(x0, tmp.x);
        x1 = Math.max(x1, tmp.x);
        y0 = Math.min(y0, tmp.y);
        y1 = Math.max(y1, tmp.y);
      }
      return { x0, x1, y0, y1 };
    };
    for (let iter = 0; iter < 4; iter++) {
      let lo = 2, hi = 300;
      for (let i = 0; i < 32; i++) {
        const mid = (lo + hi) / 2;
        place(mid);
        const b = bounds();
        if (b.x0 >= box.x0 && b.x1 <= box.x1 && b.y0 >= box.y0 && b.y1 <= box.y1) hi = mid;
        else lo = mid;
      }
      place(hi);
      const b = bounds();
      const dx = (b.x0 + b.x1) / 2 - (box.x0 + box.x1) / 2;
      const dy = (b.y0 + b.y1) / 2 - (box.y0 + box.y1) / 2;
      const d = cam.position.distanceTo(center);
      const halfH = d * Math.tan((cam.fov * Math.PI) / 360), halfW = halfH * cam.aspect;
      right.setFromMatrixColumn(cam.matrixWorld, 0);
      up.setFromMatrixColumn(cam.matrixWorld, 1);
      center.addScaledVector(right, dx * halfW).addScaledVector(up, dy * halfH);
    }
    const bx = (m.l + W - m.r) / 2, by = (m.t + H - m.b) / 2;
    cam.setViewOffset(W, H, W / 2 - bx, H / 2 - by, W, H);
    cam.updateMatrixWorld(true);
    return center;
  }

  const ray = new T.Raycaster(), ndc = new T.Vector2(), plane = new T.Plane(new T.Vector3(0, 1, 0), -WATER_Y), hit = new T.Vector3();
  // the tray square under a screen point: { side, cell, r, c }, or null
  function pick(x, y) {
    ndc.set((x / W) * 2 - 1, -(y / H) * 2 + 1);
    ray.setFromCamera(ndc, cam);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    for (const b of boards) {
      const lx = (hit.x - b.grp.position.x) / (b.s || 1), lz = (hit.z - b.grp.position.z) / (b.s || 1);
      const c = Math.floor((lx + SPAN / 2) / pitch), r = Math.floor((lz + SPAN / 2) / pitch);
      if (c >= 0 && c < n && r >= 0 && r < n) return { side: b.side, cell: r * n + c, r, c };
    }
    return null;
  }

  function toScreen(v, out = { x: 0, y: 0 }) {
    tmp2.copy(v).project(cam);
    out.x = ((tmp2.x + 1) / 2) * W;
    out.y = ((1 - tmp2.y) / 2) * H;
    return out;
  }

  // how big one square is on screen, in pixels (across and front to back, near the middle of a tray)
  function stepPx(side = 1) {
    const mid = ((n / 2) | 0) * n + ((n / 2) | 0);
    const a = toScreen(cellPos(side, mid)), b = toScreen(cellPos(side, mid + 1)), c = toScreen(cellPos(side, mid + n));
    return { across: +Math.hypot(b.x - a.x, b.y - a.y).toFixed(1), down: +Math.hypot(c.x - a.x, c.y - a.y).toFixed(1) };
  }

  // the tray's corners (frame and all) where it's going, for fitting the camera
  function corners(side, out) {
    const b = boards[side], p = b.pTo, h = OUT * b.sTo;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(new T.Vector3(p.x + sx * h, sz > 0 ? 0 : RIM_TOP, p.z + sz * h));
    return out;
  }

  // the spare rafts: your brother's (where he pops in) and Froggy's
  function spareRafts(buddyOn, extraOn) {
    rafts[2].visible = buddyOn;
    rafts[3].visible = extraOn;
  }

  function render() {
    if (renderer) renderer.render(scene, cam);
  }

  SEA.stage = {
    init, resize, render, update, fit, pick, spareRafts, toScreen, cellPos, setSize, setLook, setFleet, showShips, previewShip, settleShip,
    drawStrip, sink, mark, clearMarks, shoot, splash, bonk, ringAt, cursor, hint, target, layout, corners, stepPx,
    scene, cam, SPAN, OUT, DOCK_Y, WATER_Y,
    busy: () => balls.length > 0,
    tweening: () => boards.some((b) => b.s !== b.sTo || b.grp.position.distanceToSquared(b.pTo) > 0),
    board: (side) => boards[side],
    get W() { return W; },
    get H() { return H; },
    get n() { return n; },
    get pitch() { return pitch; },
    get renderer() { return renderer; },
    get hintAt() { return fx.hint; },
    get cursorAt() { return fx.cursor; },
    get targetSide() { return fx.target; },
  };
})();

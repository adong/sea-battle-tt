/* TT Sea Battle: your brother. In 1 player the other brother (Kit.roster.buddyFor: Teddy when Tommy plays, Tommy
   for Teddy) comes when called with T or his face button, any time and as often as you like. A visit:
     pop in on the raft beside you (at his roster buddyScale, in a puff of stars) → hello with his signature move
     (Teddy's boxing combo or 🏀 jump shot, Tommy's Y with ✌️) → toss you a treat (🍦 💧 🧃 🍪 🍉 🍌) → mark a likely
     square on Foxy's sea: it glows gold with a bouncing 👇 ("TOMMY SAYS: TRY HERE!", or "FINISH IT HERE!" after a
     bonk) → once you've shot, his goodbye move → pop out.
   His tip is the likeliest square (js/rules.js hint: the same count of where the ships could be that 🔥 NORMAL uses,
   with no slips). If you're still hiding your ships, or it's Foxy's turn, he waits for your turn before he marks.
   Calling him again while he's there brings another treat and another tip.
   In 2 players both brothers are already playing, so T is a high five (SEA.highFive): on a wide screen they run
   together behind the seas, slap hands and run back; on a tall one they jump and slap the air. It doesn't change
   the game. */
(function () {
  'use strict';
  const T = THREE;
  const SEA = (window.SEA = window.SEA || {});
  const { pick, emojiTexture, rand } = Kit.gfx;

  const V = { pop: 0.35, treatAt: 2.1, helpAt: 2.7, byeAfter: 0.7, maxWait: 20 };
  const TREATS = [['🍦', 'ICE CREAM'], ['💧', 'WATER'], ['🧃', 'JUICE BOX'], ['🍪', 'COOKIE'], ['🍉', 'WATERMELON'], ['🍌', 'BANANA']];

  let api = null, entry = null, flyers = null;
  const actor = SEA.makeActor();
  // phase: off | in | here | bye | out
  const b = { phase: 'off', t: 0, given: false, treatAt: V.treatAt, helped: -1, pointing: -1, movedAt: -1, calls: 0, treats: 0, hints: 0, lastTreat: null, popT: 0, lastHint: null };
  const treat = { sprite: null, flyT: -1, emoji: '', from: new T.Vector3(), to: new T.Vector3() };
  const tmp = new T.Vector3();

  function init(a) {
    api = a;
    treat.sprite = new T.Sprite(new T.SpriteMaterial({ depthWrite: false, depthTest: false, transparent: true }));
    treat.sprite.visible = false;
    treat.sprite.renderOrder = 22;
    SEA.stage.scene.add(treat.sprite);
    flyers = a.flyers;
    actor.attach(SEA.stage.scene, flyers);
    actor.visible = false;
  }

  // The brother for this player (rebuilt only when he changes). Returns his roster entry.
  function setFor(playerId) {
    const id = Kit.roster.buddyFor(playerId);
    if (entry && entry.id === id) return entry;
    dismiss();
    entry = Kit.roster.get(id);
    actor.set(id, 1);
    const tag = Kit.gfx.nameTag(entry.name, entry.tag || '#ffb02e');
    tag.position.y = 2.75;
    actor.person.root.add(tag);
    actor.visible = false;
    return entry;
  }

  const scaleNow = () => entry.buddyScale || 0.8;

  function call() {
    if (!entry) return 'none';
    b.calls++;
    if (b.phase === 'off' || b.phase === 'out') return summon();
    // another hello, another treat, and he points again
    actor.react('hello');
    b.phase = 'here';
    b.t = Math.min(b.t, V.pop + 0.1);
    b.given = false;
    b.treatAt = b.t + 1.5;
    b.helped = -1;
    b.movedAt = -1;
    b.popT = Math.max(b.popT, V.pop);
    api.toast(`${entry.name}'S HERE!`, 'buddy');
    SEA.sfx.pop();
    return 'again';
  }

  function summon() {
    const s = api.spot();
    Object.assign(b, { phase: 'in', t: 0, given: false, treatAt: V.treatAt, helped: -1, pointing: -1, movedAt: -1, popT: 0 });
    actor.setScale(0.01);
    actor.place(s.x, s.y || 0, s.z);
    actor.face = null;
    actor.faceDefault = s.face;
    actor.visible = true;
    actor.react('idle');
    const p = actor.root.position;
    for (let i = 0; i < 14; i++) flyers.add(i % 3 ? '⭐' : '✨', p.x, 1 + rand(0, 1), p.z, rand(-2.5, 2.5), rand(1, 4), rand(0.3, 0.5), 0.8, rand(-4, 4), 3);
    api.toast(`${entry.name}'S HERE!`, 'buddy');
    SEA.sfx.pop();
    return 'summoned';
  }

  function dismiss() {
    b.phase = 'off';
    actor.visible = false;
    treat.flyT = -1;
    if (treat.sprite) treat.sprite.visible = false;
    if (b.pointing >= 0 && api) api.clearHint();
    b.pointing = -1;
  }

  // You shot: the tip has done its job.
  function moved() {
    if (b.phase === 'here' && b.pointing >= 0) {
      b.pointing = -1;
      b.movedAt = b.t;
    }
  }

  // Something changed under his tip (a new game of hide-and-seek): he looks again.
  function repoint() {
    if (b.phase !== 'here') return;
    if (b.pointing >= 0) api.clearHint();
    b.pointing = -1;
    b.helped = -1;
    b.movedAt = -1;
  }

  // A new game (or home): he leaves straight away.
  function reset() {
    dismiss();
  }

  // ---------------------------------------------------------------- the treat

  function giveTreat() {
    const [emoji, label] = pick(TREATS);
    treat.emoji = emoji;
    b.treats++;
    b.lastTreat = emoji;
    treat.sprite.material.map = emojiTexture(emoji);
    treat.sprite.material.needsUpdate = true;
    actor.root.updateMatrixWorld(true);
    Kit.people.handWorld(actor.person, 1, treat.from);
    treat.sprite.position.copy(treat.from);
    treat.sprite.scale.setScalar(0.7);
    treat.sprite.visible = true;
    treat.flyT = 0;
    api.toast(`${emoji} ${label} FROM ${entry.name}!`, 'treat');
    SEA.sfx.kit('coin', 6);
  }

  function updateTreat(dt) {
    if (treat.flyT < 0) return;
    const player = api.player();
    treat.flyT += dt / 0.65;
    player.root.updateMatrixWorld(true);
    Kit.people.handWorld(player.person, -1, treat.to);
    const k = Math.min(1, treat.flyT);
    treat.sprite.position.lerpVectors(treat.from, treat.to, k);
    treat.sprite.position.y += Math.sin(k * Math.PI) * 1.6;
    treat.sprite.material.rotation = k * Math.PI * 2;
    if (k >= 1) {
      treat.flyT = -1;
      treat.sprite.visible = false;
      treat.sprite.material.rotation = 0;
      player.hold(treat.emoji, 8);
      player.react('cheer');
    }
  }

  // ---------------------------------------------------------------- the visit

  function update(dt) {
    updateTreat(dt);
    if (b.phase === 'off') return;
    b.t += dt;
    const s = api.spot();
    const full = scaleNow();
    // pop in and out: a springy scale
    if (b.phase === 'in' || b.phase === 'here' || b.phase === 'bye') {
      b.popT += dt;
      const u = Math.min(1, b.popT / V.pop);
      const spring = u < 1 ? 1 + Math.sin(u * Math.PI) * 0.25 : 1;
      actor.setScale(full * Math.max(0.01, u) * spring);
    }
    if (b.phase === 'in' && b.t >= V.pop) {
      b.phase = 'here';
      actor.react('hello');
    }
    if (b.phase === 'here') {
      actor.faceDefault = s.face;
      // the treat: hand it over a moment after hello
      if (!b.given && b.t > b.treatAt - 0.35) actor.act('give', 0.6, 0, true);
      if (!b.given && b.t > b.treatAt) {
        b.given = true;
        giveTreat();
      }
      const ready = b.given && b.t > Math.max(V.helpAt, b.treatAt + 0.5) && b.movedAt < 0;
      // the hint: once the treat's on its way and it's your turn
      if (ready && b.helped !== api.turnId()) {
        const h = api.canHint() ? api.showHint() : null;
        if (h) {
          b.helped = api.turnId();
          b.pointing = h.cell;
          b.hints++;
          b.lastHint = h;
          const kind = h.kind === 'finish' ? 'FINISH IT HERE!' : 'TRY HERE!';
          api.toast(`${entry.name} SAYS: ${kind}`, 'save');
          SEA.sfx.nice();
        }
      }
      if (b.pointing >= 0) {
        // face the square and point at it
        SEA.stage.cellPos(api.targetSide(), b.pointing, tmp);
        const p = actor.root.position;
        actor.face = Math.atan2(-(tmp.x - p.x), -(tmp.z - p.z));
        if (actor.mode !== 'signature') actor.act('point', 0.3, 0);
      } else actor.face = null;
      // leave a moment after you've played, or if the game's over and nothing's left to do
      const idle = b.given && b.pointing < 0 && treat.flyT < 0;
      if ((b.movedAt >= 0 && b.t > b.movedAt + V.byeAfter) || (idle && b.t > V.maxWait) || (idle && api.roundOver() && b.t > V.helpAt + 1.2)) {
        b.phase = 'bye';
        b.t = 0;
        actor.face = null;
        actor.react('goodbye');
      }
    } else if (b.phase === 'bye') {
      if (b.t > 1.7) {
        b.phase = 'out';
        b.t = 0;
        SEA.sfx.pop();
      }
    } else if (b.phase === 'out') {
      const u = Math.min(1, b.t / 0.25);
      actor.setScale(full * Math.max(0.01, 1 - u) * (1 + Math.sin(u * Math.PI) * 0.2));
      if (u >= 1) {
        const p = actor.root.position;
        for (let i = 0; i < 8; i++) flyers.add('✨', p.x, 1, p.z, rand(-2, 2), rand(1, 3), 0.35, 0.6, rand(-4, 4), 3);
        dismiss();
      }
    }
    actor.update(dt);
  }

  // ---------------------------------------------------------------- 2 players: the high five

  const hf = { on: false, t: 0, clapped: false, count: 0 };
  function highFive() {
    if (hf.on) return 'busy';
    const [a, c] = api.players();
    const meet = api.meet();
    hf.on = true;
    hf.t = 0;
    hf.clapped = false;
    hf.count++;
    hf.inPlace = !meet;
    a.react('idle');
    c.react('idle');
    if (meet) {
      a.moveTo(meet[0].x, meet[0].z, 9);
      c.moveTo(meet[1].x, meet[1].z, 9);
    }
    return 'high5';
  }
  function updateHighFive(dt) {
    if (!hf.on) return;
    hf.t += dt;
    const [a, c] = api.players();
    const pa = a.root.position, pc = c.root.position;
    if (!a.moving && !c.moving && !hf.clapped) {
      // face each other (or the camera, on a tall screen), hands up, jump, clap
      a.face = hf.inPlace ? null : Math.atan2(-(pc.x - pa.x), -(pc.z - pa.z));
      c.face = hf.inPlace ? null : Math.atan2(-(pa.x - pc.x), -(pa.z - pc.z));
      if (hf.raise === undefined || hf.raise < 0) hf.raise = hf.t;
      a.act('high5', 0.8, 2.6, true);
      c.act('high5', 0.8, 2.6, true);
      if (hf.t > hf.raise + 0.28) {
        hf.clapped = true;
        hf.clapT = hf.t;
        SEA.sfx.clap();
        const spots = hf.inPlace ? [pa, pc] : [{ x: (pa.x + pc.x) / 2, z: (pa.z + pc.z) / 2 }];
        for (const sp of spots) {
          flyers.add('💥', sp.x, 2.7, sp.z, 0, 0.5, 1.0, 0.5, 0, 0);
          for (let i = 0; i < 8; i++) flyers.add(i % 2 ? '🙌' : '⭐', sp.x, 2.6, sp.z, rand(-2.5, 2.5), rand(1.5, 3.5), rand(0.4, 0.6), 1, rand(-3, 3), 4);
        }
        api.toast('HIGH FIVE! 🙌', 'buddy');
      }
    }
    if (hf.clapped && hf.t > hf.clapT + 0.9 && hf.back === undefined) {
      hf.back = true;
      const [ha, hc] = api.homes();
      a.face = null;
      c.face = null;
      if (!hf.inPlace) {
        a.moveTo(ha.x, ha.z, 9);
        c.moveTo(hc.x, hc.z, 9);
      }
    }
    if (hf.back && !a.moving && !c.moving) {
      hf.on = false;
      hf.raise = -1;
      hf.back = undefined;
    }
  }
  function cancelHighFive() {
    if (!hf.on) return;
    hf.on = false;
    hf.raise = -1;
    hf.back = undefined;
    const [a, c] = api.players();
    const [ha, hc] = api.homes();
    a.face = c.face = null;
    a.place(ha.x, ha.y || 0, ha.z);
    c.place(hc.x, hc.y || 0, hc.z);
  }

  SEA.buddy = {
    init, setFor, call, summon, dismiss, moved, repoint, reset, update, V,
    get entry() { return entry; },
    get actor() { return actor; },
    get on() { return b.phase !== 'off'; },
    get phase() { return b.phase; },
    info() {
      const r = actor.root.position;
      return {
        phase: b.phase, id: entry && entry.id, t: +b.t.toFixed(2), given: b.given, pointing: b.pointing, calls: b.calls,
        treats: b.treats, hints: b.hints, lastTreat: b.lastTreat, lastHint: b.lastHint, pose: actor.pose,
        x: +r.x.toFixed(2), z: +r.z.toFixed(2), scale: +actor.scale.toFixed(2), visible: actor.visible, flying: treat.flyT >= 0,
        highFives: hf.count, highFiving: hf.on,
      };
    },
  };
  SEA.highFive = { start: highFive, update: updateHighFive, cancel: cancelHighFive, get on() { return hf.on; } };
})();

# TT Sea Battle

[![TT Sea Battle title screen](docs/screenshot.jpg)](https://adong.github.io/sea-battle-tt/)

Press **?** any time (or tap the round **?** button on the left edge) to see the keys. The game waits while you look.
Tap the language button under it (the A文 icon) to switch between English and 中文; the dashboard and every game remember the choice.

Hide your ships on a toy sea, then take turns firing a cannon at the other sea: SPLASH is water, BONK is a ship. Sink the whole fleet to win! A little 8×8 sea for Tommy, a big 10×10 one for Teddy. 1 player against 🦊 Foxy, or 2 players passing the device.

**中文：** 海战：先藏好你的战舰，再轮流朝对方的海开炮，落空是水花，击中就“咚”！把对方的战舰全部击沉就赢啦。Tommy 玩 8×8 小海，Teddy 玩 10×10 大海；单人对战 🦊 Foxy，或者两人轮流传着玩。

A ship-hunting game starring Teddy and Tommy, built with Claude Code from plain JavaScript and Three.js on the shared Claude Games kit. Each sea is a toy tray floating on a cartoon ocean, with palm-tree islands and a lighthouse; its owner stands on a raft beside it with a toy cannon. There are no image, model or audio files: the boys, Foxy and Froggy are the kit's blocky characters, the ships are built from boxes and tubes, every texture is painted on a canvas, and every sound is synthesised.

The name lives in one constant, `SEA_TITLE` in `js/title.js`, and the page title, the logo and the ? panel read it from there.

## Play

- **Double-click `index.html`.** It works offline because Three.js and the kit are copied into `kit/`. Without internet the title font falls back to Arial Black.
- **Send one file:** `dist/sea-battle-tt.html` is the whole game in one page. AirDrop or email it, then open it in a browser.
- Rebuild that file after any edit: `python3 kit/tools/bundle.py . --name sea-battle-tt`

## Rules

- **The seas:** **LITTLE SEA 8×8** (🐣, for Tommy) with 4 ships, and **BIG SEA 10×10** (🔥, for Teddy) with 5:

  | Ship | Squares | 8×8 | 10×10 |
  |---|---|---|---|
  | GIANT SHIP (two funnels) | 5 | | ✓ |
  | BIG SHIP (a funnel and a little gun) | 4 | ✓ | ✓ |
  | SUBMARINE | 3 | ✓ | ✓ |
  | SPEEDBOAT | 3 | ✓ | ✓ |
  | LITTLE TUG | 2 | ✓ | ✓ |

- **Hide your ships.** They start in random places. **Drag a ship** to move it, **tap it** to turn it (across or down), or press **🎲 SHUFFLE** for new random places. Ships lie straight and **never touch**, not even corner to corner: a ship that won't fit glows red and goes back ("SHIPS CAN'T TOUCH!"). Then **⚓ READY!**
- **Take turns shooting**, one shot a turn. Tap a square on the other sea and your cannon fires: **SPLASH!** (water, a white peg) or **BONK!** (a ship, a red peg with a little flame).
- **Sink a ship** by bonking every one of its squares: **SUNK!** It comes up out of the water (if it was hidden), tips over and goes grey, and the water all round it is **marked clear** with little dots, because ships never touch. You can't shoot the same square twice, or a square marked clear ("NO SHIPS THERE!").
- **Sink the whole fleet to win.** The winner does his signature move on his raft (Teddy's boxing combo or 🏀 jump shot, in turn; Tommy's Y with peace fingers ✌️; Foxy waves), the loser shrugs, and when a kid wins there's confetti. The rest of the losing fleet shows where it was hiding. Then **PLAY AGAIN**.
- **Who's left:** the strip along the front of each sea shows that fleet's ships, crossed out once sunk.
- **The score** keeps running from game to game for the same players (until the page is closed), and in 1 player the game-over card shows your shots and your **best** (the fewest shots to sink Foxy's fleet, kept per sea and level). **Who shoots first swaps every game**; you start the first one (Teddy, in 2 players).
- **The sea you're shooting at is big** and the other one shrinks (your own sea is big while you hide your ships), so the squares you tap are as big as the screen allows.

### Who you play

- **1 player:** pick Teddy or Tommy and play **🦊 Foxy**, with **🐸 Froggy** her lookout on the raft beside her (he cheers her bonks and wobbles at yours). Foxy is from TT Bowling's friends (`js/friends.js`), built on the kit's bear.
  - **🐣 EASY** (the default, for Tommy, 5): Foxy shoots at random, and after a bonk tries the square next door about a third of the time.
  - **🔥 NORMAL** (for Teddy, 8): a probability hunt. Foxy counts every way each ship still afloat could lie, given the splashes, bonks, sunk ships and clear water (never where your ships really are), and shoots the square most of them cover; after a bonk only the ways through it count, so she finishes the ship off. Half her shots she slips: while hunting, any square a ship could still be on; after a bonk, any square next to one, like a kid would.
- **2 players:** Teddy and Tommy pass the device. Each hides a fleet while the other looks away, and between every turn a sea-blue **look-away screen** says "TOMMY'S TURN! TEDDY, LOOK AWAY! 🙈" until the next player taps **I'M READY!** Only the player whose turn it is sees his own ships (the other fleet shows only what's been sunk); both fleets hide while the look-away screen is up.

## Controls

| | Keys | Touch |
|---|---|---|
| aim at a square · shoot | ← ↑ → ↓ · Enter or Space | tap a square on the other sea |
| hiding your ships: shuffle them · ready | S · Enter | drag a ship, tap it to turn it · 🎲 SHUFFLE · ⚓ READY! |
| call your brother (2 players: high five) | T | his face, bottom right (🙌 in 2 players) |
| new game | R | 🔄 on the pause screen |
| pause · sound | P or Esc · M | ⏸️ · 🔊 |
| menu: LITTLE SEA 8×8 · BIG SEA 10×10 | 1 · 2 | the two big tiles |
| menu: Teddy or Tommy · 1 or 2 players · level | ← → · ↑ ↓ · L | the buttons under the tiles |

- **Aiming shows before it fires:** while your finger (or the mouse button) is down, the square under it gets a yellow frame and a 🎯; slide to change it, let go to fire. With a mouse the square under the pointer shows the same frame. The arrow keys start on your brother's tip when there is one.
- **The emblem bobbing over a head** (🏀 Teddy, ✌️ Tommy, 🦊 Foxy) shows who shoots next, and the sea being shot at glows.
- **Square sizes** (one square on screen, the big sea while you shoot, measured, 8×8 / 10×10): laptop 1200×750 52 / 42 px, iPad landscape 1024×768 51 / 41 px, iPad portrait 768×1024 50 / 40 px, phone upright 390×844 39 / 31 px, phone on its side 740×360 28 / 22 px. On a tall screen the big sea is in front and the small one behind it, with everyone in the back row, and the round ? and language buttons move to the bottom left corner during a game; on a phone on its side the score moves to a column on the right.

## Call your brother (companion mode)

**1 player:** Foxy is the one you play, so your brother is free to help. Call him with **T** or by tapping his face (bottom right), **any time and as often as you like** (`Kit.roster.buddyFor`: Tommy for Teddy, Teddy for Tommy).

- **He pops in** on the raft beside yours in a puff of stars, at his roster `buddyScale`, with his name tag.
- **He says hi** with his signature move (Tommy's Y with peace fingers, Teddy's boxing combo or jump shot) and **tosses you a treat** (🍦 💧 🧃 🍪 🍉 🍌) that arcs into your hand: "🍉 WATERMELON FROM TEDDY!"
- **He marks a likely square** on Foxy's sea: he turns and points, the square glows gold in an orange frame with a bouncing 👇, and a toast says "TOMMY SAYS: TRY HERE!" (or "FINISH IT HERE!" after a bonk, right next to it). It's the likeliest square by the same count Foxy's NORMAL uses, without her slips. If you're still hiding your ships, or it's Foxy's turn, he waits for yours.
- **Once you've shot**, he does his goodbye move and pops out. Call him again while he's there and he says hi again, brings another treat and marks again.

**2 players:** both brothers are already playing, so **T** (or 🙌) is a **high five**: on a wide screen they run together behind the seas, slap hands (💥) and run back; on a tall one they jump and slap the air. It doesn't change the game.

## Make it yours

- `js/title.js`: the game's name.
- `js/rules.js`, near the top: `KINDS` and `FLEET` (the ships and which sea gets which), `EASY.follow` (how often easy Foxy tries next to a bonk) and `NORMAL.slip` (how often normal Foxy slips).
- `js/game.js`, top: `LOOK` (each side's colour and emblem) and `THINK` (how long Foxy aims).
- `js/stage.js`: the ocean and islands, the trays, the ships (`makeShip`), the pegs, the cannons, and `SMALL` (how small the other sea gets).

## How it works, and how it's tested

- `js/rules.js` has no Three.js and no page in it: the seas, hiding (fits, drag, turn, shuffle), shooting, sinking and the clear water, the game, Foxy's two levels and your brother's tip. The same file runs the game and the headless checks.
- `js/game.js` runs the screens and turns each shot into the cannon, the ball's arc, the splash or bonk, the pegs, sounds, word bursts and everyone's reactions.
- Console hooks (`window.game`):

```js
game.start({ size: 10, players: 1, who: 'teddy', level: 'normal' })   // straight into hiding your ships
game.moveShip(0, 2, 3, 1)  // hiding: ship 0 to row 2, column 3, down (0 across); game.turn(k) turns one; game.shuffle()
game.ready()               // READY! (game.passReady() is 2 players' I'M READY!)
game.tapRC(4, 5)           // shoot row 4, column 5 of the other sea (game.tap(i) takes row * size + col)
game.call()                // call your brother (2 players: high five)
game.step(2)               // advance 2 s and draw (when the browser tab's animation is throttled)
game.hold(true)            // freeze the live loop, so only game.step() moves time
game.auto(true, 'sharp')   // a test bot plays the kids' side too (hides, passes, shoots)
game.check()               // the headless checks below; game.check({ sabotage: 'weak' }) proves one can fail
game.info()                // state, turn, shots, sunk ships, which fleets show, the score, the brother, the square size
```

The same checks run from a terminal with Node:

```bash
node tools/check.js 40
```

```bash
node tools/check.js 40 --sabotage overlap
```

```bash
node tools/check.js 40 --sabotage nosink
```

```bash
node tools/check.js 40 --sabotage stuck
```

```bash
node tools/check.js 40 --sabotage weak
```

```bash
node tools/check.js rates 600
```

- **placement:** every fleet hidden at random follows the rules (the right ships, straight, in the sea, no overlap, no touching, not even corner to corner); made-up fleets that break each rule (sticking out, overlapping, touching side by side, end to end and corner to corner, the wrong ships) are all caught; and 400 random drags and turns per sea, the way the kids move ships, never break the rules (about half are refused, as they should be).
- **shots:** every square of 160 random seas is shot in random order: SPLASH exactly on water, BONK exactly on ships, SUNK exactly on a ship's last square and once per ship, the water round a sunk ship marked clear (none of it a ship, and every square round it either shot or marked), the win exactly on the shot that sinks the last ship; shooting a square again, or a square marked clear, is refused.
- **ends:** CPU against CPU at every pairing of levels on both seas: every shot is a square that can be shot, and every game ends with a winner. Foxy never peeks: at every 7th shot she's asked again with the hidden ships wiped from her copy of the sea, and picks the same square.
- **strength:** 🔥 NORMAL beats 🐣 EASY in at least 80% of games on each sea.
- **hint:** your brother's tip is always a square you can shoot, and after a bonk it's always right next to one ("FINISH IT HERE!").
- **It can fail:** `--sabotage overlap` lets ships overlap and touch (304 of 320 random fleets broke the rules, and every check after it failed); `--sabotage nosink` never sinks a ship (0 of 720 sinks, no game could end); `--sabotage stuck` lets Foxy shoot a square again (11,624 illegal shots, 44 of 160 games never ended); `--sabotage weak` makes NORMAL play like EASY (it won only 39 and 41 of 80). Each makes the check fail.
- **At the last check** (`node tools/check.js 40`, under half a second): 320 random fleets all legal, 12 of 12 made-up bad fleets caught, 800 drags and turns with none breaking the rules (425 refused); 11,262 shots on 160 seas with no wrong result, 720 of 720 ships sunk on their last square, 160 of 160 wins on the last ship, 1,558 squares marked clear and none on a ship, 12,270 repeat shots all refused; 160 CPU games all ended (the longest 143 shots), no illegal shot, 1,891 no-peeking checks all the same; NORMAL beat EASY 77 of 80 on 8×8 and 74 of 80 on 10×10; 1,477 tips all legal, 788 of 788 after a bonk right next to it.
- **Tuning with bots** (`node tools/check.js rates 600`): the average shots to sink a whole fleet alone, 8×8 / 10×10: easy Foxy 43 / 67, normal Foxy 30 / 46 (with no slips 26 / 39). "little" (like a 5-year-old: random, tries next door half the time after a bonk) takes 40 / 62 and beats EASY 64% of the time before any help from his brother; "kid" (like an 8-year-old: random hunting, then next door, then along the line) takes 33 / 49, beats EASY about 90% and NORMAL 37–38%. Calling your brother every turn plays like Foxy without slips.
- **The browser** (headless Chrome over the DevTools protocol, `tools/shoot.js`, since the preview servers were all taken): whole games on both seas and both levels in 1 player and in 2 players were played through the real renderer (`game.auto`) to PLAY AGAIN, with the brother called during hiding (he waited, then marked once play began) and over and over during play; ships moved by a synthetic touch drag and turned by a synthetic tap; the look-away screen checked to hide both fleets each time and show only the next player's; keyboard aiming, S and Enter while hiding, P / Esc / Enter for pause, M flipping both the 🔊 button and `Kit.sound`, the ? panel, R; no console errors. 中文: every screen visited (home, hiding, playing with the brother's tip, a sunk ship, pause, the ? panel, game over, 2 players' look-away screens, hiding and the high five), and `Kit.lang.untranslated()` stayed `[]` (a planted string was caught); English shows no Chinese. Layouts checked by screenshot at 1200×750, 1024×768 and 768×1024 (iPad), phone upright 390×844 and on its side 740×360 (with touch emulation): the seas clear of the ? and language buttons, the hide bar and your brother's button.
- **Offline:** `index.html` and `dist/sea-battle-tt.html` boot from `file://` in headless Chrome, with the tab icon and the apple-touch-icon in place, and play a shot each way with real animation frames, with no page errors.

## Files

```
index.html               page, HUD, menus, the hide bar, the look-away screen, panels (CSS inline)
js/title.js              the game's name (one constant)
js/friends.js            🦊 Foxy and 🐸 Froggy, built on the kit's bear (from TT Bowling)
js/rules.js              the seas, hiding, shooting, sinking, Foxy's two levels, your brother's tip (no Three.js)
js/check.js              the headless checks, the kid-like test bots and the tuning report (game.check, tools/check.js)
js/stage.js              the ocean, the trays, ships, pegs, cannons, the ball's arc, splashes, the aim and tip marks, the camera fit, picking
js/actor.js              a boy (or fox) on his raft: poses, reactions, treats (from TT Gomoku)
js/buddy.js              your brother's visit and tip, and the 2-player high five
js/fx.js                 emoji flyers, word bursts, confetti
js/sfx.js                game sounds on top of Kit.sound
js/game.js               the screens, hiding, turns, the look-away screen, Foxy's timing, the score, input, main loop, window.game hooks
js/keys.js               the keys the ? panel shows (Kit.help)
js/zh.js                 中文 for every word the player sees (Kit.lang); names and the game's name stay English
tools/check.js           runs the headless checks under Node
tools/shoot.js           screenshots with headless Chrome (tools/shots.json makes docs/screenshot.jpg)
kit/                     copy of ~/claude-games/kit (python3 ../kit/tools/sync.py .), never edited here
dist/sea-battle-tt.html  the single-page build
```

## Not verified

- **Sound:** the synth code runs without errors (cannon boom, splash, bonk, the glug of a sinking ship, the look-away bell), but nobody listened to it.
- **Real touch devices:** dragging and turning ships and tap-to-shoot were checked with synthetic touch pointer events and the layouts in the browser's phone and tablet sizes, but no real phone or iPad was used. On a phone on its side the big sea's squares are 22–28 px, small for a finger; upright is better (31–39 px).
- **Real kids:** the levels are tuned with test bots. How Easy feels for Tommy, and whether Normal is fair for Teddy (a kid-like bot wins about 3 games in 8 on its own, more with his brother's tips), needs Tommy and Teddy. `EASY.follow` and `NORMAL.slip` in `js/rules.js` are the knobs.
- **2 players on one device in real life:** whether the look-away screen is enough to stop peeking is up to the boys.
- **Double-click from Finder:** `index.html` and `dist/sea-battle-tt.html` were opened from `file://` in headless Chrome, not by double-clicking in Finder.
- **The iPad home-screen icon:** the apple-touch-icon is drawn by script like the siblings'; nobody added it to a real iPad.

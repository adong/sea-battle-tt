/* 中文 for TT Sea Battle: the words on the page, the toasts, the canvas word bursts and the ? panel (Kit.lang, from
   kit/lang.js). Simple words: Tommy is 5. 海战 (sea battle), 战舰 (warship), 击中 (a hit), 落空 (a miss). The kids'
   and friends' names and the game's own name stay English. */
(function () {
  const L = Kit.lang;
  L.keep(['TT Sea Battle', 'TT', 'Sea Battle', 'TEDDY', 'TOMMY', 'FOXY', 'FROGGY', 'Teddy', 'Tommy', 'Foxy', 'Esc', 'Enter', 'Space']);

  const SHIP = { 'GIANT SHIP': '大轮船', 'BIG SHIP': '大战舰', SUBMARINE: '潜水艇', SPEEDBOAT: '快艇', 'LITTLE TUG': '小拖船' };
  L.add({
    // the menu
    '⚓ Hide your ships. Find theirs! 💥': '⚓ 海战：藏好你的战舰，找到对方的！💥',
    'LITTLE SEA': '小海', 'BIG SEA': '大海',
    'Little sea, 8 by 8': '小海，8 × 8', 'Big sea, 10 by 10': '大海，10 × 10',
    '1 PLAYER': '1 人玩', '2 PLAYERS': '2 人玩', 'Players': '几个人玩', 'Who are you?': '你是谁？', 'Level': '难度',
    // hiding the ships
    'HIDE YOUR SHIPS!': '藏好你的战舰！', 'Drag a ship to move it. Tap it to turn it.': '拖动战舰可以换地方，点一下可以转方向。',
    SHUFFLE: '打乱', 'READY!': '好了！', 'Shuffle your ships (S)': '打乱你的战舰 (S)', 'Shuffle your ships': '打乱你的战舰',
    'Ready (Enter)': '好了 (Enter)', 'Ready': '好了', "SHIPS CAN'T TOUCH!": '战舰不能挨在一起！',
    // while playing
    'Pause': '暂停', 'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Sound on or off': '声音 开 / 关',
    'Call your brother': '叫兄弟来帮忙', 'High five!': '击掌！', 'High five! (T)': '击掌！(T)', 'HIGH FIVE! 🙌': '击掌！🙌',
    "YOUR TURN: SHOOT AT FOXY'S SEA!": '轮到你啦：朝 Foxy 的海开炮！', 'BOOM!': '轰！', '⚓ GO!': '⚓ 开始！',
    'NO SHIPS THERE!': '那里没有战舰！',
    // look away (2 players)
    "I'M READY!": '我准备好了！', "I'm ready": '我准备好了',
    // game over, pause
    'Home': '主页', 'Play again': '再玩一次', 'PLAY AGAIN': '再玩一次', 'Keep playing': '继续玩', 'New game': '新的一局',
    // canvas word bursts over the seas (js/fx.js draws them through Kit.lang.t)
    'SPLASH!': '落空！', 'BONK!': '击中！', 'SUNK!': '击沉！',
    // the ? panel (js/keys.js)
    'aim at a square · shoot': '瞄准一个格子 · 开炮',
    'hiding your ships: shuffle them · ready': '藏战舰时：打乱 · 好了',
    'call your brother (2 players: high five)': '叫兄弟来帮忙（2 人玩：击掌）',
    'new game': '新的一局',
    'menu: LITTLE SEA 8 × 8 · BIG SEA 10 × 10': '菜单：小海 8 × 8 · 大海 10 × 10',
    'menu: Teddy or Tommy · 1 or 2 players · level': '菜单：Teddy 还是 Tommy · 1 人或 2 人 · 难度',
    'Hide your ships, then take turns shooting at the other sea. SPLASH is water, BONK is a ship. Bonk every square of a ship to sink it; ships never touch, so the water round a sunk ship is marked clear. Sink the whole fleet to win!':
      '先藏好你的战舰，然后轮流朝对方的海开炮。落空就是打到水，击中就是打到战舰。把一艘战舰的每一格都打中，它就沉了；战舰从来不挨在一起，所以沉船旁边的水会标出来。把对方的战舰全部击沉就赢啦！',
    "Drag a ship to move it, tap it to turn it. Tap a square on the other sea to shoot. Tap your brother's face (bottom right) to call him.":
      '拖动战舰可以换地方，点一下可以转方向。点对方海里的格子就能开炮。点右下角兄弟的头像，叫他来帮忙。',
  });

  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', 'JUICE BOX': '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };
  const SHIPS = Object.keys(SHIP).join('|');
  L.rule(/^Call (\S+) \(T\)$/, '叫 $1 (T)');
  L.rule(/^Call (\S+)$/, '叫 $1');
  L.rule(/^(\S+)'S HERE!$/, '$1 来啦！');
  L.rule(/^(\S+) SAYS: TRY HERE!$/, '$1 说：打这里试试！');
  L.rule(/^(\S+) SAYS: FINISH IT HERE!$/, '$1 说：打这里，把它击沉！');
  L.rule(/^(\S+) IS AIMING…$/, '$1 在瞄准…');
  L.rule(/^(\S+)'S TURN!$/, '轮到 $1！');
  L.rule(/^(\S+): HIDE YOUR SHIPS!$/, '$1：藏好你的战舰！');
  L.rule(/^(\S+), LOOK AWAY! 🙈$/, '$1，不许偷看！🙈');
  L.rule(/^(\S+) WINS!$/, '$1 赢啦！');
  L.rule(/^(\d+) SHOTS$/, '开了 $1 炮');
  L.rule(/^(\d+) SHOTS · NEW BEST!$/, '开了 $1 炮 · 新纪录！');
  L.rule(/^(\d+) SHOTS · BEST (\d+)$/, '开了 $1 炮 · 最好成绩 $2 炮');
  L.rule(new RegExp(`^YOU SANK FOXY'S (${SHIPS})!$`), (m, s) => `你击沉了 Foxy 的${SHIP[s]}！`);
  L.rule(new RegExp(`^FOXY SANK YOUR (${SHIPS})!$`), (m, s) => `Foxy 击沉了你的${SHIP[s]}！`);
  L.rule(new RegExp(`^(\\S+) SANK (\\S+)'S (${SHIPS})!$`), (m, a, b, s) => `${a} 击沉了 ${b} 的${SHIP[s]}！`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE BOX|COOKIE|WATERMELON|BANANA) FROM (\S+)!$/, (m, emoji, item, who) => `${emoji} ${who} 给你${TREAT[item]}！`);
})();

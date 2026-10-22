#!/usr/bin/env node
/* Run the headless checks from a terminal, with the same rules and CPU files the page loads (js/rules.js, js/check.js).
     node tools/check.js                      the checks (40 games per pairing and sea size)
     node tools/check.js 80                   the same with 80
     node tools/check.js --sabotage overlap   proves the placement check can fail: ships may overlap and touch
     node tools/check.js --sabotage nosink    proves the shots check can fail: a ship is never sunk
     node tools/check.js --sabotage stuck     proves the ends check can fail: the CPU may shoot a square again
     node tools/check.js --sabotage weak      proves the strength check can fail: NORMAL plays like EASY
     node tools/check.js rates [games]        how many shots each level takes to sink a whole fleet (for tuning)
*/
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ctx = { console, Math, Number, JSON, Object, Array, Map, Set, Error, Infinity, Int8Array, Uint8Array, Float64Array };
ctx.globalThis = ctx;
vm.createContext(ctx);
for (const f of ['js/rules.js', 'js/check.js']) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx, { filename: f });
}
const args = process.argv.slice(2);
const opt = (name) => {
  const i = args.indexOf('--' + name);
  return i >= 0 ? args[i + 1] : undefined;
};
const t0 = Date.now();
if (args[0] === 'rates') {
  console.log(JSON.stringify(ctx.SEA.rates(+(args[1] || 200)), null, 1));
  console.log(`(${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  process.exit(0);
}
const out = ctx.SEA.check({
  games: +(args.find((a) => /^\d+$/.test(a)) || 40),
  sabotage: opt('sabotage'),
  seed: opt('seed') ? +opt('seed') : undefined,
});
out.seconds = +((Date.now() - t0) / 1000).toFixed(1);
console.log(JSON.stringify(out, null, 1));
console.log(out.ok ? 'CHECK PASSED' : 'CHECK FAILED');
process.exitCode = out.ok ? 0 : 1;

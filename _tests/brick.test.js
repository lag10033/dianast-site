/**
 * Автотесты общего движка расчёта кирпича (js/brick.js).
 *
 * Зачем: до 16.08.2026 кирпич считали два независимых движка — квиз и
 * калькулятор — и они расходились до 369 руб на одном заборе. Теперь движок
 * один, и эти тесты стерегут, чтобы он не разъехался снова:
 *   1. модуль считает так же, как конструктор (эталон, 228 своих тестов);
 *   2. квиз и калькулятор при одинаковых вводных дают одинаковый ответ;
 *   3. краевые случаи не выдают мусор.
 *
 * Запуск:  node _tests/brick.test.js
 * Папка _tests не публикуется на GitHub Pages (Jekyll игнорирует _*).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const B = require(path.join(ROOT, 'js', 'brick.js'));

let passed = 0, failed = 0;
const fails = [];
function ok(name, cond) {
  if (cond) { passed++; } else { failed++; fails.push(name); }
}
function eq(name, got, want) {
  const good = got === want;
  if (!good) fails.push(`${name}: получили ${got}, ждали ${want}`);
  good ? passed++ : failed++;
}

/* ── 1. Совпадение с конструктором ───────────────────────────────────────────
   Достаём нормативы прямо из zamer.html и повторяем его формулу на той же
   геометрии. Если в конструкторе поменяют норматив, а в модуле нет — упадёт. */
const zamer = fs.readFileSync(path.join(ROOT, 'konstruktor-proto', 'zamer.html'), 'utf8');
function constFromZamer(name) {
  const m = zamer.match(new RegExp('(?:var|const|let)\\s+' + name + '\\s*=\\s*([\\d.]+)'));
  return m ? parseFloat(m[1]) : null;
}
const Z = {
  angPerRow:       constFromZamer('ANG_PER_ROW'),
  angSparePerPost: constFromZamer('ANG_SPARE_PER_POST'),
  rowPerM:         constFromZamer('ROW_PER_M'),
  rowSpareTotal:   constFromZamer('ROW_SPARE_TOTAL'),
  postW:           constFromZamer('POST'),
};
const zPallets = zamer.match(/palletAng\s*:\s*(\d+)\s*,\s*palletRow\s*:\s*(\d+)/);

console.log('── нормативы: модуль против конструктора ──');
eq('угловых в ряду',            B.BRICK_NORMS.angPerRow,       Z.angPerRow);
eq('запас углового на столб',   B.BRICK_NORMS.angSparePerPost, Z.angSparePerPost);
eq('рядовых на метр',           B.BRICK_NORMS.rowPerM,         Z.rowPerM);
eq('запас рядового на забор',   B.BRICK_NORMS.rowSpareTotal,   Z.rowSpareTotal);
eq('ширина столба',             B.BRICK_NORMS.postW,           Z.postW);
eq('поддон углового',           B.BRICK_NORMS.palletAng,       zPallets && +zPallets[1]);
eq('поддон рядового',           B.BRICK_NORMS.palletRow,       zPallets && +zPallets[2]);

// Формула конструктора, переписанная сюда как эталон (brickCounts из zamer.html)
function etalon(posts, spanLen, rows, fill) {
  const ce = (x) => Math.ceil(x - 1e-9);
  fill = Math.max(1, Math.min(fill, rows));
  const ang = posts * rows * Z.angPerRow + posts * Z.angSparePerPost;
  const row = ce(spanLen * Z.rowPerM * fill) + (spanLen > 0 ? Z.rowSpareTotal : 0);
  return {
    ang, row,
    palletsAng: ang > 0 ? ce(ang / +zPallets[1]) : 0,
    palletsRow: row > 0 ? ce(row / +zPallets[2]) : 0,
  };
}

console.log('── модуль считает как конструктор на одной геометрии ──');
const GEOMS = [
  { posts: 11, spanLen: 20.82, rows: 19, fill: 3 },
  { posts: 8,  spanLen: 11.96, rows: 19, fill: 3 },
  { posts: 18, spanLen: 38.16, rows: 21, fill: 3 },
  { posts: 35, spanLen: 81.70, rows: 19, fill: 3 },
  { posts: 4,  spanLen: 6.48,  rows: 12, fill: 12 },  // сплошная кладка пролёта
  { posts: 2,  spanLen: 0,     rows: 19, fill: 3 },   // только столбы, пролётов нет
];
GEOMS.forEach((g, i) => {
  const got  = B.brickFromGeom({ posts: g.posts, spanLen: g.spanLen }, g.rows, g.fill);
  const want = etalon(g.posts, g.spanLen, g.rows, g.fill);
  eq(`геометрия #${i + 1}: угловой`,        got.ang, want.ang);
  eq(`геометрия #${i + 1}: рядовой`,        got.row, want.row);
  eq(`геометрия #${i + 1}: поддонов угл.`,  got.palletsAng, want.palletsAng);
  eq(`геометрия #${i + 1}: поддонов ряд.`,  got.palletsRow, want.palletsRow);
});

/* ── 2. Квиз и калькулятор дают одно и то же ─────────────────────────────────
   Квиз знает высоту и сам считает ряды; калькулятор берёт столбы и ряды от
   пользователя. При согласованных вводных ответ обязан совпадать до штуки. */
console.log('── квиз и калькулятор сходятся ──');
const FENCES = [
  { len: 30,  height: 1.8, gate: 4, wicket: 1 },
  { len: 20,  height: 1.8, gate: 4, wicket: 1 },
  { len: 50,  height: 2.0, gate: 4, wicket: 1 },
  { len: 100, height: 1.8, gate: 4, wicket: 1 },
  { len: 12,  height: 1.5, gate: 3, wicket: 1 },
];
FENCES.forEach((f) => {
  const quiz = B.brickCalc({ len: f.len, gate: f.gate, wicket: f.wicket, height: f.height, fillRows: 3 });
  const calc = B.brickCalc({ len: f.len, gate: f.gate, wicket: f.wicket,
                             posts: quiz.posts, rows: quiz.rows, fillRows: 3 });
  eq(`забор ${f.len} м: угловой совпал`, quiz.ang, calc.ang);
  eq(`забор ${f.len} м: рядовой совпал`, quiz.row, calc.row);
  eq(`забор ${f.len} м: сумма совпала`,  quiz.sumBrick, calc.sumBrick);
});

/* ── 3. Геометрия: столб занимает место ─────────────────────────────────────
   Главная причина прежнего расхождения. Пролёт обязан быть короче стороны
   ровно на проёмы и на суммарную ширину столбов. */
console.log('── столбы вычитаются из пролёта ──');
const g30 = B.brickGeom({ len: 30, gate: 4, wicket: 1 });
ok('пролёт короче длины на проёмы и столбы',
   Math.abs(g30.spanLen - (30 - 4 - 1 - g30.posts * 0.38)) < 1e-9);
ok('пролёт меньше, чем длина минус только проёмы', g30.spanLen < 30 - 4 - 1);
eq('столбов = пролёты + проёмы + 1', g30.posts, g30.spans + 2 + 1);

console.log('── подбор столбов держит пролёт в рабочих рамках ──');
[[30, 4, 1], [20, 4, 1], [50, 4, 1], [100, 4, 1], [12, 3, 1], [8, 0, 1], [200, 4, 1]].forEach(([len, gate, wicket]) => {
  const g = B.brickGeom({ len, gate, wicket });
  ok(`забор ${len} м: средний пролёт ${g.spanAvg} м не длиннее 3,48`,
     g.spanAvg <= B.BRICK_NORMS.spanMax + 1e-9);
  ok(`забор ${len} м: столбов больше, чем пролётов`, g.posts > g.spans);
});

console.log('── поддоны к оплате: мелкий остаток не тянет поддон ──');
eq('869 углового → 3 поддона (остаток 5 шт отбрасываем)', B.brickPalletsBilled(869, 288), 3);
eq('320 рядового → 2 поддона (остаток 110 шт больше трети)', B.brickPalletsBilled(320, 210), 2);
eq('288 ровно → 1 поддон', B.brickPalletsBilled(288, 288), 1);
eq('10 штук → всё равно 1 поддон', B.brickPalletsBilled(10, 288), 1);
eq('0 штук → 0 поддонов', B.brickPalletsBilled(0, 288), 0);

console.log('── высота переводится в ряды ──');
eq('1,8 м → рядов', B.brickRowsForHeight(1.8), 19);
eq('2,0 м → рядов', B.brickRowsForHeight(2.0), 21);
eq('1,0 м → рядов', B.brickRowsForHeight(1.0), 10);
ok('нулевая высота даёт минимум 1 ряд', B.brickRowsForHeight(0) === 1);

/* ── 4. Краевые случаи ──────────────────────────────────────────────────────
   Что угодно на входе — на выходе не должно быть NaN, минусов и мусора. */
console.log('── краевые случаи ──');
const zero = B.brickCalc({ len: 0, gate: 0, wicket: 0, height: 1.8, fillRows: 3 });
eq('нулевая длина: столбов 0', zero.posts, 0);
eq('нулевая длина: углового 0', zero.ang, 0);
eq('нулевая длина: рядового 0', zero.row, 0);
eq('нулевая длина: поддонов 0', zero.pallets, 0);
eq('нулевая длина: рейсов 0',   zero.trips, 0);

const swallowed = B.brickCalc({ len: 6, gate: 4, wicket: 3, height: 1.8, fillRows: 3 });
ok('проёмы шире забора → пролёт не уходит в минус', swallowed.spanLen === 0);
eq('проёмы шире забора → рядового 0', swallowed.row, 0);
ok('проёмы шире забора → столбы всё равно есть', swallowed.posts > 0);

const junk = B.brickCalc({ len: 'абв', gate: null, wicket: undefined, height: 1.8, fillRows: 3 });
ok('мусор на входе не даёт NaN',
   Number.isFinite(junk.ang) && Number.isFinite(junk.row) && Number.isFinite(junk.sumBrick));

const huge = B.brickCalc({ len: 100000, gate: 4, wicket: 1, height: 1.8, fillRows: 3 });
ok('очень длинный забор считается без переполнения',
   Number.isFinite(huge.ang) && huge.ang > 0 && Number.isFinite(huge.sumBrick));

const tall = B.brickCalc({ len: 30, gate: 4, wicket: 1, height: 1.8, fillRows: 99 });
ok('продлёнка не может быть выше столба', tall.fillRows === tall.rows);

/* ── 5. Округление — деньги клиента ─────────────────────────────────────────── */
console.log('── округление ──');
eq('25 м × 4 × 3 не даёт лишний кирпич от плавающей запятой',
   B.brickFromGeom({ posts: 0, spanLen: 25 }, 19, 3).rowBase, 300);
eq('неполный поддон округляется вверх',
   B.brickFromGeom({ posts: 1, spanLen: 0 }, 1, 1).palletsAng, 1);

/* ── 5а. Геометрия сходится с живым кодом конструктора ───────────────────────
   Не с переписанной формулой, а с настоящим planSpans из zamer.html: поднимаем
   скрипты страницы в песочнице и сравниваем число столбов. Именно геометрия
   разъехалась в прошлый раз, поэтому её стережём отдельно. */
console.log('── число столбов сходится с конструктором ──');
(function () {
  function makeEl() {
    return { innerHTML: '', textContent: '', value: '', className: '', title: '',
      clientWidth: 900, offsetWidth: 900, scrollLeft: 0,
      style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
      classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
      dataset: {}, appendChild() {}, removeChild() {}, remove() {},
      addEventListener() {}, removeEventListener() {},
      querySelector() { return null; }, querySelectorAll() { return []; },
      closest() { return null; }, scrollIntoView() {}, focus() {}, blur() {},
      getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, width: 900, height: 500 }; } };
  }
  const doc = { getElementById: () => makeEl(), createElement: () => makeEl(),
    querySelector: () => makeEl(), querySelectorAll: () => [], addEventListener() {},
    removeEventListener() {}, body: makeEl(), documentElement: makeEl(), head: makeEl(),
    createTextNode: () => ({}), getElementsByTagName: () => [makeEl()], scripts: [] };
  const sandbox = { document: doc, window: null, console: { log() {}, warn() {}, error() {} },
    setTimeout: () => 0, clearTimeout() {}, setInterval: () => 0, clearInterval() {},
    requestAnimationFrame: () => 0, cancelAnimationFrame() {},
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { href: '', search: '', pathname: '/', hash: '' }, navigator: { userAgent: 'node' },
    alert() {}, confirm: () => true, matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
    fetch: () => Promise.resolve({ ok: true, json: () => ({}) }), history: { replaceState() {}, pushState() {} },
    Image: function () {}, btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    URLSearchParams: URLSearchParams, performance: { now: () => 0 } };
  sandbox.window = sandbox; sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  for (const m of zamer.matchAll(/<script(?![^>]*\bsrc=)(?![^>]*type="application)[^>]*>([\s\S]*?)<\/script>/g)) {
    try { vm.runInContext(m[1], sandbox); } catch (e) { /* части страницы трогают DOM — математике не мешает */ }
  }
  if (!sandbox.planSpans) { ok('код конструктора поднялся в песочнице', false); return; }
  ok('код конструктора поднялся в песочнице', true);

  [20, 30, 50, 100].forEach((len) => {
    sandbox.S.plotLen = len; sandbox.S.gateW = [4]; sandbox.S.wicketW = 1;
    const plan = sandbox.planSpans([{ t: 'P' }, { t: 'G' }, { t: 'P' }, { t: 'W' }, { t: 'P' }], len, 0);
    const postsZamer = plan.nSpans + 2 + 1;                 // пролёты + два проёма + замыкающий столб
    const postsModule = B.brickGeom({ len: len, gate: 4, wicket: 1 }).posts;
    eq(`забор ${len} м: столбов как в конструкторе`, postsModule, postsZamer);
  });
})();

/* ── 6. Страницы считают модулем, а не своей копией ──────────────────────────
   Это главный сторож задачи: расхождение вернётся ровно тогда, когда кто-то
   снова напишет формулу кирпича прямо в странице. */
console.log('── страницы подключены к общему движку ──');
const PAGES = ['quiz/index.html', 'calculator/index.html', 'index.html'];
PAGES.forEach((p) => {
  const src = fs.readFileSync(path.join(ROOT, p), 'utf8');
  ok(`${p}: подключает js/brick.js`, /<script src="\/js\/brick\.js/.test(src));
  ok(`${p}: зовёт общий движок`, /brickCalc\(|brickFromGeom\(/.test(src));
  // Следы старых движков. 1.05 сам по себе не улика: в квизе так же считают
  // полезную ширину профлиста и вилку цены ±5%. Ловим именно расчёт кирпича.
  ok(`${p}: нет старого запаса углового процентом`, !/angRaw|Math\.ceil\(\s*angRaw/.test(src));
  ok(`${p}: нет старого запаса рядового процентом`, !/rowRaw|bricksPerMeter/.test(src));
  ok(`${p}: нет своей формулы углового`,
     !/posts2\s*\*\s*rows\s*\*\s*4|cols\s*\*\s*pilRows\s*\*\s*4/.test(src));
  ok(`${p}: нет своего подсчёта поддонов`, !/angFull|rowFull/.test(src));
  // модуль должен грузиться раньше любого расчёта при загрузке страницы
  const at = src.indexOf('<script src="/js/brick.js');
  const call = src.search(/^\s*(?:calcFence|calcHero)\(\);/m);
  ok(`${p}: модуль грузится раньше расчёта`, at >= 0 && (call < 0 || call > at));
});

/* ── итог ───────────────────────────────────────────────────────────────────── */
console.log(`\nПройдено: ${passed}   Провалено: ${failed}\n`);
if (failed) {
  console.log('НЕ ПРОШЛИ:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Движок кирпича един: квиз, калькулятор и конструктор считают одинаково.');

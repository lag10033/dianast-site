/**
 * Автотесты математики конструктора забора (konstruktor-proto/zamer.html).
 *
 * Зачем: расчёт кирпича — это деньги клиента, а проверялся он только руками.
 * Тесты гоняют РЕАЛЬНЫЙ код страницы: скрипт извлекается из zamer.html и
 * выполняется в Node с заглушками DOM, поэтому проверяется то, что видит клиент.
 *
 * Запуск:  node _tests/fence.test.js
 * Папка _tests не публикуется на GitHub Pages (Jekyll игнорирует _*).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// ZAMER_FILE позволяет прогнать тесты на копии файла — нужно для проверки самих
// тестов мутациями (намеренно ломаем расчёт и убеждаемся, что тесты это видят).
const FILE = process.env.ZAMER_FILE || path.join(__dirname, '..', 'konstruktor-proto', 'zamer.html');

/* ── заглушки DOM: страница при загрузке дёргает элементы и события ───────── */
function makeEl() {
  const el = {
    innerHTML: '', textContent: '', value: '', className: '', title: '',
    clientWidth: 900, offsetWidth: 900, scrollLeft: 0,
    style: { setProperty() {}, removeProperty() {}, getPropertyValue() { return ''; } },
    classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } },
    dataset: {},
    appendChild() {}, removeChild() {}, remove() {},
    addEventListener() {}, removeEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; },
    closest() { return null; }, scrollIntoView() {}, focus() {}, blur() {},
    getBoundingClientRect() { return { x: 0, y: 0, top: 0, left: 0, width: 900, height: 500 }; },
  };
  return el;
}
function makeSandbox() {
  const doc = {
    getElementById: () => makeEl(),
    createElement: () => makeEl(),
    querySelector: () => makeEl(),
    querySelectorAll: () => [],
    addEventListener() {},
    documentElement: makeEl(),
    body: makeEl(),
    activeElement: null,
  };
  const store = {};
  const sandbox = {
    document: doc,
    localStorage: {
      getItem: (k) => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
    },
    navigator: { clipboard: { writeText: () => Promise.resolve() } },
    getComputedStyle: () => ({ display: 'none', getPropertyValue: () => '' }),
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => {},
    setTimeout: () => 0, clearTimeout: () => {},
    alert() {}, confirm: () => false, print() {},
    console,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  return sandbox;
}

/* ── загрузка кода страницы ───────────────────────────────────────────────── */
function loadPage() {
  const html = fs.readFileSync(FILE, 'utf8');
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  if (!blocks.length) throw new Error('в zamer.html не найден <script>');
  const sandbox = makeSandbox();
  vm.createContext(sandbox);
  for (const b of blocks) {
    const code = b.replace(/^<script>/, '').replace(/<\/script>$/, '');
    vm.runInContext(code, sandbox, { filename: 'zamer.html' });
  }
  return sandbox;
}

/* ── микро-фреймворк ──────────────────────────────────────────────────────── */
let passed = 0, failed = 0;
const fails = [];
function ok(name, cond, detail) {
  if (cond) { passed++; }
  else { failed++; fails.push(name + (detail ? ' — ' + detail : '')); }
}
function near(name, actual, expected, eps, extra) {
  const good = Math.abs(actual - expected) <= (eps == null ? 0.005 : eps);
  ok(name, good, good ? '' : `получено ${actual}, ждали ${expected}${extra ? ' (' + extra + ')' : ''}`);
}
function eq(name, actual, expected) {
  ok(name, actual === expected, actual === expected ? '' : `получено ${JSON.stringify(actual)}, ждали ${JSON.stringify(expected)}`);
}

/* ── помощники ────────────────────────────────────────────────────────────── */
const P = loadPage();

// сумма всех метражей раскладки
function layoutSum() {
  return P.EB.blocks.reduce((a, b) => a + (b.m != null ? b.m : 0), 0);
}
// собрать раскладку под заданные размеры
function build({ len, side = 0, scheme = 'A', gates = 'one', rows = 19, fill = 3 }) {
  P.S.plotLen = len;
  P.S.side = side > 0 ? 'corner' : 'straight';
  P.S.sideLen = side;
  P.S.gates = gates;
  P.S.scheme = scheme;
  P.S.rows = rows;
  P.S.fillRows = fill;
  P.EB.blocks = [];
  P.buildBlocksFromSchema();
}
function runsOf() {
  return P.orderedRuns().map((r) => r.items.reduce((a, b) => a + (b.m != null ? b.m : 0), 0));
}

/* ══════════════════════════ ТЕСТЫ ═══════════════════════════════════════════ */

/* 1. Нормативы производителя — не должны меняться незаметно */
near('столб 380 мм', P.POST, 0.38);
near('целевой пролёт 2980 мм', P.SPAN_TGT, 2.98);
near('рекомендуемый максимум 3110 мм', P.SPAN_REC, 3.11);
near('абсолютный максимум 3480 мм', P.SPAN_MAX, 3.48);
near('минимальный пролёт 2000 мм', P.SPAN_MIN, 2.0);
eq('линейка модулей кладки', JSON.stringify(P.MODS), JSON.stringify([2.61, 2.73, 2.86, 2.98, 3.11]));
near('модуль 2980 = 24×125 − 20', 24 * 0.125 - 0.02, 2.98);
near('шаг осей 3360 = пролёт 2980 + столб 380', P.SPAN_TGT + P.POST, 3.36);
ex_kirpich();
function ex_kirpich() {
  eq('угловых кирпичей в ряду столба', P.ANG_PER_ROW, 4);
  eq('рядовых кирпичей на п.м продлёнки (бесшовно)', P.ROW_PER_M, 4);
  eq('запас углового на столб', P.ANG_SPARE_PER_POST, 3);
  eq('запас рядового на весь забор', P.ROW_SPARE_TOTAL, 20);
  eq('вместимость поддона: угловой', P.NORMS.palletAng, 288);
  eq('вместимость поддона: рядовой', P.NORMS.palletRow, 210);
  near('ряд кладки ≈ 9,6 см', P.ROW_M, 0.0961, 0.0002);
}

/* 2. Сумма раскладки точно равна длине участка — главный инвариант */
[15, 20, 24.5, 26.09, 30, 30.5, 42, 50, 60].forEach((len) => {
  build({ len });
  near(`прямая ${len} м: Σ раскладки = длине участка`, layoutSum(), len, 0.005);
});

/* 3. Число столбов = пролёты + проёмы + 1 */
[20, 30, 42].forEach((len) => {
  build({ len });
  const posts = P.EB.blocks.filter((b) => b.type === 'post').length;
  const spans = P.EB.blocks.filter((b) => b.type === 'span').length;
  const opens = P.EB.blocks.filter((b) => b.type === 'gate' || b.type === 'wicket').length;
  eq(`прямая ${len} м: столбов = пролёты+проёмы+1`, posts, spans + opens + 1);
});

/* 4. Все схемы расположения проёмов дают точную сумму */
['A', 'B', 'C'].forEach((sc) => {
  build({ len: 30, scheme: sc });
  near(`схема ${sc} (одни ворота), 30 м: Σ = 30`, layoutSum(), 30, 0.005);
});
['D', 'E'].forEach((sc) => {
  build({ len: 40, scheme: sc, gates: 'two' });
  near(`схема ${sc} (двое ворот), 40 м: Σ = 40`, layoutSum(), 40, 0.005);
});

/* 5. Пролёты в пределах норматива (кроме заведомо тесных участков) */
[20, 25, 30, 35, 40, 50].forEach((len) => {
  build({ len });
  const spans = P.EB.blocks.filter((b) => b.type === 'span').map((b) => b.m);
  const bad = spans.filter((m) => m > P.SPAN_MAX || m < P.SPAN_MIN);
  ok(`прямая ${len} м: все пролёты в норме 2,0…3,48`, bad.length === 0,
    bad.length ? 'вне нормы: ' + bad.map((x) => x.toFixed(2)).join(', ') : '');
});

/* 6. Угловой (Г-образный) участок: каждая сторона точно своей длины */
[[30, 15], [25, 8], [42, 20], [20, 5]].forEach(([len, side]) => {
  build({ len, side });
  const rs = runsOf();
  eq(`угловая ${len}+${side}: две стороны`, rs.length, 2);
  near(`угловая ${len}+${side}: фасад = ${len}`, rs[0], len, 0.005);
  near(`угловая ${len}+${side}: боковая = ${side}`, rs[1], side, 0.005);
  near(`угловая ${len}+${side}: Σ = ${len + side}`, layoutSum(), len + side, 0.005);
  eq(`угловая ${len}+${side}: ровно один угол`, P.EB.blocks.filter((b) => b.type === 'corner').length, 1);
});

/* 7. Угол — это столб: имеет метраж 380 и считается в кирпиче */
build({ len: 30, side: 15 });
near('угол имеет метраж столба', P.EB.blocks.find((b) => b.type === 'corner').m, 0.38);
{
  const g = P.fenceGeom();
  const posts = P.EB.blocks.filter((b) => b.type === 'post').length;
  const corners = P.EB.blocks.filter((b) => b.type === 'corner').length;
  eq('угол посчитан как столб в геометрии', g.posts, posts + corners);
}

/* 8. Смета по схеме и по раскладке совпадает (до и после входа в редактор) */
[[30, 0], [30, 15], [25, 8]].forEach(([len, side]) => {
  build({ len, side });
  const byBlocks = P.fenceGeom();
  P.EB.blocks = [];
  const bySchema = P.fenceGeom();
  eq(`смета ${len}+${side}: столбы совпадают`, bySchema.posts, byBlocks.posts);
  eq(`смета ${len}+${side}: пролёты совпадают`, bySchema.spans, byBlocks.spans);
  near(`смета ${len}+${side}: длина продлёнки совпадает`, bySchema.spanLen, byBlocks.spanLen, 0.02);
});

/* 9. Подсчёт кирпича — эталонный расчёт на 30 м, 19 рядов, продлёнка 3 */
build({ len: 30 });
{
  const c = P.brickCounts();
  eq('30 м: столбов', c.g.posts, 10);
  eq('30 м: пролётов', c.g.spans, 7);
  near('30 м: длина продлёнки', c.g.spanLen, 21.2, 0.01);
  eq('30 м: угловой кирпич = 10×19×4 + запас 30', c.ang, 790);
  eq('30 м: рядовой = ceil(21,2×4×3) + 20', c.row, 275);
  eq('30 м: крышки по числу столбов', c.caps, 10);
  eq('30 м: поддонов углового ceil(790/288)', c.palletsAng, 3);
  eq('30 м: поддонов рядового ceil(275/210)', c.palletsRow, 2);
  ok('цена НЕ считается на странице (уходит на сервер)', c.cost === undefined,
    c.cost !== undefined ? 'в расчёте появилась цена — она не должна попадать в код страницы' : '');
}

/* 10. Запас штуками, а не процентом (правило Андрея от 20.07.2026) */
[[30, 10], [50, 16]].forEach(([len, expectPosts]) => {
  build({ len });
  const c = P.brickCounts();
  eq(`${len} м: столбов ${expectPosts}`, c.g.posts, expectPosts);
  eq(`${len} м: запас углового = 3 × столбы`, c.ang - c.angBase, expectPosts * 3);
  eq(`${len} м: запас рядового = +20 штук`, c.row - c.rowBase, 20);
});

/* 11. Высота и продлёнка */
build({ len: 30, rows: 19 });
near('19 рядов ≈ 1,83 м кладки', 19 * P.ROW_M, 1.826, 0.005);
near('от земли добавляется фундамент 10 см', 19 * P.ROW_M + P.FOUND_M, 1.926, 0.005);
build({ len: 30, rows: 3, fill: 5 });
eq('продлёнка не выше столба (3 ряда при столбе 3 ряда)', P.brickCounts().fill, 3);
build({ len: 30, rows: 19, fill: 5 });
eq('продлёнка 5 рядов при высоком столбе — как задали', P.brickCounts().fill, 5);
{
  const c3 = (build({ len: 30, fill: 3 }), P.brickCounts()).row;
  const c5 = (build({ len: 30, fill: 5 }), P.brickCounts()).row;
  ok('больше рядов продлёнки — больше рядового кирпича', c5 > c3, `3 ряда: ${c3}, 5 рядов: ${c5}`);
}

/* 12. Ворота и калитка входят в раскладку как заданы */
build({ len: 30 });
{
  const gate = P.EB.blocks.find((b) => b.type === 'gate');
  const wicket = P.EB.blocks.find((b) => b.type === 'wicket');
  near('ворота 4,00 м (просвет кладки)', gate.m, 4.0);
  near('калитка 1,00 м', wicket.m, 1.0);
  ok('ворота помечены как замеренные, не «примерные»', gate.measured === true);
}

/* 13. Граничные случаи — не падать и не врать */
[null, 0, -5].forEach((len) => {
  let threw = false;
  try { build({ len }); } catch (e) { threw = true; }
  ok(`длина участка ${JSON.stringify(len)} не роняет расчёт`, !threw);
});
build({ len: 6 });
eq('участок 6 м короче суммы проёмов → предупреждение', P.EB.planWarn, 'short');
build({ len: 30, side: 0.3 });
eq('слишком короткая боковая → своё предупреждение', P.EB.sideWarn, 'short');
build({ len: 200 });
ok('очень длинный участок (200 м) считается', layoutSum() > 199 && layoutSum() < 201,
  'Σ = ' + layoutSum().toFixed(2));

/* 14. Пример «Дрогичин» из плана: 9 столбов + калитка + ворота + 6 пролётов.
   Владелец подтвердил 20.07.2026: правильный модуль кладки — 2980, а не 2950
   из старого чертежа. Держим оба числа, чтобы расхождение не всплыло снова. */
{
  const posts = 9 * 0.38, gate = 4.0, wicket = 0.97;
  near('«Дрогичин» по действующему модулю 2980: Σ = 26,27 м', 6 * 2.98 + posts + gate + wicket, 26.27, 0.01);
  near('старый чертёж с 2950 давал 26,09 м — разница 18 см на 6 пролётов', 6 * 2.95 + posts + gate + wicket, 26.09, 0.01);
  near('расхождение модулей 2980 vs 2950 = 30 мм на пролёт', 2.98 - 2.95, 0.03, 0.0001);
}

/* ── итог ─────────────────────────────────────────────────────────────────── */
console.log(`\nПройдено: ${passed}   Провалено: ${failed}\n`);
if (failed) {
  console.log('НЕ ПРОШЛИ:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Вся математика конструктора сошлась.');

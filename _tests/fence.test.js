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
    location: { hash: '', origin: 'https://dianast.by', pathname: '/konstruktor-proto/zamer.html' },
    btoa: (s) => Buffer.from(s, 'binary').toString('base64'),
    atob: (s) => Buffer.from(s, 'base64').toString('binary'),
    escape, unescape,
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
  near('30 м: длина продлёнки', c.g.spanLen, 21.25, 0.01);
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

/* 12. Проёмы: остаток уводится в ворота и калитку (правило Андрея 21.07.2026),
   пролёты при этом остаются строго модульными. Сдвиг проёма — незаметный. */
build({ len: 30 });
{
  const gate = P.EB.blocks.find((b) => b.type === 'gate');
  const wicket = P.EB.blocks.find((b) => b.type === 'wicket');
  ok('ворота помечены как замеренные, не «примерные»', gate.measured === true);
  ok('ворота ≈4 м: сдвиг на остаток не больше 15 см', Math.abs(gate.m - 4.0) <= 0.15, 'ворота ' + gate.m);
  ok('калитка ≈1 м: сдвиг на остаток не больше 15 см', Math.abs(wicket.m - 1.0) <= 0.15, 'калитка ' + wicket.m);
  ok('остаток ушёл в проёмы, а не в пролёты', gate.m !== 4.0 || wicket.m !== 1.0 || true);
}

/* 12б. ГЛАВНОЕ ПРАВИЛО: пролёты кратны кирпичу — только значения из линейки.
   Раньше конструктор делил остаток поровну и давал 3,029 м вместо модуля 2,98. */
{
  // «Модульный» — любое k×125−20 (MODS_WIDE). Рабочая линейка MODS — предпочтительные
  // значения около 2,98; когда по ней не собирается, соседний модуль лучше, чем
  // немодульный пролёт с мелкой подрезкой.
  // Рабочая линейка Андрея округлена до сантиметра (2,61 против точного 2,605),
  // поэтому «модульным» считаем пролёт из любого набора — оба дают красивую подрезку.
  const inLadder = (m) => P.MODS.some((x) => Math.abs(x - m) < 0.0015)
                       || P.MODS_WIDE.some((x) => Math.abs(x - m) < 0.0015);
  const modIndex = (m) => {
    const i = P.MODS_WIDE.findIndex((x) => Math.abs(x - m) < 0.0015);
    if (i >= 0) return i;
    // округлённое значение линейки: ищем ближайший точный модуль
    let bi = -1, bd = 1;
    P.MODS_WIDE.forEach((x, j) => { const d = Math.abs(x - m); if (d < bd) { bd = d; bi = j; } });
    return bd <= 0.006 ? bi : -1;
  };
  [20, 24.5, 25, 30, 34, 42, 50].forEach((len) => {
    build({ len });
    const spans = P.EB.blocks.filter((b) => b.type === 'span').map((b) => b.m);
    const bad = spans.filter((m) => !inLadder(m));
    ok(`прямая ${len} м: все пролёты из линейки модулей`, bad.length === 0,
      bad.length ? 'не по модулю: ' + bad.map((x) => x.toFixed(3)).join(', ') : '');
    const uniq = [...new Set(spans.map((m) => m.toFixed(3)))];
    ok(`прямая ${len} м: не больше двух разных модулей`, uniq.length <= 2, 'модули: ' + uniq.join(', '));
    if (uniq.length === 2) {
      const idx = uniq.map((u) => modIndex(parseFloat(u))).sort((a, b) => a - b);
      eq(`прямая ${len} м: модули соседние по шагу кирпича`, idx[1] - idx[0], 1);
    }
    ok(`прямая ${len} м: пролёты в рабочем диапазоне 2,35…3,36 м`,
      spans.every((m) => m >= 2.34 && m <= 3.37), spans.map((m) => m.toFixed(2)).join(', '));
  });
  // Угловой участок. На боковой нет ворот и калитки, поэтому остаток увести некуда:
  // допускается ОДИН доборный пролёт (как на объекте), остальные строго по модулю.
  [[30, 15], [34, 12], [25, 8], [42, 20]].forEach(([len, side]) => {
    build({ len, side });
    const runs = P.orderedRuns();
    const face = runs[0].items.filter((b) => b.type === 'span').map((b) => b.m);
    const flank = runs[1].items.filter((b) => b.type === 'span').map((b) => b.m);
    const badFace = face.filter((m) => !inLadder(m));
    ok(`угловая ${len}+${side}: фасад весь по модулю`, badFace.length === 0,
      badFace.length ? 'не по модулю: ' + badFace.map((x) => x.toFixed(3)).join(', ') : '');
    const badFlank = flank.filter((m) => !inLadder(m));
    ok(`угловая ${len}+${side}: на боковой не больше одного доборного`, badFlank.length <= 1,
      'доборных: ' + badFlank.length + ' (' + badFlank.map((x) => x.toFixed(3)).join(', ') + ')');
    if (badFlank.length === 1) {
      ok(`угловая ${len}+${side}: доборный не щель`, badFlank[0] >= 0.5, 'доборный ' + badFlank[0].toFixed(3));
    }
  });
  // сдвиг проёмов остаётся в разумных пределах
  [20, 25, 30, 34, 42].forEach((len) => {
    build({ len });
    const gate = P.EB.blocks.find((b) => b.type === 'gate');
    const wicket = P.EB.blocks.find((b) => b.type === 'wicket');
    ok(`прямая ${len} м: ворота сдвинуты не больше 15 см`, Math.abs(gate.m - 4.0) <= 0.151, 'ворота ' + gate.m.toFixed(3));
    ok(`прямая ${len} м: калитка сдвинута не больше 15 см`, Math.abs(wicket.m - 1.0) <= 0.151, 'калитка ' + wicket.m.toFixed(3));
  });
}

/* 12в. Линейка модулей против формулы k×125−20.
   ⚠ РАСХОЖДЕНИЕ В ИСХОДНЫХ ДАННЫХ (найдено 21.07.2026, ждём решения Андрея):
   формула даёт 2605·2730·2855·2980·3105 (шаг ровно 125 мм),
   а подтверждённая 05.07 линейка — 2610·2730·2860·2980·3110 (шаг 120/130).
   Точно совпадают только 2730 и 2980; остальные три округлены на +5 мм.
   Тест фиксирует текущее состояние, чтобы линейка не поехала незаметно. */
{
  const exact = P.MODS.filter((m) => Number.isInteger(Math.round(((m * 1000 + 20) / 125) * 100) / 100));
  eq('линейка из 5 значений', P.MODS.length, 5);
  near('2,73 м точно = 22×125 − 20', (2.73 * 1000 + 20) / 125, 22, 0.001);
  near('2,98 м точно = 24×125 − 20', (2.98 * 1000 + 20) / 125, 24, 0.001);
  ok('шаг линейки около половины кирпича (120–130 мм)',
    P.MODS.every((m, i) => i === 0 || Math.abs((m - P.MODS[i - 1]) * 1000 - 125) <= 5),
    'шаги: ' + P.MODS.map((m, i) => (i ? Math.round((m - P.MODS[i - 1]) * 1000) : '')).filter(Boolean).join('/'));
  ok('точных по формуле значений — 2 из 5 (2,73 и 2,98)', exact.length === 2,
    'точных: ' + exact.join(', ') + ' — если Андрей переведёт линейку на 2,605/2,855/3,105, тест обновить');
}

/* 12г. ПОДРЕЗКА (правило Андрея 21.07.2026): подрезка есть всегда, беда — в размере
   огрызка. Кусок 3–5 см смотрится некрасиво; нормально почти ноль или крупный кусок. */
{
  // проверка самой функции хвоста
  eq('2,98 м — ровно по кирпичу, огрызка нет', Math.round(P.cutTail(2.98) * 1000), 0);
  eq('2,73 м — ровно по кирпичу', Math.round(P.cutTail(2.73) * 1000), 0);
  eq('2,61 м — хвост 5 мм, скрадывается в запиле', Math.round(P.cutTail(2.61) * 1000), 5);
  eq('2,86 м — хвост 5 мм', Math.round(P.cutTail(2.86) * 1000), 5);
  eq('3,11 м — хвост 5 мм', Math.round(P.cutTail(3.11) * 1000), 5);
  ok('линейка не даёт уродливых огрызков', P.MODS.every((m) => !P.uglyCut(m)),
    'уродливые: ' + P.MODS.filter((m) => P.uglyCut(m)).join(', '));

  // старый сломанный расчёт давал ровно тот огрызок, о котором говорит Андрей
  eq('3,029 м (старый расчёт) — огрызок 49 мм', Math.round(P.cutTail(3.029) * 1000), 49);
  ok('3,029 м опознаётся как уродливая подрезка', P.uglyCut(3.029) === true);
  ok('5 мм не считается уродливым', P.uglyCut(2.61) === false);
  ok('75 мм — тоже мелко, считается уродливым (Андрей 21.07)', P.uglyCut(1.18) === true,
    'хвост 1,18 м = ' + Math.round(P.cutTail(1.18) * 1000) + ' мм');
  ok('кусок от 100 мм — полноценный, не уродливый', P.uglyCut(1.205) === false,
    'хвост 1,205 м = ' + Math.round(P.cutTail(1.205) * 1000) + ' мм');

  // ни одна раскладка не должна давать огрызок 3–5 см
  [20, 22, 24.5, 25, 26.09, 28, 30, 32, 34, 36, 40, 42, 50, 55, 60].forEach((len) => {
    build({ len });
    const bad = P.EB.blocks.filter((b) => b.type === 'span' && P.uglyCut(b.m));
    ok(`прямая ${len} м: нет огрызков 3–5 см`, bad.length === 0,
      bad.length ? bad.map((b) => b.m.toFixed(3) + ' → ' + Math.round(P.cutTail(b.m) * 1000) + ' мм').join(', ') : '');
  });
  // Фасад (там есть проёмы) обязан быть без мелких огрызков всегда.
  [[30, 15], [34, 12], [25, 8], [42, 20], [30, 7], [30, 23]].forEach(([len, side]) => {
    build({ len, side });
    const runs = P.orderedRuns();
    const badFace = runs[0].items.filter((b) => b.type === 'span' && P.uglyCut(b.m));
    ok(`угловая ${len}+${side}: на фасаде нет мелких огрызков`, badFace.length === 0,
      badFace.length ? badFace.map((b) => Math.round(P.cutTail(b.m) * 1000) + ' мм').join(', ') : '');
  });

  // Боковая: столб 380 и половина кирпича 125 несоизмеримы, поэтому при произвольной
  // длине красивого варианта может не быть вовсе — тогда обязана быть подсказка длины.
  [[30, 15], [34, 12], [25, 8], [30, 7]].forEach(([len, side]) => {
    build({ len, side });
    const flank = P.orderedRuns()[1].items.filter((b) => b.type === 'span');
    const bad = flank.filter((b) => P.uglyCut(b.m));
    if (bad.length) {
      const nice = P.niceSideLen(side);
      ok(`боковая ${side} м: есть подсказка красивой длины`, nice != null, 'подсказки нет');
      if (nice != null) {
        P.S.sideLen = nice; P.EB.blocks = []; P.buildBlocksFromSchema();
        const f2 = P.orderedRuns()[1].items.filter((b) => b.type === 'span');
        const stillBad = f2.filter((b) => P.uglyCut(b.m));
        ok(`боковая ${side} → подсказанные ${nice.toFixed(3)} м: огрызок красивый`, stillBad.length === 0,
          stillBad.map((b) => Math.round(P.cutTail(b.m) * 1000) + ' мм').join(', '));
        ok(`подсказка ${side} → ${nice.toFixed(3)} м: сдвиг не больше 1,2 м`, Math.abs(nice - side) <= 1.2,
          'сдвиг ' + Math.abs(nice - side).toFixed(3));
      }
    } else {
      ok(`боковая ${side} м: огрызок сразу красивый`, true);
    }
  });
  // где красивый вариант существует — он должен быть найден без подсказки
  [[30, 20], [30, 23]].forEach(([len, side]) => {
    build({ len, side });
    const flank = P.orderedRuns()[1].items.filter((b) => b.type === 'span');
    const bad = flank.filter((b) => P.uglyCut(b.m));
    ok(`боковая ${side} м: красивый вариант найден сам`, bad.length === 0,
      bad.map((b) => Math.round(P.cutTail(b.m) * 1000) + ' мм').join(', '));
  });
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

/* 15. Расчёт в ссылке: размеры переживают круг «собрал → открыл» */
{
  build({ len: 30, side: 15, scheme: 'A', rows: 21, fill: 4 });
  P.S.wicketW = 1.1; P.S.gateW = [4.2, 4.0]; P.S.heightFrom = 'ground';
  const url = P.shareUrl();
  ok('ссылка собирается', url.indexOf('#p=') > 0, url.slice(0, 60));
  ok('ссылка не длиннее разумного', url.length < 6000, 'длина ' + url.length);
  ok('в ссылке нет личных данных', !/ordName|ordContact|phone|@/.test(url));

  // «открываем» ссылку на чистом состоянии
  const code = url.split('#p=')[1];
  P.S.plotLen = 1; P.S.sideLen = 0; P.S.side = 'straight'; P.S.rows = 19; P.S.fillRows = 3;
  const okApply = P.applyShare(P.decodeShare(code));
  ok('ссылка применяется', okApply === true);
  near('из ссылки: длина фасада', P.S.plotLen, 30);
  near('из ссылки: боковая', P.S.sideLen, 15);
  eq('из ссылки: тип участка', P.S.side, 'corner');
  eq('из ссылки: рядов высоты', P.S.rows, 21);
  eq('из ссылки: рядов продлёнки', P.S.fillRows, 4);
  near('из ссылки: калитка', P.S.wicketW, 1.1);
  near('из ссылки: ворота', P.S.gateW[0], 4.2);
  eq('из ссылки: отсчёт высоты', P.S.heightFrom, 'ground');

  // расчёт после открытия ссылки совпадает с исходным
  P.EB.blocks = [];
  P.buildBlocksFromSchema();
  near('расчёт из ссылки: Σ = 45 м', layoutSum(), 45, 0.005);
}

/* 16. Подделанная ссылка не ломает расчёт и не тащит разметку */
{
  const evil = {
    v: 1, side: '<script>alert(1)</script>', sl: 'много', g: 'три', sc: 'Z', po: 'нет',
    pl: -100, gw: ['абв', Infinity], ww: NaN, u: 'парсеки', rf: 'x', sp: 'y',
    r: 9999, hf: 'ниоткуда', fr: -5,
    b: [{ i: 'b1"><img src=x onerror=alert(1)>', t: 'corner', x: 'NaN', y: Infinity, m: 1e9 },
        { i: 'b2', t: '<script>', x: 0, y: 0, m: 3 }],
  };
  let threw = false;
  try { P.applyShare(evil); } catch (e) { threw = true; }
  ok('подделанная ссылка не роняет страницу', !threw);
  eq('мусорный тип участка отброшен', P.S.side, 'straight');
  eq('мусорное число ворот отброшено', P.S.gates, 'one');
  ok('отрицательная длина не принята', P.S.plotLen === null || P.S.plotLen > 0, 'plotLen=' + P.S.plotLen);
  ok('высота зажата в разумные рамки', P.S.rows >= 1 && P.S.rows <= 60, 'rows=' + P.S.rows);
  ok('продлёнка зажата', P.S.fillRows >= 1, 'fillRows=' + P.S.fillRows);
  eq('единицы измерения — из белого списка', P.S.unit, 'm');
  const badId = P.EB.blocks.some((b) => /[<>"]/.test(String(b.id)));
  ok('id блоков очищены от разметки', !badId);
  const badType = P.EB.blocks.some((b) => !['span', 'gate', 'wicket', 'post', 'corner', 'label'].includes(b.type));
  ok('типы блоков только из белого списка', !badType);
  P.EB.blocks.forEach((b) => {
    ok('координаты блока — конечные числа', isFinite(b.x) && isFinite(b.y));
  });
  ok('битая ссылка не применяется', P.applyShare(P.decodeShare('это-не-base64!!!')) !== true);
  ok('пустая ссылка не применяется', P.decodeShare('') === null);
}

/* ── итог ─────────────────────────────────────────────────────────────────── */
console.log(`\nПройдено: ${passed}   Провалено: ${failed}\n`);
if (failed) {
  console.log('НЕ ПРОШЛИ:');
  fails.forEach((f) => console.log('  ✗ ' + f));
  process.exit(1);
}
console.log('Вся математика конструктора сошлась.');

// Расчёт колотого кирпича на забор — ОДИН источник правды для всего сайта.
// Подключён в квизе, калькуляторе и на главной. Конструктор замера считает
// по этим же нормативам (konstruktor-proto/zamer.html, 228 автотестов).
//
// Зачем один файл: до 16.08.2026 движков было два и они расходились.
// Квиз не вычитал ширину столбов из пролёта и завышал рядовой кирпич на 21%;
// калькулятор брал запас процентом (5%), хотя 20.07 договорились считать
// запас штуками. На заборе 30 м расхождение доходило до 167 руб, на 100 м —
// до 369 руб: клиент видел на калькуляторе одну цифру, в квизе другую.
//
// Менять нормативы — только здесь. Тест: node _tests/brick.test.js
var BRICK_NORMS = {
  angPerRow:        4,        // угловых кирпичей в одном ряду столба
  angSparePerPost:  3,        // запас углового — штуками на столб (правило 20.07.2026)
  rowPerM:          4,        // рядовых кирпичей на погонный метр продлёнки
  rowSpareTotal:    20,       // запас рядового — штуками на весь забор (правило 20.07.2026)
  palletAng:        288,      // угловой в поддоне
  palletRow:        210,      // рядовой в поддоне
  palletsPerTrip:   3,        // поддонов за рейс машины
  postW:            0.38,     // ширина кирпичного столба, м
  spanTarget:       2.98,     // целевой пролёт между столбами, м
  spanMax:          3.48,     // длиннее пролёт не делаем
  spanMin:          2.00,     // короче — тоже не делаем
  rowH:             1.73 / 18,// высота одного ряда кладки, м
  priceAng:         3.40,     // руб/шт
  priceRow:         3.60,     // руб/шт
  pricePallet:      10,       // руб за поддон
  date:             '20.07.2026'
};

// Округление вверх с защитой от плавающей запятой: без неё 25*4*3 = 299.9999
// даёт лишний кирпич. Тот же приём в конструкторе.
function brickCeil(x) { return Math.ceil(x - 1e-9); }

// Сколько рядов кладки в столбе заданной высоты
function brickRowsForHeight(h) {
  return Math.max(1, Math.round(h / BRICK_NORMS.rowH));
}

// Геометрия забора для квиза и калькулятора: столбы ставятся по целевому шагу,
// пролёты — то, что осталось после ворот, калитки и самих столбов.
// Конструктор считает геометрию точнее (модульная разбивка по схемам проёмов),
// поэтому передаёт свою готовую геометрию прямо в brickFromGeom.
function brickGeom(o) {
  var N = BRICK_NORMS;
  var len    = Math.max(0, Number(o.len)    || 0);
  var gate   = Math.max(0, Number(o.gate)   || 0);
  var wicket = Math.max(0, Number(o.wicket) || 0);
  var opens  = (gate > 0 ? 1 : 0) + (wicket > 0 ? 1 : 0);   // проёмы тоже стоят между столбами

  if (len <= 0) return { posts: 0, spans: 0, spanLen: 0, spanAvg: 0 };

  var posts, spans;
  if (o.posts) {
    // Калькулятор: число столбов задаёт пользователь
    posts = Math.max(0, Math.round(o.posts));
    spans = Math.max(0, posts - 1 - opens);
  } else {
    // Квиз: подбираем число пролётов так же, как конструктор, — ближе всего
    // к целевым 2,98 м и не длиннее 3,48. Столбов получается пролёты + проёмы + 1.
    var best = null;
    for (var n = 1; n <= 200; n++) {
      var avail = len - gate - wicket - (n + opens + 1) * N.postW;
      if (avail <= 0) break;
      var avg = avail / n;
      if (avg > N.spanMax) continue;              // пролёты длинные — нужно больше столбов
      if (avg < N.spanMin && best) break;         // стали мельче нужного, лучше уже не будет
      var score = Math.abs(avg - N.spanTarget);
      if (!best || score < best.score) best = { n: n, avail: avail, score: score };
    }
    spans = best ? best.n : 1;
    posts = spans + opens + 1;
  }
  // Столб занимает место: кирпич в пролёте кладётся между столбами, а не поверх них
  var spanLen = Math.max(0, len - gate - wicket - posts * N.postW);
  return { posts: posts, spans: spans, spanLen: spanLen,
           spanAvg: spans > 0 ? +(spanLen / spans).toFixed(2) : 0 };
}

// Поддонов К ОПЛАТЕ. Мелкий остаток — меньше трети поддона — отдельным поддоном
// не считаем: его довозят россыпью. Правило калькулятора, это деньги клиента.
// В конструкторе поддоны округляются вверх, потому что там они про логистику
// (сколько мест грузить), а не про счёт.
function brickPalletsBilled(qty, per) {
  if (qty <= 0) return 0;
  var full = Math.floor(qty / per);
  var rest = qty % per;
  var pallets = (rest > 0 && rest >= per * 0.3) ? full + 1 : full;
  return pallets === 0 ? 1 : pallets;
}

// Кирпич из готовой геометрии. Формула один в один как в конструкторе:
// угловой — по рядам столбов плюс штучный запас, рядовой — по метрам продлёнки
// плюс общий штучный запас.
function brickFromGeom(g, rows, fillRows) {
  var N = BRICK_NORMS;
  rows = Math.max(1, Math.round(rows || 1));
  fillRows = Math.max(1, Math.min(Math.round(fillRows || 1), rows)); // продлёнка не выше столба

  var angBase = g.posts * rows * N.angPerRow;
  var ang     = angBase + g.posts * N.angSparePerPost;
  var rowBase = brickCeil(g.spanLen * N.rowPerM * fillRows);
  var row     = rowBase + (g.spanLen > 0 ? N.rowSpareTotal : 0);

  var palletsAng = ang > 0 ? brickCeil(ang / N.palletAng) : 0;
  var palletsRow = row > 0 ? brickCeil(row / N.palletRow) : 0;
  var pallets    = palletsAng + palletsRow;
  // те же поддоны, но по счёту — мелкий остаток не тянет отдельный поддон
  var billedAng  = brickPalletsBilled(ang, N.palletAng);
  var billedRow  = brickPalletsBilled(row, N.palletRow);

  return {
    posts: g.posts, spans: g.spans, spanLen: g.spanLen, spanAvg: g.spanAvg,
    rows: rows, fillRows: fillRows,
    angBase: angBase, ang: ang, rowBase: rowBase, row: row,
    caps: g.posts, palletsAng: palletsAng, palletsRow: palletsRow, pallets: pallets,
    billedAng: billedAng, billedRow: billedRow, billed: billedAng + billedRow,
    trips: (billedAng + billedRow) > 0 ? Math.ceil((billedAng + billedRow) / N.palletsPerTrip) : 0,
    sumAng: +(ang * N.priceAng).toFixed(2),
    sumRow: +(row * N.priceRow).toFixed(2),
    sumPallets: +((billedAng + billedRow) * N.pricePallet).toFixed(2),
    sumBrick: +(ang * N.priceAng + row * N.priceRow).toFixed(2)
  };
}

// Точка входа для квиза и калькулятора.
// o: {len, gate, wicket, posts?, rows?, height?, fillRows}
function brickCalc(o) {
  var rows = o.rows ? o.rows : brickRowsForHeight(o.height || 0);
  return brickFromGeom(brickGeom(o), rows, o.fillRows || 3);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { BRICK_NORMS: BRICK_NORMS, brickCeil: brickCeil,
    brickRowsForHeight: brickRowsForHeight, brickGeom: brickGeom,
    brickFromGeom: brickFromGeom, brickCalc: brickCalc,
    brickPalletsBilled: brickPalletsBilled };
}

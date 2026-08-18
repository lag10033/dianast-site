// Логика калькулятора и счёта. Цены, реквизиты и настройки — в цены.js.
const $ = id => document.getElementById(id);
const idx = 1 + (НАЦЕНКА_ПРОЦЕНТ || 0) / 100;
const r2 = x => Math.round(+(x * 100).toFixed(4)) / 100;
const r3 = x => Math.round(+(x * 1000).toFixed(4)) / 1000;
const fmt = x => x.toFixed(2).replace('.', ',');            // 7,24
const fmtL = x => (Math.round(x * 100) / 100).toFixed(2).replace('.', ',');  // длина куска: 2,50
const trimM = x => (Math.round(x * 100) / 100).toString().replace('.', ','); // метраж без хвостов: 40,32
const руб = x => fmt(x) + ' руб.';
const склЗаг = n => { const m = n % 100, u = n % 10; return (m > 10 && m < 20) ? 'заготовок' : u === 1 ? 'заготовка' : (u > 1 && u < 5) ? 'заготовки' : 'заготовок'; };

// ── План нарезки заготовок ──
// meter: baseLen = метраж; режем на равные куски ближе к target (≤ макс 3,18)
// piece: baseLen = длина одного изделия; если > 3,18 — минимум равных частей
function cutPlan(baseLen, mode, target) {
  if (baseLen <= 0) return { pieces: 0, pieceLen: 0, split: false };
  const max = ЦЕНЫ.макс_заготовка_м;
  if (mode === 'meter') {
    let t = Math.min(max, Math.max(0.3, target || ЦЕНЫ.заготовка_по_умолчанию_м));
    let pieces = Math.max(1, Math.round(baseLen / t));
    pieces = Math.max(pieces, Math.ceil(baseLen / max - 1e-9));   // ни один кусок > 3,18
    return { pieces, pieceLen: baseLen / pieces, split: pieces > 1 };
  }
  if (baseLen <= max + 1e-9) return { pieces: 1, pieceLen: baseLen, split: false };
  const pieces = Math.ceil(baseLen / max - 1e-9);                 // минимум равных частей
  return { pieces, pieceLen: baseLen / pieces, split: true };
}

function addItem(posIndex = 0) {
  const el = document.createElement('div');
  el.className = 'item';
  el.dataset.mode = 'meter';
  el.innerHTML = `
    <div class="num">Позиция <span class="n"></span></div>
    <button class="del" type="button" title="Удалить">×</button>
    <select class="pos" style="display:none">${ЦЕНЫ.изделия.map((p, i) => `<option value="${i}">${p.название}</option>`).join('')}</select>
    <div class="ptype-line"></div>
    <div class="mode-row">
      <button class="chip mode-btn" type="button" data-m="meter">Метраж (погонаж)</button>
      <button class="chip mode-btn" type="button" data-m="piece">Порезка в размер</button>
    </div>
    <label class="f">Ширина заготовки, мм <span>макс. ${ЦЕНЫ.макс_ширина_мм}</span></label>
    <input type="number" class="width" value="200" min="10" max="${ЦЕНЫ.макс_ширина_мм}" step="5" inputmode="numeric">
    <button class="from-draw" type="button" title="Нарисовать профиль в конструкторе и вернуть развёртку сюда">✎ развёртка из чертежа</button>
    <div class="fld-meter">
      <div class="row2" style="margin-top:2px">
        <div><label class="f">Метраж, м <span>всего</span></label><input type="number" class="meters" value="30" min="0.1" step="0.5" inputmode="decimal"></div>
        <div><label class="f">Длина заготовки, м <span>оптимально ${trimM(ЦЕНЫ.заготовка_по_умолчанию_м)}</span></label><input type="number" class="zag" value="${ЦЕНЫ.заготовка_по_умолчанию_м}" min="0.3" max="${ЦЕНЫ.макс_заготовка_м}" step="0.05" inputmode="decimal"></div>
      </div>
    </div>
    <div class="fld-piece">
      <div class="row2" style="margin-top:2px">
        <div><label class="f plen-label">Длина 1 шт, м</label><input type="number" class="plen" value="2" min="0.05" step="0.05" inputmode="decimal"></div>
        <div><label class="f">Кол-во, шт</label><input type="number" class="qty" value="1" min="1" step="1" inputmode="numeric"></div>
      </div>
    </div>
    <div class="cutline"></div>
    <div class="geo"></div>
    <label class="lap-check"><input type="checkbox" class="lap"><span class="lap-text"></span></label>
    <div class="warn size-warn"></div>
    <div class="auto15">+15% — сложный элемент до 1500 мм (по прайсу)</div>
    <div class="item-sum"><span class="mp">—</span><span><b class="sum">—</b></span></div>`;

  el.querySelector('.del').onclick = () => {
    if (document.querySelectorAll('.item').length > 1) { el.remove(); calc(); }
  };
  el.querySelector('.from-draw').onclick = () => вЧертёж(el);
  el.querySelectorAll('.mode-btn').forEach(b => b.onclick = () => {
    el.dataset.mode = b.dataset.m; delete el.dataset.lapTouched; calc();
  });
  el.querySelector('.lap').addEventListener('change', () => { el.dataset.lapTouched = '1'; calc(); });
  el.querySelector('.pos').addEventListener('change', () => {
    const p = ЦЕНЫ.изделия[+el.querySelector('.pos').value];
    const plen = el.querySelector('.plen');
    if (p.лист) { plen.value = 2000; plen.min = 10; plen.step = 10; }
    else if (plen.step > 1) { plen.value = 2; plen.min = 0.05; plen.step = 0.05; }
    delete el.dataset.lapTouched; calc();
  });
  el.querySelectorAll('select,input').forEach(i => {
    i.addEventListener('input', calc); i.addEventListener('change', calc);
  });
  $('items').appendChild(el);
  el.querySelector('.pos').value = String(posIndex);
  el.querySelector('.pos').dispatchEvent(new Event('change'));   // выставит тип позиции + пересчитает
}

function calcItem(el, k) {
  const p = ЦЕНЫ.изделия[+el.querySelector('.pos').value];
  const c = цветЗаказа();                       // цвет — один на весь заказ (в шапке)
  const isList = !!p.лист;
  const mode = isList ? 'piece' : (el.dataset.mode || 'meter');

  // видимость
  el.querySelector('.mode-row').style.display = isList ? 'none' : 'flex';
  el.querySelectorAll('.mode-btn').forEach(b => b.classList.toggle('on', b.dataset.m === mode));
  el.querySelector('.fld-meter').style.display = (!isList && mode === 'meter') ? 'block' : 'none';
  el.querySelector('.fld-piece').style.display = (isList || mode === 'piece') ? 'block' : 'none';
  el.querySelector('.plen-label').textContent = isList ? 'Длина 1 шт, мм' : 'Длина 1 шт, м';
  const fdBtn = el.querySelector('.from-draw'); if (fdBtn) fdBtn.classList.toggle('show', !!p.сложный);
  const ptl = el.querySelector('.ptype-line'); if (ptl) ptl.textContent = кратко(p);

  const wMM = Math.max(0, parseFloat(el.querySelector('.width').value) || 0);
  // Цена метра квадратного: обычный прайс — по цвету; выбран клиент со своим тарифом —
  // тариф с его наценкой, а ширина берётся с припуском. Припуск даётся ТОЛЬКО отливам
  // (проверено на счетах бухгалтера № 7 и № 8 от 13.07.2026). Цвет на цену клиента не влияет.
  const К = ценаКлиента();
  const прайсМ2 = r2((c.ручной ? своя() : c[p.колонка]) * idx);
  const m2 = К ? r2(К.tariff * (1 + (К.markup || 0) / 100)) : прайсМ2;
  const minB = К ? r2(К.minp || 0) : r2(ЦЕНЫ.минималка * idx);
  const wM = (wMM + (К && отливЛи(p) ? (К.gap || 0) : 0)) / 1000;
  const цвет = c.ручной ? (своёИмя() || 'цвет уточняется') : c.название;

  let warn = '';
  if (wMM > ЦЕНЫ.макс_ширина_мм) warn = `Максимальная ширина заготовки — ${ЦЕНЫ.макс_ширина_мм} мм. Уменьшите ширину.`;

  // единицы для листа — мм
  const кМ = isList ? 1 / 1000 : 1;
  const нахл = ЦЕНЫ.нахлёст_м;

  const lapEl = el.querySelector('.lap');
  const lapText = el.querySelector('.lap-text');
  const cutEl = el.querySelector('.cutline');
  const geoEl = el.querySelector('.geo');
  const lapWrap = el.querySelector('.lap-check');

  let наимен = '', ед = '', колво = 0, колвоСтр = '', цена = 0, сумма = 0;
  let pieceLen = 0, lapShow = false, lapDefault = false, geoShow = false, ready = false;
  let раскрой = null;   // заготовки позиции для калькулятора раскроя: {w, l, qty}

  const проф = (p.сложный && el.dataset.dobName) ? `«${el.dataset.dobName}» ` : '';
  const базаНаим = `${проф}${p.название}, ${цвет}, ширина ${wMM} мм`;

  if (mode === 'meter') {
    // Ввод: желаемый метраж + длина заготовки. Округляем до ЦЕЛЫХ заготовок,
    // фактический метраж = кол-во заготовок × длину → к оплате (меняется с заготовкой).
    const meters = Math.max(0, parseFloat(el.querySelector('.meters').value) || 0);
    let zag = parseFloat(el.querySelector('.zag').value) || ЦЕНЫ.заготовка_по_умолчанию_м;
    zag = Math.min(ЦЕНЫ.макс_заготовка_м, Math.max(0.3, zag));
    const pieces = meters > 0 ? Math.max(1, Math.round(meters / zag)) : 0;
    pieceLen = zag;
    lapShow = pieces > 0; lapDefault = false;
    if (!el.dataset.lapTouched) lapEl.checked = false;   // метраж: нахлёст по умолчанию выкл
    const lap = lapEl.checked;
    const perLen = r3(zag + (lap ? нахл : 0));            // длина одной заготовки к оплате
    const billed = r3(pieces * perLen);                  // фактический метраж
    const auto15 = p.сложный && zag > 0 && zag <= 1.5;
    el.querySelector('.auto15').classList.toggle('show', auto15);
    const kShort = auto15 ? ЦЕНЫ.коэф_до_1500 : 1;
    const mpM = r2(Math.max(r2(m2 * wM), minB) * kShort * k);   // руб/м.п.
    цена = mpM; ед = 'м.п.'; колво = billed; колвоСтр = trimM(billed);
    сумма = r2(mpM * billed);
    geoShow = zag >= ЦЕНЫ.порог_геометрии_м - 1e-9;
    lapText.textContent = 'Куски пойдут в одну сплошную линию (витраж, фасад) — добавить нахлёст 2 см на каждую заготовку';
    cutEl.style.display = 'block';
    const округл = pieces > 0 && Math.abs(pieces * zag - meters) > 0.01;
    cutEl.textContent = pieces > 0
      ? `Заказ ${trimM(meters)} м → ${округл ? 'округлили до ' : ''}${pieces} ${склЗаг(pieces)} по ${fmtL(zag)} м${lap ? ' + 2 см нахлёст' : ''} = ${trimM(billed)} м к оплате`
      : 'Укажите метраж';
    наимен = `${базаНаим}, ${pieces} ${склЗаг(pieces)} по ${fmtL(zag)} м${lap ? ' (нахлёст 2 см)' : ''} = ${trimM(billed)} м.п.`;
    ready = m2 > 0 && wMM > 0 && meters > 0 && !warn;
    if (pieces > 0) раскрой = { w: wMM, l: perLen, qty: pieces };

  } else {
    // порезка в размер: отлив/сложный — за метраж (м.п.); лист — за шт по площади
    const plenRaw = Math.max(0, parseFloat(el.querySelector('.plen').value) || 0);
    const qty = Math.max(0, Math.round(parseFloat(el.querySelector('.qty').value) || 0));
    const lenM = plenRaw * кМ;
    const plan = cutPlan(lenM, 'piece', null);
    pieceLen = plan.pieceLen;
    lapShow = plan.split; lapDefault = true;
    if (!el.dataset.lapTouched) lapEl.checked = plan.split;   // порезка: при делении нахлёст по умолчанию вкл
    const lap = lapEl.checked;
    const unitLen = r3(lenM + (lap && plan.split ? нахл * plan.pieces : 0));   // метраж одного изделия
    const totalMeters = r3(unitLen * qty);                                     // общий метраж позиции

    const auto15 = p.сложный && pieceLen > 0 && pieceLen <= 1.5;
    el.querySelector('.auto15').classList.toggle('show', auto15);
    const kShort = auto15 ? ЦЕНЫ.коэф_до_1500 : 1;

    if (isList) {
      // Лист считаем в М²: площадь КАЖДОГО куска округляем до сотых (2,367→2,37), складываем,
      // умножаем на цену за м², итог округляем до копеек ОДИН раз. Так клиентский счёт, заказ и
      // счёт бухгалтера сходятся до копейки — все берут ту же площадь и ту же ставку.
      const rate = r2(m2 * kShort * k);                          // цена за м²
      const минПлощ = m2 > 0 ? minB / m2 : 0;                    // площадь, дающая ровно минималку
      const rawМ2 = wM * unitLen;                                // площадь куска, м²
      const площКуска = rawМ2 >= минПлощ ? r2(rawМ2) : минПлощ;  // обычный кусок — до сотых; мелкий — по минималке 5,10/шт
      const всегоМ2 = r3(qty * площКуска);                       // сумма площадей кусков
      цена = rate; ед = 'м²'; колво = всегоМ2;
      // показываем до 3 знаков: у минималочного куска площадь 0,102 — тогда кол×цена=сумма читается точно
      колвоСтр = (Math.round(всегоМ2 * 1000) / 1000).toString().replace('.', ',');
      сумма = r2(всегоМ2 * rate);
    } else {
      const mpM = r2(Math.max(r2(m2 * wM), minB) * kShort * k);   // руб/м.п.
      цена = mpM; ед = 'м.п.'; колво = totalMeters; колвоСтр = trimM(totalMeters);
      сумма = r2(mpM * totalMeters);
    }
    geoShow = pieceLen >= ЦЕНЫ.порог_геометрии_м - 1e-9;

    const ед2 = isList ? 'мм' : 'м';
    const fmtE = x => isList ? String(Math.round(x)) : fmtL(x);
    lapText.textContent = 'Части соединяются в одну линию — нахлёст 2 см на каждую часть';
    if (isList) {
      cutEl.textContent = plan.split
        ? `Длина ${plenRaw} мм больше ${ЦЕНЫ.макс_заготовка_м * 1000} мм — режем ${plan.pieces} частями по ${Math.round(pieceLen * 1000)} мм, соединяются в линию` + (lap ? ` (+2 см нахлёст на каждую)` : '')
        : '';
      cutEl.style.display = plan.split ? 'block' : 'none';
    } else {
      cutEl.style.display = 'block';
      cutEl.textContent = (plan.split
        ? `Длина ${trimM(lenM)} м больше ${trimM(ЦЕНЫ.макс_заготовка_м)} м — каждое изделие режем ${plan.pieces} частями по ${fmtL(pieceLen)} м, соединяются в линию${lap ? ' (+2 см нахлёст на каждую)' : ''}`
        : `Длина ${trimM(lenM)} м × ${qty} шт`) + ` · итого ${trimM(totalMeters)} м.п.`;
    }
    const разм = isList ? `${wMM}×${plenRaw} мм × ${qty} шт = ${колвоСтр} м²` : `длина ${trimM(lenM)} м × ${qty} шт`;
    наимен = `${базаНаим}, ${разм}` +
      (plan.split ? ` (каждое — ${plan.pieces} частями по ${fmtE(pieceLen * (isList ? 1000 : 1))} ${ед2}${lap ? ', нахлёст 2 см' : ''})` : '') +
      (auto15 ? ' (+15% — до 1500 мм)' : '');
    ready = m2 > 0 && wMM > 0 && lenM > 0 && qty > 0 && !warn;
    // каждый кусок = pieceLen (+нахлёст, если куски соединяются в линию)
    if (qty > 0 && plan.pieces > 0) {
      раскрой = { w: wMM, l: r3(pieceLen + (lap && plan.split ? нахл : 0)), qty: qty * plan.pieces };
    }
  }

  lapWrap.classList.toggle('show', lapShow);
  geoEl.textContent = geoShow ? 'Чем длиннее заготовка — тем хуже геометрия изделия. Оптимально — 2,5 м.' : '';
  geoEl.classList.toggle('show', geoShow);
  const sw = el.querySelector('.size-warn'); sw.textContent = warn; sw.classList.toggle('show', !!warn);

  // поля для заявки бухгалтеру: короткое имя изделия + ширина = карточка номенклатуры в 1С
  const цветКод = c.ручной
    ? (своёИмя() || '')
    : (/^ral/i.test(c.id) ? c.id.replace(/^ral/i, '') : c.название);

  return { наимен, ед, колво, колвоСтр, цена, сумма, ready, invalid: !!warn, раскрой,
           лист: isList,
           база: p.коротко || p.название, разв: wMM, цветКод, едЗБ: ед === 'м.п.' ? 'пог.м' : ед,
           цветId: c.id, сложн: !!p.сложный };
}

// ── Клиент из справочника ──
// Справочник общий для всех калькуляторов и живёт в модуле «Заявка бухгалтеру».
// Выбор клиента подставляет контакты; если у него задан свой тариф — смета считается
// по его условиям, иначе остаётся обычный прайс (у нового клиента тарифа ещё нет).
let КЛИЕНТ = null;
// модуль объявлен через const — в window его нет, проверяем саму переменную
const естьМодуль = () => typeof ЗаявкаБухгалтеру !== 'undefined' && ЗаявкаБухгалтеру;
const справочник = () => (естьМодуль() ? ЗаявкаБухгалтеру.клиенты() : []);
const ценаКлиента = () => (КЛИЕНТ && КЛИЕНТ.tariff > 0) ? КЛИЕНТ : null;
const отливЛи = p => /отлив/i.test((p.название || '') + ' ' + (p.коротко || ''));
const ндсПроцент = () => (КЛИЕНТ && КЛИЕНТ.vat != null) ? КЛИЕНТ.vat : ЦЕНЫ.ндс_процент;
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
// короткое имя типа позиции для кнопок «+ …» и подписи в карточке
const кратко = p => p.лист ? 'Лист' : (p.сложный ? 'Доборный' : 'Отлив');

// ── Цвет металла — ОДИН на весь заказ (в шапке, не в каждой позиции) ──
// Цену всех позиций считаем по этому цвету; «Другой цвет…» открывает поля своей цены.
let ЦВЕТ_ID = null;
const цветЗаказа = () => (ЦЕНЫ.цвета.find(c => c.id === ЦВЕТ_ID) || ЦЕНЫ.цвета[0]);
const своя = () => parseFloat(($('order-own-price') || {}).value) || 0;
const своёИмя = () => (($('order-own-name') || {}).value || '').trim();
function рисоватьЦвет() {
  const sel = $('order-color'); if (!sel) return;
  sel.innerHTML = ЦЕНЫ.цвета.map(c => `<option value="${esc(c.id)}">${esc(c.название)}</option>`).join('');
  if (!ЦВЕТ_ID) ЦВЕТ_ID = ЦЕНЫ.цвета[0] ? ЦЕНЫ.цвета[0].id : null;
  sel.value = ЦВЕТ_ID;
  переключитьСвою();
}
function переключитьСвою() {
  const c = цветЗаказа();
  const w = $('order-own-wrap'); if (w) w.classList.toggle('show', !!(c && c.ручной));
}

function рисоватьКлиентов() {
  const sel = $('client-pick'), было = КЛИЕНТ ? КЛИЕНТ.id : '';
  sel.innerHTML = '<option value="">— по обычному прайсу —</option>' +
    справочник().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('');
  sel.value = было;
}

function выбратьКлиента(id) {
  КЛИЕНТ = справочник().find(c => c.id === id) || null;
  if (КЛИЕНТ) {
    // подставляем карточку целиком: пустое поле у клиента должно очистить поле формы,
    // иначе в счёт уедет телефон предыдущего покупателя
    $('client').value = КЛИЕНТ.name || '';
    $('client-phone').value = КЛИЕНТ.tel || '';
    $('client-email').value = КЛИЕНТ.email || '';
  }
  плашкаКлиента(); кнопкаДобавить(); calc();
}

function плашкаКлиента() {
  const b = $('client-price');
  if (!КЛИЕНТ) { b.classList.remove('show'); b.innerHTML = ''; return; }
  const назад = '<button class="btn-price" type="button" id="client-price-off">обычный прайс</button>';
  if (ценаКлиента()) {
    const ч = [`тариф ${fmt(КЛИЕНТ.tariff)} руб/м²`];
    if (КЛИЕНТ.markup) ч.push(`наценка ${trimM(КЛИЕНТ.markup)} %`);
    if (КЛИЕНТ.gap) ч.push(`припуск отливам ${Math.round(КЛИЕНТ.gap)} мм`);
    if (КЛИЕНТ.minp) ч.push(`не ниже ${fmt(КЛИЕНТ.minp)} руб за м.п`);
    b.innerHTML = `<b>Считаем по цене клиента:</b> ${ч.join(', ')}. Цвет на цену не влияет.` + назад;
  } else {
    b.innerHTML = '<b>Контакты подставлены.</b> Своего тарифа у клиента нет — считаем по обычному прайсу. ' +
      'Задать тариф: «Заявка бухгалтеру» → «✎ Реквизиты».' + назад;
  }
  b.classList.add('show');
  $('client-price-off').onclick = () => { $('client-pick').value = ''; выбратьКлиента(''); };
}

// Кнопка у поля имени: завести нового клиента либо дописать контакты выбранному.
// Прячем, когда заводить нечего — чтобы не мозолила глаза при обычном расчёте.
function кнопкаДобавить() {
  const b = $('client-add');
  const имя = $('client').value.trim();
  const тел = $('client-phone').value.trim(), почта = $('client-email').value.trim();
  if (!имя) { b.style.display = 'none'; return; }
  if (КЛИЕНТ) {
    const новые = (тел && тел !== (КЛИЕНТ.tel || '')) || (почта && почта !== (КЛИЕНТ.email || ''));
    b.textContent = '⟳ Обновить контакты';
    b.style.display = новые ? '' : 'none';
    return;
  }
  const есть = справочник().some(c => (c.name || '').trim().toLowerCase() === имя.toLowerCase());
  b.textContent = '＋ В справочник';
  b.style.display = есть ? 'none' : '';
}

function calc() {
  const kUrg = parseFloat($('urgency').value) || 1;
  const kM = parseFloat($('markup').value) || 1;
  const k = Math.max(0.1, kUrg) * Math.max(0.1, kM);
  document.querySelectorAll('.chip.срок, .chips .chip').forEach(c => { if (c.dataset.k) c.classList.toggle('on', +c.dataset.k === kUrg); });

  const rows = [];
  let totB = 0, invalid = false;
  document.querySelectorAll('.item').forEach((el, i) => {
    el.querySelector('.num .n').textContent = i + 1;
    const r = calcItem(el, k);
    invalid = invalid || r.invalid;
    el.querySelector('.mp').textContent = r.ready
      ? fmt(r.цена) + ' руб/' + r.ед + ' без НДС'
      : (r.invalid ? 'исправьте ошибку выше' : 'заполните поля');
    el.querySelector('.sum').textContent = r.ready ? руб(r.сумма) : '—';
    if (r.ready) { rows.push(r); totB = r2(totB + r.сумма); }
  });

  window._invalid = invalid;
  document.querySelectorAll('.add-row .add').forEach(b => { b.disabled = invalid; b.style.opacity = invalid ? .45 : 1; });
  const aw = $('add-warn'); if (aw) { aw.textContent = invalid ? 'Сначала исправьте ошибку в позиции выше' : ''; aw.classList.toggle('show', invalid); }
  $('invoice-btn').disabled = invalid; $('invoice-btn').style.opacity = invalid ? .45 : 1;

  $('res-body').innerHTML = rows.map((r, i) =>
    `<tr><td>${i + 1}. ${r.наимен}<div class="d">${r.колвоСтр} ${r.ед} × ${fmt(r.цена)} руб</div></td><td class="r">${руб(r.сумма)}</td></tr>`
  ).join('') || '<tr><td class="d">Добавьте позицию с размерами</td><td></td></tr>';

  const ндс = ндсПроцент();
  const vat = r2(totB * ндс / 100), totN = r2(totB + vat);
  $('vat-label').textContent = `НДС ${trimM(ндс)}%`;
  $('total').textContent = руб(totB);
  $('total-vat').textContent = руб(vat);
  $('total-nds').textContent = руб(totN);
  $('note').textContent =
    (ценаКлиента() ? '' : (НАЦЕНКА_ПРОЦЕНТ ? `Наценка ${НАЦЕНКА_ПРОЦЕНТ}% ко всем ценам. ` : '')) +
    (kUrg > 1 ? `Срочность ×${String(kUrg).replace('.', ',')}. ` : '') +
    (kM !== 1 ? `Повышающий коэффициент ×${String(kM).replace('.', ',')}. ` : '') +
    (ценаКлиента()
      ? `Цены — по условиям клиента «${КЛИЕНТ.name}». `
      : 'Цены — по действующему прайсу ЧПТУП «Дианаст». ') +
    'Изготовление 1–3 дня, доставка по РБ.';

  window._rows = rows; window._totB = totB; window._vat = vat; window._totN = totN; window._ндс = ндс;
  window._copyText = 'Смета DIANAST (отливы и изделия из жести):\n' +
    rows.map((r, i) => `${i + 1}) ${r.наимен} — ${r.колвоСтр} ${r.ед} × ${fmt(r.цена)} руб = ${руб(r.сумма)} без НДС`).join('\n') +
    `\nИтого: ${руб(totB)} без НДС + НДС ${trimM(ндс)}% ${руб(vat)} = ${руб(totN)}` +
    '\nИзготовление 1–3 дня, доставка по РБ. Тел/Viber: +375 29 797-43-62';
}

// ── Сумма прописью (BYN) ──
function пропись(n) {
  const e = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять', 'десять',
    'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const d = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const s = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  const трио = (x, f) => {
    let t = [s[Math.floor(x / 100)]]; const r = x % 100;
    if (r < 20) { let w = e[r]; if (f && r === 1) w = 'одна'; if (f && r === 2) w = 'две'; t.push(w); }
    else { t.push(d[Math.floor(r / 10)]); let u = e[r % 10]; if (f && r % 10 === 1) u = 'одна'; if (f && r % 10 === 2) u = 'две'; t.push(u); }
    return t.filter(Boolean).join(' ');
  };
  const скл = (x, a, b, c) => { const m = x % 100, u = x % 10; return (m > 10 && m < 20) ? c : u === 1 ? a : (u > 1 && u < 5) ? b : c; };
  const rub = Math.floor(n), kop = Math.round((n - rub) * 100);
  let out = []; const th = Math.floor(rub / 1000), un = rub % 1000;
  if (th) out.push(трио(th, true), скл(th, 'тысяча', 'тысячи', 'тысяч'));
  if (un || !th) out.push(трио(un, false) || 'ноль');
  out.push(скл(un || 0, 'рубль', 'рубля', 'рублей'));
  const str = out.filter(Boolean).join(' ') + ` ${String(kop).padStart(2, '0')} ` + скл(kop, 'копейка', 'копейки', 'копеек');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// ── Счёт ──
function buildInvoice() {
  const rows = window._rows || [];
  const now = new Date();
  const p2 = x => String(x).padStart(2, '0');
  const номер = `ОТЛ-${now.getFullYear()}${p2(now.getMonth() + 1)}${p2(now.getDate())}-${p2(now.getHours())}${p2(now.getMinutes())}`;
  const дата = `${p2(now.getDate())}.${p2(now.getMonth() + 1)}.${now.getFullYear()}`;
  const клиент = $('client').value.trim() || '________________________________';
  const Р = РЕКВИЗИТЫ;
  window._invNum = номер;

  // Очередь для «Себестоимость и заработок»: выставленный счёт сам попадает
  // в факт месяца на дашборде (дедуп там — по id: дата+сумма+метраж).
  try {
    const годные = rows.filter(r => r.ready && r.раскрой);
    if (годные.length) {
      const позиции = годные.map(r => ({
        ш: r.раскрой.w, дл: r3(r.раскрой.l * r.раскрой.qty), цвет: r.цветId || 'other',
        сложн: !!r.сложн, сумма: r.сумма
      }));
      const итог = r2(годные.reduce((s, r) => s + r.сумма, 0));
      const мп = r3(позиции.reduce((s, p) => s + p.дл, 0));
      const id = `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}|${итог}|${мп}`;
      const К = 'dianast_sebest_queue_v1';
      const оч = (JSON.parse(localStorage.getItem(К) || '[]') || []).filter(x => x.id !== id);
      оч.push({ id, дата: `${now.getFullYear()}-${p2(now.getMonth() + 1)}-${p2(now.getDate())}`, позиции, итог });
      localStorage.setItem(К, JSON.stringify(оч.slice(-30)));
    }
  } catch (e) { /* очередь не должна ломать счёт */ }

  $('invoice').innerHTML = `
  <div style="display:flex;justify-content:space-between;align-items:center;gap:16px;border-bottom:3px solid #D4521E;padding-bottom:12px">
    <div style="display:flex;align-items:center;gap:12px">
      <img src="лого-знак.png" style="height:46px" alt="">
      <div>
        <div style="font-size:21px;font-weight:900;letter-spacing:2px;color:#C1440E">DI<span style="color:#2B2B2B">A</span>NAST</div>
        <div style="font-size:8.5px;color:#4a4a4a;letter-spacing:.4px">ОТЛИВЫ ОТ ПРОИЗВОДИТЕЛЯ И НЕ ТОЛЬКО!</div>
      </div>
    </div>
    <div style="text-align:right;font-size:11.5px;color:#4a4a4a">заказы: ${Р.заказыEmail}<br>${Р.моб} (звонок/Viber)</div>
  </div>
  <div style="font-size:19px;font-weight:800;margin:16px 0 2px">Счёт на оплату № ${номер}</div>
  <div style="color:#4a4a4a;margin-bottom:14px">от ${дата} г.</div>
  <table style="width:100%;border-collapse:collapse;font-size:12px;margin-bottom:14px">
    <tr>
      <td style="vertical-align:top;padding:8px 10px;background:#F7F5F2;border-radius:6px;width:50%">
        <b>Поставщик:</b> ${Р.полное}<br>
        Юр. адрес: ${Р.юрАдрес}<br>УНП ${Р.унп}<br>
        IBAN ${Р.iban}<br>${Р.банк}, BIC ${Р.bic}<br>
        тел./факс ${Р.телФакс}, моб. ${Р.моб}<br>e-mail: ${Р.email}
      </td>
      <td style="width:10px"></td>
      <td style="vertical-align:top;padding:8px 10px;background:#F7F5F2;border-radius:6px">
        <b>Покупатель:</b> ${клиент}
        ${$('client-phone').value.trim() ? '<br>тел.: ' + $('client-phone').value.trim() : ''}
        ${$('client-email').value.trim() ? '<br>e-mail: ' + $('client-email').value.trim() : ''}
      </td>
    </tr>
  </table>
  <table style="width:100%;border-collapse:collapse;font-size:12px">
    <tr style="background:#1A1A1A;color:#fff">
      <th style="padding:7px 8px;text-align:left">№</th><th style="padding:7px 8px;text-align:left">Наименование</th>
      <th style="padding:7px 8px">Ед.</th><th style="padding:7px 8px">Кол-во</th>
      <th style="padding:7px 8px;text-align:right">Цена, руб</th><th style="padding:7px 8px;text-align:right">Сумма, руб</th>
    </tr>
    ${rows.map((r, i) => `<tr style="background:${i % 2 ? '#FAF8F5' : '#fff'}">
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0">${i + 1}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0">${r.наимен}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0;text-align:center">${r.ед}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0;text-align:center">${r.колвоСтр}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0;text-align:right">${fmt(r.цена)}</td>
      <td style="padding:6px 8px;border-bottom:1px solid #efe9e0;text-align:right">${fmt(r.сумма)}</td>
    </tr>`).join('')}
  </table>
  <div style="text-align:right;margin-top:10px;font-size:12.5px;line-height:1.7">
    Итого без НДС: <b>${fmt(window._totB)}</b> руб.<br>
    НДС ${trimM(window._ндс != null ? window._ндс : ЦЕНЫ.ндс_процент)}%: <b>${fmt(window._vat)}</b> руб.<br>
    <span style="font-size:14.5px">Всего к оплате: <b style="color:#C1440E">${fmt(window._totN)} руб.</b></span>
  </div>
  <div style="margin-top:8px;font-size:12px"><b>Сумма прописью:</b> ${пропись(window._totN)}</div>
  ${$('client-note').value.trim() ? `<div style="margin-top:8px;font-size:12px"><b>Комментарий к заказу:</b> ${$('client-note').value.trim()}</div>` : ''}
  <div style="margin-top:14px;font-size:11.5px;color:#4a4a4a;line-height:1.5">
    Изготовление 1–3 рабочих дня. Доставка по всей Беларуси. Приём заказов: ${Р.заказыEmail}, ${Р.моб} (звонок/Viber).<br>
    Поставщик действует на основании ${Р.основание}.
  </div>
  <div style="margin-top:22px;display:flex;justify-content:space-between;align-items:flex-end;font-size:12.5px">
    <div>Директор ЧПТУП «Дианаст»</div>
    <div style="border-bottom:1px solid #999;width:160px"></div>
    <div><b>${Р.директорКоротко}</b></div>
  </div>`;
  $('invoice-overlay').classList.add('show');
}

// ── Отправка ──
// Два канала, независимые по итогу: сделка в воронке CRM (подписана токеном
// вошедшего в облако) и письмо через Google Script (с файлом и копией счёта
// клиенту). Упал один — заказ доходит вторым.
async function crmOrder() {
  const ток = window.Облако && Облако.токен ? Облако.токен() : null;
  if (!ток) return false;
  try {
    const r = await fetch('https://dianast-crm.vercel.app/api/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + ток },
      body: JSON.stringify({
        контакт: { название: $('client').value.trim(), телефон: $('client-phone').value.trim(), почта: $('client-email').value.trim() },
        позиции: (window._rows || []).map(r => ({ название: r.наимен, количество: r.колвоСтр || r.колво, ед: r.ед })),
        комментарий: $('client-note').value.trim(),
        смета: window._copyText || ''
      })
    });
    return r.ok;
  } catch (e) { return false; }
}

async function sendOrder() {
  const st = $('send-status'); st.classList.add('show');
  const btn = $('inv-send');
  if (!window._rows || !window._rows.length) { alert('Сначала добавьте позиции.'); return; }
  btn.disabled = true; btn.textContent = 'Отправляю…';
  const вCrm = await crmOrder();
  if (!SCRIPT_URL) {
    if (вCrm) {
      btn.textContent = 'Заказ отправлен ✓'; btn.classList.add('ok');
      st.textContent = 'Заказ ушёл в Дианаст. Мы свяжемся с вами.';
      return;
    }
    btn.disabled = false; btn.textContent = 'Отправить заказ в Дианаст';
    const body = encodeURIComponent(window._copyText + '\n\nЗаказчик: ' + $('client').value + '\nТел: ' + $('client-phone').value + '\nEmail: ' + $('client-email').value);
    location.href = `mailto:${РЕКВИЗИТЫ.заказыEmail}?subject=${encodeURIComponent('Заказ с калькулятора · счёт ' + (window._invNum || ''))}&body=${body}`;
    st.textContent = 'Автоотправка ещё не подключена (см. «УСТАНОВКА ОТПРАВКИ.md») — открыл письмо в вашей почте, нажмите «Отправить». Файл приложите к письму вручную.';
    return;
  }
  const payload = {
    номер: window._invNum, смета: window._copyText,
    клиент: $('client').value, телефон: $('client-phone').value, email: $('client-email').value,
    комментарий: $('client-note').value, счётHtml: $('invoice').outerHTML, файлИмя: '', файлБазе64: ''
  };
  const f = $('client-file').files[0];
  if (f) {
    if (f.size > 8 * 1024 * 1024) { alert('Файл больше 8 МБ.'); btn.disabled = false; btn.textContent = 'Отправить заказ в Дианаст'; return; }
    payload.файлИмя = f.name;
    payload.файлБазе64 = await new Promise(res => { const r = new FileReader(); r.onload = () => res(r.result.split(',')[1]); r.readAsDataURL(f); });
  }
  try {
    await fetch(SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(payload) });
    btn.textContent = 'Заказ отправлен ✓'; btn.classList.add('ok');
    st.textContent = 'Заказ ушёл в Дианаст' + ($('client-email').value ? ', копия счёта — вам на ' + $('client-email').value : '') + '. Мы свяжемся с вами.';
  } catch (e) {
    if (вCrm) {
      btn.textContent = 'Заказ отправлен ✓'; btn.classList.add('ok');
      st.textContent = 'Заказ ушёл в Дианаст. Мы свяжемся с вами.';
    } else {
      btn.disabled = false; btn.textContent = 'Отправить заказ в Дианаст';
      st.textContent = 'Не получилось отправить (нет интернета?). Позвоните: ' + РЕКВИЗИТЫ.моб;
    }
  }
}

// ── Мост «из чертежа» (отливы ↔ конструктор доборных) ──
// У доборной позиции — кнопка «развёртка из чертежа». Уходя в конструктор, сохраняем
// ВЕСЬ расчёт снимком (иначе он теряется при уходе со страницы), на возврате
// восстанавливаем его и подставляем развёртку в ждущую позицию. Снимок — одноразовый.
const СНИМОК = 'dianast_otlivy_snapshot_v1';
const ВОЗВРАТ = 'dianast_dobornye_return_v1';

function вЧертёж(el) {
  const ждёт = [...document.querySelectorAll('.item')].indexOf(el);
  сохранитьСнимок(ждёт);
  location.href = '../dobornye/index.html?back=otlivy';
}

function сохранитьСнимок(ждёт) {
  try {
    const позиции = [...document.querySelectorAll('.item')].map(el => ({
      pos: el.querySelector('.pos').value, mode: el.dataset.mode || 'meter',
      lapTouched: el.dataset.lapTouched || '', dobName: el.dataset.dobName || '',
      width: el.querySelector('.width').value, meters: el.querySelector('.meters').value,
      zag: el.querySelector('.zag').value, plen: el.querySelector('.plen').value,
      qty: el.querySelector('.qty').value, lap: el.querySelector('.lap').checked,
    }));
    const снимок = {
      t: Date.now(), ждёт, цвет: ЦВЕТ_ID,
      своёИмя: ($('order-own-name') || {}).value || '', свояЦена: ($('order-own-price') || {}).value || '',
      клиент: КЛИЕНТ ? КЛИЕНТ.id : '', имяКл: $('client').value, тел: $('client-phone').value,
      почта: $('client-email').value, примеч: $('client-note') ? $('client-note').value : '',
      срочность: $('urgency').value, коэф: $('markup').value, позиции,
    };
    localStorage.setItem(СНИМОК, JSON.stringify(снимок));
  } catch (e) { /* нет места / приватный режим — просто не сохранится */ }
}

function восстановитьСнимок() {
  let сн = null, ret = null;
  try { сн = JSON.parse(localStorage.getItem(СНИМОК) || 'null'); } catch (e) {}
  try { ret = JSON.parse(localStorage.getItem(ВОЗВРАТ) || 'null'); } catch (e) {}
  localStorage.removeItem(СНИМОК);                                  // оба ключа одноразовые — стираем
  localStorage.removeItem(ВОЗВРАТ);                                 // всегда, чтобы не сработали позже
  if (!сн || !Array.isArray(сн.позиции) || !сн.позиции.length) return false;
  if (!сн.t || Date.now() - сн.t > 60 * 60 * 1000) return false;    // старше часа — не воскрешаем

  if (сн.цвет) { ЦВЕТ_ID = сн.цвет; рисоватьЦвет(); }
  const on = $('order-own-name'), op = $('order-own-price');
  if (on) on.value = сн.своёИмя || '';
  if (op) op.value = сн.свояЦена || '';
  $('urgency').value = сн.срочность || '1';
  $('markup').value = сн.коэф || '1';
  $('client').value = сн.имяКл || '';
  $('client-phone').value = сн.тел || '';
  $('client-email').value = сн.почта || '';
  if ($('client-note')) $('client-note').value = сн.примеч || '';
  КЛИЕНТ = сн.клиент ? (справочник().find(c => c.id === сн.клиент) || null) : null;
  рисоватьКлиентов(); if ($('client-pick')) $('client-pick').value = сн.клиент || '';
  плашкаКлиента(); кнопкаДобавить();

  сн.позиции.forEach(P => {
    addItem();
    const el = $('items').lastElementChild;
    el.querySelector('.pos').value = P.pos;
    const pp = ЦЕНЫ.изделия[+P.pos], plenEl = el.querySelector('.plen');
    if (pp && pp.лист) { plenEl.min = 10; plenEl.step = 10; }
    el.dataset.mode = P.mode || 'meter';
    if (P.lapTouched) el.dataset.lapTouched = P.lapTouched;
    if (P.dobName) el.dataset.dobName = P.dobName;
    el.querySelector('.width').value = P.width;
    el.querySelector('.meters').value = P.meters;
    el.querySelector('.zag').value = P.zag;
    plenEl.value = P.plen;
    el.querySelector('.qty').value = P.qty;
    el.querySelector('.lap').checked = !!P.lap;
  });

  if (ret && ret.разв) {
    const items = document.querySelectorAll('.item');
    const el = items[сн.ждёт] || items[items.length - 1];
    if (el) {
      el.querySelector('.width').value = Math.round(ret.разв);
      if (ret.имя) el.dataset.dobName = ret.имя;
    }
  }
  calc();
  return true;
}

// ── Запуск ──
ЦЕНЫ.срочность.forEach(s => {
  const b = document.createElement('button');
  b.className = 'chip срок'; b.type = 'button'; b.textContent = s.подпись; b.dataset.k = s.коэф;
  b.onclick = () => { $('urgency').value = s.коэф; calc(); };
  $('chips').appendChild(b);
});
['urgency', 'markup'].forEach(id => ['input', 'change'].forEach(ev => $(id).addEventListener(ev, calc)));
$('client-file').addEventListener('change', () => {
  $('file-name').textContent = $('client-file').files[0] ? '📎 ' + $('client-file').files[0].name : 'Прикрепить файл…';
});

// ── справочник клиентов в форме заказа ──
рисоватьКлиентов();
$('client-pick').addEventListener('focus', рисоватьКлиентов);   // список могли пополнить в «Заявке бухгалтеру»
$('client-pick').onchange = e => выбратьКлиента(e.target.value);
$('client').addEventListener('input', () => {
  // имя правят руками — отвязываемся от карточки, цена возвращается к прайсу
  if (КЛИЕНТ && $('client').value.trim() !== (КЛИЕНТ.name || '').trim()) {
    КЛИЕНТ = null; $('client-pick').value = ''; плашкаКлиента(); calc();
  }
  кнопкаДобавить();
});
['client-phone', 'client-email'].forEach(id => $(id).addEventListener('input', кнопкаДобавить));
$('client-add').onclick = () => {
  if (!естьМодуль()) return;
  const c = ЗаявкаБухгалтеру.добавитьКлиента({
    name: $('client').value.trim(),
    tel: $('client-phone').value.trim(),
    email: $('client-email').value.trim(),
  });
  if (!c) return;
  рисоватьКлиентов(); $('client-pick').value = c.id; выбратьКлиента(c.id);
  const b = $('client-add'); b.style.display = ''; b.textContent = 'Сохранено ✓';
  setTimeout(кнопкаДобавить, 1400);
};
// Кнопки добавления позиции по типу: + Отлив / + Доборный / + Лист (тип задаётся сразу).
(function () {
  const row = $('add-row'); if (!row) return;
  ЦЕНЫ.изделия.forEach((p, i) => {
    const b = document.createElement('button');
    b.className = 'add'; b.type = 'button'; b.dataset.pos = String(i);
    b.textContent = '+ ' + кратко(p);
    b.onclick = () => { if (!window._invalid) addItem(i); };
    row.appendChild(b);
  });
})();
$('copy').onclick = async () => {
  try { await navigator.clipboard.writeText(window._copyText); }
  catch (e) { const t = document.createElement('textarea'); t.value = window._copyText; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove(); }
  const b = $('copy'); b.textContent = 'Скопировано ✓';
  setTimeout(() => { b.textContent = 'Скопировать смету'; }, 1600);
};
$('invoice-btn').onclick = () => { if (window._invalid) return; calc(); buildInvoice(); };

// ── Заявка бухгалтеру (форма — в ../../заявка-бухгалтеру.js) ──
// Клиентский счёт выше — для покупателя. Этот документ — для бухгалтера,
// по нему она выставляет официальный счёт, ТН и ЭСЧФ. Цены идут готовыми из прайса.
function позицииДляЗаявки() {
  return (window._rows || []).map(r => ({
    base: r.база, razv: r.разв, ral: r.цветКод, unit: r.едЗБ,
    qty: r.колво, price: r.цена,
    pogm: r.едЗБ === 'пог.м' ? r.колво : 0,
    pcs: r.едЗБ === 'шт' ? r.колво : 0,
    note: r.наимен                                  // развёрнутое описание — только для глаз, в счёт не идёт
  }));
}
$('zayavka-btn').onclick = () => {
  if (window._invalid) return;
  calc();
  ЗаявкаБухгалтеру.открыть({ источник: позицииДляЗаявки, ключЧерновика: 'dianast_invoice_otlivy_v1',
                             тариф: false, клиентId: КЛИЕНТ ? КЛИЕНТ.id : '' });
};

// ── В заказ (история заказов, см. раздел «Заказы») ──
function позицииДляЗаказа() {
  // Все типы уходят в заказ в тех же единицах и по той же цене, что в клиентском счёте
  // (лист — тоже в штуках по цене за штуку). Иначе счёт из заказа расходился бы с
  // клиентским на копейки: при редактируемом количестве заказ считает сумму как
  // цена×кол, а пересчёт листа в м² округляет ставку за м² и ломает совпадение.
  return (window._rows || []).map(r => ({
    тип: r.лист ? 'лист' : (r.сложн ? 'доборный' : 'отлив'),
    наимен: r.наимен, ед: r.ед, кол: r.колво, цена: r.цена,
    парам: { база: r.база, разв: r.разв, цветКод: r.цветКод },
  }));
}
if ($('order-add')) $('order-add').onclick = () => {
  if (window._invalid) return;
  calc();
  const поз = позицииДляЗаказа();
  if (!поз.length || typeof Заказы === 'undefined') return;
  const n = Заказы.добавить(поз, { источник: 'отливы' });
  const b = $('order-add'), t0 = b.textContent;
  b.textContent = `В заказе ✓ (${n})`; b.classList.add('ok');
  setTimeout(() => { b.textContent = t0; b.classList.remove('ok'); }, 1600);
};
// ── Передать в раскрой ──
// Тот же мост, что у конструктора доборных: заготовки уезжают в калькулятор
// раскроя через localStorage, там строится карта листов и метраж рулона.
$('raskroy-btn').onclick = () => {
  if (window._invalid) return;
  calc();
  const items = (window._rows || [])
    .filter(r => r.раскрой && r.раскрой.w > 0 && r.раскрой.l > 0 && r.раскрой.qty > 0)
    .map(r => ({ w: String(r.раскрой.w), l: String(r.раскрой.l), qty: String(r.раскрой.qty) }));
  if (!items.length) { alert('Сначала добавьте позиции с размерами.'); return; }
  try { localStorage.setItem('dianast_raskroy_handoff_v1', JSON.stringify(items)); } catch (e) {}
  location.href = '../raskroy/index.html';
};

$('inv-close').onclick = () => $('invoice-overlay').classList.remove('show');
$('inv-print').onclick = () => window.print();
$('inv-send').onclick = sendOrder;

// ── Цвет заказа (шапка): список цветов + переключение «своей цены» + пересчёт при смене ──
рисоватьЦвет();
$('order-color').onchange = e => { ЦВЕТ_ID = e.target.value; переключитьСвою(); calc(); };
['order-own-name', 'order-own-price'].forEach(id => { const el = $(id); if (el) el.addEventListener('input', calc); });

// Есть снимок расчёта (вернулись из чертежа) — восстанавливаем; иначе обычный чистый лист.
if (!восстановитьСнимок()) addItem();

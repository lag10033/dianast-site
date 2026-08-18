// ============================================================
//  ЗАЯВКА БУХГАЛТЕРУ — общий модуль для калькуляторов DIANAST
//
//  Подключается и в доборных, и в отливах:
//     <script src="../../заявка-бухгалтеру.js"></script>
//     ЗаявкаБухгалтеру.открыть({ позиции, ... })
//
//  Даёт на выходе: печатный бланк в формате счёта бухгалтера
//  (образец № 8 от 13.07.2026) и файл данных для загрузки в 1С 7.7.
//  ВАЖНО: файл для 1С пишется в кодировке windows-1251 — UTF-8 она не читает.
// ============================================================

const ЗаявкаБухгалтеру = (function () {

  // ── реквизиты поставщика: из настроек устройства, в коде их нет ──
  // Приложение опубликовано на сайте, поэтому реквизиты вводятся один раз
  // на главной («⚙ Настройки») и хранятся в памяти браузера.
  function фирмы() {
    try { return JSON.parse(localStorage.getItem('dianast_orgs_v1') || '[]') || []; } catch (e) { return []; }
  }
  function фирма() {
    const список = фирмы();
    return список.find(o => o.id === (inv && inv.orgId)) ||
           список.find(o => o.id === localStorage.getItem('dianast_org_active')) ||
           список[0] || null;
  }
  function поставщик() {
    let р = фирма();
    if (!р) { try { р = JSON.parse(localStorage.getItem('dianast_requisites_v1') || '{}') || {}; } catch (e) { р = {}; } }
    return {
      name: р.краткое || р.полное || '',
      addr: р.юрАдрес || '',
      tel: р.телФакс || р.моб || '',
      unp: р.унп || '', okpo: р.окпо || '',
      bank: р.банк || '', rs: р.iban || '', bic: р.bic || ''
    };
  }
  const CLKEY = 'dianast_clients_v1';          // справочник клиентов — общий для всех калькуляторов
  const SEEDKEY = 'dianast_clients_seed', SEEDVER = '2026-07-22';
  const ПРИПУСК_ПО_УМОЛЧАНИЮ = 60;             // мм — добавляется ТОЛЬКО отливам (см. припускДля)
  // Значения по умолчанию для новой карточки клиента. Выведены из счетов бухгалтера
  // № 7 и № 8 от 13.07.2026: тариф 60 руб/м², припуск отливам 60 мм, минималка 6,40 руб/пог.м.
  const ДЕФОЛТ = { tariff: 60, gap: 60, minp: 6.40, markup: 0, vat: 20 };
  // Справочник клиентов В КОДЕ НЕ ХРАНИТСЯ. Реквизиты контрагентов, их тарифы и наценки —
  // коммерческая информация: приложение выложено на сайт, код доступен всем.
  // Карточки вводятся на устройстве и живут в памяти браузера; перенос — файлом (данные.js).
  const КЛИЕНТ_ПО_УМОЛЧАНИЮ = [];

  // ── свои утилиты: на страницах хоста fmt/plural могут быть другими ──
  const r2 = n => Math.round((parseFloat(n) || 0) * 100) / 100;
  const r3 = n => Math.round((parseFloat(n) || 0) * 1000) / 1000;   // кол-во: м² бывают дробные (0,413)
  const money = n => r2(n).toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const чис = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('ru-RU');
  const escHtml = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  function скл(n, one, few, many) {
    n = Math.abs(n) % 100; const n1 = n % 10;
    if (n > 10 && n < 20) return many;
    if (n1 > 1 && n1 < 5) return few;
    return n1 === 1 ? one : many;
  }
  const МЕСЯЦЫ = ['Января', 'Февраля', 'Марта', 'Апреля', 'Мая', 'Июня', 'Июля',
                  'Августа', 'Сентября', 'Октября', 'Ноября', 'Декабря'];

  // ── сумма прописью: рубли словами, копейки цифрами — как в счёте бухгалтера ──
  const _ЕД = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const _ЕДЖ = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const _ДЕС1 = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать',
                 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const _ДЕС = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const _СОТ = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  function триадой(n, женский) {
    const out = [], с = Math.floor(n / 100), д = Math.floor(n % 100 / 10), е = n % 10;
    if (с) out.push(_СОТ[с]);
    if (д === 1) out.push(_ДЕС1[е]);
    else { if (д) out.push(_ДЕС[д]); if (е) out.push((женский ? _ЕДЖ : _ЕД)[е]); }
    return out.join(' ');
  }
  function числоПрописью(n) {
    n = Math.floor(n); if (n === 0) return 'ноль';
    const млн = Math.floor(n / 1e6), тыс = Math.floor(n % 1e6 / 1000), ост = n % 1000, p = [];
    if (млн) p.push(триадой(млн, false) + ' ' + скл(млн, 'миллион', 'миллиона', 'миллионов'));
    if (тыс) p.push(триадой(тыс, true) + ' ' + скл(тыс, 'тысяча', 'тысячи', 'тысяч'));
    if (ост) p.push(триадой(ост, false));
    return p.join(' ');
  }
  function суммаПрописью(v) {
    const всего = Math.round((parseFloat(v) || 0) * 100), руб = Math.floor(всего / 100), коп = всего % 100;
    const с = числоПрописью(руб);
    return с.charAt(0).toUpperCase() + с.slice(1) + ' ' + скл(руб, 'рубль', 'рубля', 'рублей') +
           ' ' + String(коп).padStart(2, '0') + ' ' + скл(коп, 'копейка', 'копейки', 'копеек');
  }

  // ── состояние ──
  let clients = [];
  try { clients = JSON.parse(localStorage.getItem(CLKEY) || 'null') || КЛИЕНТ_ПО_УМОЛЧАНИЮ.slice(); }
  catch (e) { clients = КЛИЕНТ_ПО_УМОЛЧАНИЮ.slice(); }
  function saveClients() { try { localStorage.setItem(CLKEY, JSON.stringify(clients)); } catch (e) {} }
  // Разовая синхронизация справочника: доливаем новых клиентов и переводим старые карточки
  // на формулу с припуском (у них тариф был «с зашитой наценкой» — 72 вместо 60 и +20%).
  try {
    if (localStorage.getItem(SEEDKEY) !== SEEDVER) {
      КЛИЕНТ_ПО_УМОЛЧАНИЮ.forEach(s => { if (!clients.some(c => c.id === s.id)) clients.push(Object.assign({}, s)); });
      clients.forEach(c => {
        const s = КЛИЕНТ_ПО_УМОЛЧАНИЮ.find(x => x.id === c.id);
        if (c.minp == null) c.minp = s ? s.minp : ДЕФОЛТ.minp;         // минималку вернули: припуск теперь только отливам
        if (c.markup != null) return;                        // остальное уже на новой схеме
        if (s) { c.tariff = s.tariff; c.gap = s.gap; c.markup = s.markup; }
        else { c.gap = ПРИПУСК_ПО_УМОЛЧАНИЮ; c.markup = 0; } // чужие карточки: тариф не трогаем
      });
      localStorage.setItem(SEEDKEY, SEEDVER); saveClients();
    }
  } catch (e) {}

  let inv = null;        // {clientId, date, days, tariff, gap, markup, vat, fullNames, lines[], sig}
  let ОПЦ = null;        // {источник, ключЧерновика, тариф}
  let смонтировано = false;

  const $ = id => document.getElementById(id);
  const клиент = () => clients.find(c => c.id === inv.clientId) || clients[0] || null;
  const тарифныйРежим = () => !!(ОПЦ && ОПЦ.тариф);

  // ── нормализация позиций от калькулятора ──
  // Ждём: {base, unit, razv, thickness, ral, pogm, pcs, qty, price}
  //   base   — название без размера («Нащельник», «Отлив»)
  //   razv   — ширина развёртки, мм (она же типоразмер в наименовании)
  //   qty/price — уже посчитанные калькулятором (режим без тарифа)
  function нормализовать(список) {
    return (список || []).map(п => {
      const l = {
        base: п.base || 'Позиция', name: '', nameManual: false,
        unit: п.unit || 'пог.м', razv: п.razv || 0,
        thickness: п.thickness != null ? п.thickness : null, ral: п.ral || '',
        pogm: r2(п.pogm || 0), pcs: п.pcs || 0,
        qtyBase: п.qty != null ? r3(п.qty) : null, priceBase: п.price != null ? r2(п.price) : null,
        note: п.note || '',
        tariff: null, gap: null, qty: null, price: null, minApplied: false
      };
      l.name = п.name || автоИмя(l);
      if (п.name) l.nameManual = true;
      return l;
    });
  }
  // «9016» → «RAL 9016», а «Тёмная вишня» оставляем как есть
  const цветПодпись = ral => !ral ? '' : (/^\d/.test(String(ral).trim()) ? 'RAL ' + ral : String(ral));
  // наименование = карточка номенклатуры в 1С: короткое или с цветом и толщиной
  function автоИмя(l) {
    const базовое = l.razv ? `${l.base} ${чис(l.razv)} мм` : l.base;
    if (!inv || !inv.fullNames) return базовое;
    const хвост = [l.thickness ? чис(l.thickness, 2) + ' мм' : '', цветПодпись(l.ral)].filter(Boolean);
    return [базовое, ...хвост].join(', ');
  }
  function переименовать() { inv.lines.forEach(l => { if (!l.nameManual && l.base) l.name = автоИмя(l); }); }

  // ── расчёт ──
  function автоКол(l) {
    if (!тарифныйРежим()) return l.qtyBase != null ? l.qtyBase : 0;
    if (l.unit === 'шт') return l.pcs;
    if (l.unit === 'м²') return r2(l.pogm * l.razv / 1000);
    return r2(l.pogm);
  }
  // Цена за пог. м = (ширина + припуск) × тариф × (1 + наценка).
  // Припуск — плата за сам погонный метр (загибы, кромка, отход): именно он делает узкие
  // позиции дороже в пересчёте на м² и заменяет прежнюю «минималку» без ступеньки.
  function ставка(l) { return l.tariff != null ? l.tariff : (parseFloat(inv.tariff) || 0); }
  // Припуск добавляется ТОЛЬКО отливам: у них он заложен в цену (счёт № 7 — «Отлив 190 мм» = (190+60)×60).
  // Нащельникам и прочим доборным его не добавляют — счёт № 8 считался как ширина × тариф.
  function припускДля(l) {
    if (l.gap != null) return l.gap;                                   // задан вручную у позиции
    return /отлив/i.test((l.base || '') + ' ' + (l.name || '')) ? (parseFloat(inv.gap) || 0) : 0;
  }
  function ширинаСПрипуском(l) { return (l.razv + припускДля(l)) / 1000; }
  function коэфНаценки() { return 1 + (parseFloat(inv.markup) || 0) / 100; }
  function автоЦена(l) {
    l.minApplied = false;
    if (!тарифныйРежим()) return l.priceBase != null ? l.priceBase : 0;
    const т = ставка(l), ш = ширинаСПрипуском(l);
    let p;
    if (l.unit === 'м²') p = т;
    else if (l.unit === 'шт') p = (l.pcs > 0 ? l.pogm / l.pcs : 0) * ш * т;
    else p = ш * т;
    p = r2(p);
    const мин = parseFloat(inv.minp) || 0;                 // минималка — до наценки, наценка ложится и на неё
    if (l.unit === 'пог.м' && мин > 0 && p < мин) { p = r2(мин); l.minApplied = true; }
    return r2(p * коэфНаценки());
  }
  // видна только в форме — в счёт не попадает, клиенту тариф и наценку показывать нельзя
  function формулаЦены(l, факт) {
    if (!тарифныйРежим() || l.unit !== 'пог.м' || !l.razv) return '';
    if (l.price != null && r2(l.price) !== r2(автоЦена(l))) return 'цена задана вручную';
    const нац = parseFloat(inv.markup) || 0, пр = припускДля(l);
    const хвост = (нац ? ` × ${чис(1 + нац / 100, 3)}` : '') + ` = ${money(факт)}`;
    if (l.minApplied) return `${чис(l.razv)} мм — минималка ${money(parseFloat(inv.minp) || 0)}` + хвост;
    return (пр ? `(${чис(l.razv)} + ${чис(пр)}) мм` : `${чис(l.razv)} мм`) + ` × ${money(ставка(l))}` + хвост;
  }
  const кол = l => l.qty != null ? r2(l.qty) : автоКол(l);
  const цена = l => { const a = автоЦена(l); return l.price != null ? r2(l.price) : a; };
  function итоги() {
    const ставка = parseFloat(inv.vat) || 0;
    let net = 0, vat = 0;
    const rows = inv.lines.map((l, i) => {
      const q = кол(l), p = цена(l), s = r2(q * p), n = r2(s * ставка / 100);
      net = r2(net + s); vat = r2(vat + n);
      return { n: i + 1, l, qty: q, price: p, sum: s, vat: n, gross: r2(s + n) };
    });
    return { rows, net, vat, gross: r2(net + vat), rate: ставка };
  }
  function сохранить() { try { localStorage.setItem(ОПЦ.ключЧерновика, JSON.stringify(inv)); } catch (e) {} }
  function сигнатура(позиции) {
    return (позиции || []).map(п => [п.base, п.razv, п.unit, п.qty, п.price, п.pogm, п.pcs].join('|')).join(';');
  }

  // ── быстрый ввод реквизитов: разбор вставленного текста / файла в поля карточки ──
  // Кириллические двойники латиницы: в BIC из документов латиница часто подменена
  // кириллицей (визуально не отличить), а банк и 1С примут только латиницу.
  const КИР2ЛАТ = { А: 'A', В: 'B', Е: 'E', К: 'K', М: 'M', Н: 'H', О: 'O', Р: 'P', С: 'C', Т: 'T', У: 'Y', Х: 'X',
                    а: 'a', в: 'b', е: 'e', к: 'k', м: 'm', н: 'h', о: 'o', р: 'p', с: 'c', т: 't', у: 'y', х: 'x' };
  const латиница = s => String(s).replace(/[А-Яа-я]/g, ch => КИР2ЛАТ[ch] || ch);

  // текст после метки-двоеточия; если человек вставил всё одной строкой — режем по следующей метке
  function послеМетки(строка) {
    const i = строка.indexOf(':');
    let s = i >= 0 ? строка.slice(i + 1) : строка;
    s = s.split(/\s(?:УНП|ОКПО|Реквизиты\s+банка|Банк|BIC|БИК|Код\s+банка|Почтовый|Контактн|Директор|Адрес\s+электронной|e-?mail)/i)[0];
    return s.replace(/\s{2,}/g, ' ').replace(/[\s.;]+$/, '').trim();
  }

  // Разбор реквизитов РБ. Возвращает ТОЛЬКО распознанные поля — частичный текст
  // не должен затирать уже введённое. Метки распознаём мягко (двоеточие/регистр/варианты).
  function разобратьРеквизиты(сырой) {
    const текст = String(сырой || '').replace(/[   ]/g, ' ');
    const строки = текст.split(/\r?\n/).map(s => s.replace(/[ \t]+/g, ' ').trim()).filter(Boolean);
    const всё = строки.join('\n');
    const out = {};

    const em = всё.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/);
    if (em) out.email = em[0];
    let m = всё.match(/УНП[^\d]{0,6}(\d{9})/i);      if (m) out.unp = m[1];
    m = всё.match(/ОКПО[^\d]{0,6}(\d{8,14})/i);       if (m) out.okpo = m[1];
    m = всё.match(/\bBY\d{2}\s?[A-Za-z]{4}\s?(?:\d\s?){20}/i);
    if (m) out.rs = m[0].replace(/\s+/g, '').toUpperCase();
    m = всё.match(/(?:BIC|SWIFT|БИК|Код\s*банка)[:\s\-–—]*([A-Za-zА-Яа-я0-9]{8}(?:[A-Za-zА-Яа-я0-9]{3})?)/i);
    if (m) out.bic = латиница(m[1]).toUpperCase();

    for (const ln of строки) {
      if (!out.addr && /(юридическ\w*|юр\.?)\s*адрес/i.test(ln)) out.addr = послеМетки(ln);
      if (!out.tel && /(тел(ефон)?\.?|факс)/i.test(ln)) {
        const t = ln.match(/\+?\d[\d\-()\s]{4,}\d/);
        if (t) out.tel = t[0].replace(/\s+/g, ' ').trim();
      }
      if (!out.bank && /(банк|беларусбанк)/i.test(ln) && /(ОАО|ЗАО|ОДО|ООО|УП|филиал|отделение)/i.test(ln)
          && !/^код\s*банка/i.test(ln) && !/^адрес\s*банка/i.test(ln)) {
        let b = ln.replace(/.*?р\/с\s*BY\w+\s*/i, '')
                  .replace(/[,;]?\s*(?:BIC|SWIFT|БИК|Код\s*банка).*$/i, '')
                  .replace(/^реквизиты\s+банка\s*:?\s*/i, '')
                  .replace(/^в\s+/i, '').replace(/^банк\s*:?\s*/i, '')
                  .replace(/[\s,;.]+$/, '').trim();
        if (b) out.bank = b;
      }
    }
    if (!out.addr) {
      const p = строки.find(l => /почтов\w*\s*адрес/i.test(l)) ||
                строки.find(l => /адрес/i.test(l) && !/электрон|e-?mail|банк/i.test(l));
      if (p) out.addr = послеМетки(p);
    }

    const полнаяФорма = /(Общество с ограниченной|Открытое акционерное|Закрытое акционерное|Дополнительное общество|Унитарное|Частное|Совместное|Иностранное|Производственн|Республиканское|Индивидуальный предприниматель|Крестьянское)/i;
    const аббрев = /(?:^|[\s"«»().,;])(ООО|ОАО|ЗАО|ОДО|ЧУП|ЧПУП|ЧТУП|ЧПТУП|СООО|ИООО|СЗАО|ИЗАО|РУП|УП|ГП|ТУП|ИП|ПК)(?=$|[\s"«»().,;])/;
    let ns = строки.find(l => /(наименовани|плательщик|организаци)/i.test(l) && /:/.test(l));
    if (ns) out.name = послеМетки(ns);
    else {
      // строку с адресом/банком/контактами именем не берём; УНП/ОКПО в той же строке
      // допускаем (частая вёрстка «ООО «Х», УНП …») и отрезаем от имени хвостом ниже
      ns = строки.find(l => (полнаяФорма.test(l) || аббрев.test(l)) &&
                            !/(адрес|банк|р\/с|BIC|тел|email|почт)/i.test(l));
      if (ns) out.name = ns.replace(/[,;]?\s*(?:УНП|ОКПО|р\/с|ОГРН|BIC)[\s:№#].*$/i, '').replace(/[\s,;]+$/, '').trim();
    }
    return out;
  }

  // .docx = zip; достаём word/document.xml по central directory и разжимаем deflate-raw.
  async function текстИзDocx(буфер) {
    const dv = new DataView(буфер), bytes = new Uint8Array(буфер), dec = new TextDecoder();
    let eocd = -1;
    for (let i = bytes.length - 22; i >= 0 && i > bytes.length - 22 - 65557; i--) {
      if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
    }
    if (eocd < 0) throw new Error('файл не похож на .docx');
    let p = dv.getUint32(eocd + 16, true);
    const count = dv.getUint16(eocd + 10, true);
    let tgt = null;
    for (let n = 0; n < count; n++) {
      if (dv.getUint32(p, true) !== 0x02014b50) break;
      const method = dv.getUint16(p + 10, true), compSize = dv.getUint32(p + 20, true);
      const nameLen = dv.getUint16(p + 28, true), extraLen = dv.getUint16(p + 30, true), commLen = dv.getUint16(p + 32, true);
      const off = dv.getUint32(p + 42, true);
      const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen));
      if (name === 'word/document.xml') { tgt = { method, compSize, off }; break; }
      p += 46 + nameLen + extraLen + commLen;
    }
    if (!tgt) throw new Error('в .docx нет word/document.xml');
    if (dv.getUint32(tgt.off, true) !== 0x04034b50) throw new Error('битый .docx');
    const nl = dv.getUint16(tgt.off + 26, true), xl = dv.getUint16(tgt.off + 28, true);
    const start = tgt.off + 30 + nl + xl, comp = bytes.subarray(start, start + tgt.compSize);
    let xmlBytes;
    if (tgt.method === 0) xmlBytes = comp;
    else if (tgt.method === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('браузер не умеет распаковку — вставьте текстом');
      const s = new Response(comp).body.pipeThrough(new DecompressionStream('deflate-raw'));
      xmlBytes = new Uint8Array(await new Response(s).arrayBuffer());
    } else throw new Error('неизвестный метод сжатия в .docx');
    return документXmlВТекст(new TextDecoder('utf-8').decode(xmlBytes));
  }
  // из document.xml: каждый абзац <w:p> — своя строка, куски <w:t> склеиваем без пробела
  function документXmlВТекст(xml) {
    return xml.split(/<\/w:p>/).map(абз => {
      const части = [];
      абз.replace(/<w:t[^>]*>([^<]*)<\/w:t>/g, (_, t) => { части.push(t); return ''; });
      const s = части.join('')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
        .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
      return s.replace(/ /g, ' ').replace(/\s{2,}/g, ' ').trim();
    }).filter(Boolean).join('\n');
  }
  // .txt: пробуем UTF-8, при мусоре (�) перечитываем как windows-1251
  function текстИзTxt(буфер) {
    let s = new TextDecoder('utf-8').decode(буфер);
    if (/�/.test(s)) { try { s = new TextDecoder('windows-1251').decode(буфер); } catch (e) {} }
    return s;
  }
  // применить распознанные поля в форму карточки; не трогаем то, что не распознано
  function разнестиВКарточку(данные) {
    const карта = { name: 'zb-cl-name', unp: 'zb-cl-unp', okpo: 'zb-cl-okpo', addr: 'zb-cl-addr',
                    tel: 'zb-cl-tel', email: 'zb-cl-email', rs: 'zb-cl-rs', bank: 'zb-cl-bank', bic: 'zb-cl-bic' };
    let n = 0;
    Object.keys(карта).forEach(k => { if (данные[k] && $(карта[k])) { $(карта[k]).value = данные[k]; n++; } });
    return n;
  }

  // ── разметка и стили (монтируются один раз) ──
  const CSS = `
  #zb-overlay{ display:none; position:fixed; inset:0; background:rgba(20,15,10,.55); z-index:120; overflow:auto; padding:24px 12px;
    font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1A1A1A; line-height:1.5; }
  #zb-overlay.show{ display:block; }
  #zb-overlay *{ box-sizing:border-box; }
  #zb-box{ max-width:880px; margin:0 auto; background:#fff; border-radius:16px; padding:20px; position:relative; }
  #zb-box h2{ font-size:18px; font-weight:800; margin:0 0 2px; }
  #zb-box button{ cursor:pointer; font-family:inherit; }
  .zb-sub{ font-size:12.5px; color:#4a4a4a; margin-bottom:14px; }
  .zb-x{ position:absolute; top:14px; right:14px; border:none; background:none; font-size:24px; line-height:1; color:#b5aca0; padding:0; }
  .zb-x:hover{ color:#C1440E; }
  .zb-sec{ border:1px solid #E2DCD3; border-radius:12px; padding:12px 13px; margin-bottom:12px; }
  .zb-sec h3{ font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#4a4a4a; margin:0 0 9px; }
  .zb-row{ display:flex; flex-wrap:wrap; gap:9px; align-items:flex-end; }
  .zb-f{ display:flex; flex-direction:column; gap:3px; }
  .zb-f label{ font-size:11px; font-weight:700; color:#4a4a4a; }
  .zb-f input,.zb-f select{ font-size:14.5px; padding:8px 10px; border:1.5px solid #E2DCD3; border-radius:9px; font-family:inherit; background:#fff; color:#1A1A1A; }
  .zb-f input:focus-visible,.zb-f select:focus-visible{ outline:none; border-color:#D4521E; }
  .zb-f.grow{ flex:1; min-width:190px; }
  .zb-f.grow input,.zb-f.grow select{ width:100%; }
  .zb-f .num{ width:104px; text-align:right; }
  .zb-mini{ border:1.5px solid #E2DCD3; background:#fff; color:#4a4a4a; border-radius:9px; font-size:12.5px; font-weight:700; padding:8px 11px; white-space:nowrap; }
  .zb-mini:hover{ border-color:#D4521E; color:#D4521E; }
  .zb-hint{ font-size:11.5px; color:#9a938a; margin-top:7px; line-height:1.4; }
  .zb-chk{ display:inline-flex; align-items:flex-start; gap:8px; margin-bottom:10px; font-size:12.5px; font-weight:700; color:#4a4a4a; cursor:pointer; line-height:1.4; }
  .zb-chk input{ width:16px; height:16px; accent-color:#D4521E; cursor:pointer; flex:0 0 auto; margin-top:1px; }
  .zb-chk span i{ font-weight:400; font-style:normal; color:#9a938a; }
  .zb-line{ border:1px solid #E2DCD3; border-radius:11px; padding:10px 11px; margin-bottom:8px; }
  .zb-line.min .zb-price{ border-color:#e0a800; background:#fffbf0; }
  .zb-lhead{ display:flex; gap:8px; align-items:center; margin-bottom:7px; }
  .zb-lnum{ flex:0 0 auto; width:22px; height:22px; border-radius:50%; background:#D4521E; color:#fff; font-size:12px; font-weight:800; display:flex; align-items:center; justify-content:center; }
  .zb-lname{ flex:1; min-width:0; font-size:14.5px; font-weight:800; padding:6px 9px; border:1.5px solid #E2DCD3; border-radius:8px; font-family:inherit; }
  .zb-lname:focus-visible{ outline:none; border-color:#D4521E; }
  .zb-ldel{ flex:0 0 auto; border:1.5px solid #E2DCD3; background:#fff; border-radius:8px; width:30px; height:30px; font-size:15px; color:#4a4a4a; }
  .zb-ldel:hover{ border-color:#C1440E; color:#C1440E; }
  .zb-lgrid{ display:flex; flex-wrap:wrap; gap:7px; align-items:flex-end; }
  .zb-lgrid .zb-f input,.zb-lgrid .zb-f select{ font-size:13.5px; padding:6px 8px; }
  .zb-lgrid .zb-f .num{ width:88px; }
  .zb-lsum{ margin-left:auto; text-align:right; font-size:12px; color:#4a4a4a; line-height:1.45; white-space:nowrap; }
  .zb-lsum b{ font-size:14px; color:#1A1A1A; display:block; }
  .zb-lmeta{ font-size:11px; color:#9a938a; margin-top:6px; }
  .zb-empty{ font-size:13px; color:#9a938a; background:#faf8f5; border:1px dashed #E2DCD3; border-radius:10px; padding:16px; text-align:center; }
  .zb-totals{ background:#1A1A1A; color:#fff; border-radius:12px; padding:13px 15px; }
  .zb-trow{ display:flex; justify-content:space-between; gap:12px; font-size:13.5px; padding:2px 0; }
  .zb-trow.big{ font-size:17px; font-weight:800; border-top:1px solid rgba(255,255,255,.22); margin-top:6px; padding-top:8px; }
  .zb-words{ font-size:12px; color:rgba(255,255,255,.72); margin-top:8px; line-height:1.45; }
  .zb-fee{ border-top:1px solid rgba(255,255,255,.22); margin-top:9px; padding-top:8px; font-size:12.5px; color:rgba(255,255,255,.8); }
  .zb-fee b{ color:#fff; }
  .zb-fee span{ display:block; margin-top:2px; }
  .zb-fee .note{ font-size:11px; color:rgba(255,255,255,.5); margin-top:4px; line-height:1.4; }
  .zb-actions{ display:flex; flex-wrap:wrap; gap:9px; margin-top:14px; }
  .zb-btn{ border:none; border-radius:11px; font-size:14px; font-weight:800; padding:13px 16px; font-family:inherit; }
  .zb-btn.print{ background:#D4521E; color:#fff; flex:1; min-width:170px; }
  .zb-btn.print:hover{ background:#C1440E; }
  .zb-btn.file{ background:#fff; color:#1A1A1A; border:1.5px solid #E2DCD3; flex:1; min-width:150px; }
  .zb-btn.file:hover{ border-color:#D4521E; color:#D4521E; }
  .zb-cl-edit{ border-top:1px dashed #E2DCD3; margin-top:11px; padding-top:11px; display:none; }
  .zb-cl-edit.show{ display:block; }
  .zb-cl-edit .zb-row{ margin-bottom:9px; }
  .zb-cl-act{ display:flex; gap:8px; }
  .zb-cl-act .save{ background:#D4521E; color:#fff; border:none; border-radius:9px; font-size:13px; font-weight:800; padding:9px 15px; }
  .zb-cl-act .del{ margin-left:auto; border:1.5px solid #E2DCD3; background:#fff; color:#4a4a4a; border-radius:9px; font-size:13px; font-weight:700; padding:9px 13px; }
  .zb-cl-act .del:hover{ border-color:#C1440E; color:#C1440E; }
  .zb-quick{ border:1.5px dashed #D4521E; background:#fff9f4; border-radius:11px; padding:11px 12px; margin-bottom:12px; }
  .zb-quick-head{ margin-bottom:8px; }
  .zb-quick-head b{ font-size:13px; color:#1A1A1A; }
  .zb-quick-head span{ display:block; font-size:11.5px; color:#9a938a; margin-top:2px; line-height:1.4; }
  #zb-cl-paste{ width:100%; min-height:74px; resize:vertical; font-size:13px; padding:8px 10px; border:1.5px solid #E2DCD3;
    border-radius:9px; font-family:inherit; background:#fff; color:#1A1A1A; line-height:1.45; }
  #zb-cl-paste:focus-visible{ outline:none; border-color:#D4521E; }
  .zb-quick-act{ display:flex; flex-wrap:wrap; gap:8px; align-items:center; margin-top:8px; }
  .zb-quick-act .go{ background:#D4521E; color:#fff; border:none; }
  .zb-quick-act .go:hover{ background:#C1440E; color:#fff; }
  .zb-filelbl{ cursor:pointer; }
  .zb-quick-msg{ font-size:11.5px; font-weight:700; color:#4a4a4a; flex:1 1 100%; line-height:1.4; }
  .zb-quick-msg.ok{ color:#2e7d32; }
  .zb-quick-msg.err{ color:#C1440E; }`;

  const HTML = `
  <div id="zb-box">
    <button class="zb-x" id="zb-x" type="button" title="Закрыть">&times;</button>
    <h2>Заявка бухгалтеру на счёт</h2>
    <div class="zb-sub">Позиции подтянулись из расчёта. Проверьте клиента и количества — бланк и файл для 1С соберутся сами.</div>

    <div class="zb-sec">
      <h3>Плательщик</h3>
      <div class="zb-row">
        <div class="zb-f grow"><label>Клиент</label><select id="zb-client"></select></div>
        <button class="zb-mini" id="zb-cl-toggle" type="button">✎ Реквизиты</button>
        <button class="zb-mini" id="zb-cl-new" type="button">+ Новый</button>
      </div>
      <div class="zb-cl-edit" id="zb-cl-edit">
        <div class="zb-quick">
          <div class="zb-quick-head"><b>⚡ Быстрый ввод реквизитов</b>
            <span>Вставьте реквизиты одним куском или загрузите файл — УНП, адрес, р/с, банк, BIC разнесутся по полям сами. Проверьте и «Сохранить клиента».</span></div>
          <textarea id="zb-cl-paste" placeholder="Вставьте сюда реквизиты клиента (из письма, карточки, договора)…"></textarea>
          <div class="zb-quick-act">
            <button class="zb-mini go" id="zb-cl-parse" type="button">↧ Разнести по полям</button>
            <label class="zb-mini zb-filelbl" for="zb-cl-file">📎 Из файла (.txt, .docx)</label>
            <input id="zb-cl-file" type="file" accept=".txt,.docx" style="display:none">
            <span class="zb-quick-msg" id="zb-cl-parse-msg"></span>
          </div>
        </div>
        <div class="zb-row">
          <div class="zb-f grow"><label>Наименование</label><input id="zb-cl-name" placeholder='ООО "Ромашка"'></div>
          <div class="zb-f"><label>УНП</label><input id="zb-cl-unp" class="num" placeholder="123456789" inputmode="numeric"></div>
          <div class="zb-f"><label>ОКПО</label><input id="zb-cl-okpo" class="num" placeholder="—" inputmode="numeric"></div>
        </div>
        <div class="zb-row">
          <div class="zb-f grow"><label>Адрес</label><input id="zb-cl-addr" placeholder="РБ 220019 г. Минск ул. ..."></div>
          <div class="zb-f"><label>Тел./факс</label><input id="zb-cl-tel" placeholder="8(01642) 4-66-66"></div>
          <div class="zb-f"><label>Email</label><input id="zb-cl-email" placeholder="pochta@example.com"></div>
        </div>
        <div class="zb-row">
          <div class="zb-f grow"><label>Расчётный счёт</label><input id="zb-cl-rs" placeholder="BY.."></div>
          <div class="zb-f grow"><label>Банк</label><input id="zb-cl-bank" placeholder='ЗАО "АЛЬФА-БАНК", г. Минск'></div>
          <div class="zb-f"><label>Код банка</label><input id="zb-cl-bic" placeholder="ALFABY2X"></div>
        </div>
        <div class="zb-row">
          <div class="zb-f grow"><label>Цель приобретения</label><input id="zb-cl-goal" placeholder="для собственного производства и (или) потребления"></div>
          <div class="zb-f grow"><label>Дополнение</label><input id="zb-cl-extra" placeholder="Основной договор"></div>
        </div>
        <div class="zb-row">
          <div class="zb-f" id="zb-cl-tariff-wrap"><label>Тариф, руб/м²</label><input id="zb-cl-tariff" class="num" type="number" step="0.01" inputmode="decimal"></div>
          <div class="zb-f" id="zb-cl-gap-wrap"><label>Припуск отливам, мм</label><input id="zb-cl-gap" class="num" type="number" step="1" inputmode="numeric"></div>
          <div class="zb-f" id="zb-cl-minp-wrap"><label>Мин. цена, руб/пог.м</label><input id="zb-cl-minp" class="num" type="number" step="0.01" inputmode="decimal"></div>
          <div class="zb-f" id="zb-cl-markup-wrap"><label>Наценка, %</label><input id="zb-cl-markup" class="num" type="number" step="0.1" inputmode="decimal"></div>
        </div>
        <div class="zb-row">
          <div class="zb-f grow"><label>Кто привёл клиента (исполнитель по договору)</label><input id="zb-cl-agent" placeholder="ИП Петров П.П. / Петров Пётр Петрович"></div>
          <div class="zb-f"><label>Вознаграждение, %</label><input id="zb-cl-fee" class="num" type="number" step="0.1" inputmode="decimal"></div>
          <div class="zb-f"><label>НДС, %</label><input id="zb-cl-vat" class="num" type="number" step="1" inputmode="numeric"></div>
        </div>
        <div class="zb-cl-act">
          <button class="save" id="zb-cl-save" type="button">Сохранить клиента</button>
          <button class="del" id="zb-cl-del" type="button">Удалить</button>
        </div>
        <div class="zb-hint">Реквизиты вводятся один раз и хранятся в приложении — они общие для всех калькуляторов.</div>
      </div>
    </div>

    <div class="zb-sec">
      <h3>Счёт</h3>
      <div class="zb-row">
        <div class="zb-f grow"><label>От кого счёт</label><select id="zb-org"></select></div>
      </div>
      <div class="zb-row">
        <div class="zb-f"><label>Дата</label><input id="zb-date" type="date"></div>
        <div class="zb-f"><label>Действителен, дн.</label><input id="zb-days" class="num" type="number" step="1" min="1" inputmode="numeric"></div>
        <div class="zb-f zb-tariff-only"><label>Тариф, руб/м² без НДС</label><input id="zb-tariff" class="num" type="number" step="0.01" inputmode="decimal"></div>
        <div class="zb-f zb-tariff-only"><label>Припуск отливам, мм</label><input id="zb-gap" class="num" type="number" step="1" inputmode="numeric"></div>
        <div class="zb-f zb-tariff-only"><label>Мин. цена, руб/пог.м</label><input id="zb-minp" class="num" type="number" step="0.01" inputmode="decimal"></div>
        <div class="zb-f zb-tariff-only"><label>Наценка, %</label><input id="zb-markup" class="num" type="number" step="0.1" inputmode="decimal"></div>
        <div class="zb-f"><label>НДС, %</label><input id="zb-vat" class="num" type="number" step="1" inputmode="numeric"></div>
      </div>
      <div class="zb-hint" id="zb-head-hint"></div>
    </div>

    <div class="zb-sec">
      <h3>Позиции</h3>
      <label class="zb-chk"><input type="checkbox" id="zb-fullnames">
        <span>Цвет и толщина в наименовании<br><i id="zb-chk-hint"></i></span></label>
      <div id="zb-lines"></div>
      <button class="zb-mini" id="zb-reload" type="button">↻ Пересобрать из расчёта</button>
    </div>

    <div class="zb-totals">
      <div class="zb-trow"><span>Итого без НДС</span><span id="zb-t-net">0,00</span></div>
      <div class="zb-trow"><span>НДС</span><span id="zb-t-vat">0,00</span></div>
      <div class="zb-trow big"><span>Всего с НДС</span><span id="zb-t-gross">0,00</span></div>
      <div class="zb-words" id="zb-words"></div>
      <div class="zb-fee" id="zb-fee" style="display:none"></div>
    </div>

    <div class="zb-actions">
      <button class="zb-btn print" id="zb-print" type="button">🖨 Бланк заявки</button>
      <button class="zb-btn file" id="zb-save-html" type="button">💾 Сохранить бланк</button>
      <button class="zb-btn file" id="zb-1c" type="button">💾 Файл для 1С</button>
    </div>
  </div>`;

  function монтировать() {
    if (смонтировано) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ov = document.createElement('div'); ov.id = 'zb-overlay'; ov.innerHTML = HTML; document.body.appendChild(ov);
    смонтировано = true;
    подписаться();
  }

  // ── отрисовка ──
  // условия выбранного клиента → в шапку заявки (тариф, припуск, минималка, наценка, НДС, вознаграждение)
  function применитьКлиента() {
    const c = клиент(); if (!c) return;
    if (c.tariff) inv.tariff = c.tariff;
    inv.gap = c.gap != null ? c.gap : ПРИПУСК_ПО_УМОЛЧАНИЮ;
    inv.minp = c.minp || 0;
    inv.markup = c.markup || 0;
    inv.agent = c.agent || ''; inv.fee = c.fee || 0;
    if (c.vat != null) inv.vat = c.vat;
  }
  // Завести карточку прямо из калькулятора (форма заказа в отливах). Реквизиты и условия —
  // по умолчанию, дозаполняются здесь же, в «Реквизитах». Если имя уже есть — дописываем контакты.
  function добавитьКлиента(д) {
    д = д || {};
    const имя = (д.name || '').trim(); if (!имя) return null;
    const есть = clients.find(c => (c.name || '').trim().toLowerCase() === имя.toLowerCase());
    if (есть) {                                   // такой уже заведён — обновляем контакты
      if (д.tel) есть.tel = д.tel;
      if (д.email) есть.email = д.email;
      saveClients(); return есть;
    }
    // тариф НЕ ставим: условий нового клиента мы не знаем, и цена в калькуляторе
    // не должна молча измениться. Пока тарифа нет — считается обычный прайс.
    const c = { id: 'cl' + Date.now(), name: имя, addr: '', tel: д.tel || '', email: д.email || '',
                unp: '', rs: '', bank: '', bic: '', goal: '', extra: '', agent: '', fee: 0,
                tariff: 0, gap: ДЕФОЛТ.gap, minp: ДЕФОЛТ.minp,
                markup: ДЕФОЛТ.markup, vat: ДЕФОЛТ.vat };
    clients.push(c); saveClients(); return c;
  }
  // Обновить поля карточки клиента прямо из калькулятора (напр. задать доборным
  // индивидуальный тариф). Пишем только переданные поля — остальное не трогаем.
  function обновитьКлиента(id, поля) {
    const c = clients.find(x => x.id === id); if (!c || !поля) return null;
    ['tariff', 'gap', 'minp', 'markup', 'vat', 'tel', 'email', 'name', 'agent', 'fee'].forEach(k => {
      if (поля[k] !== undefined) c[k] = поля[k];
    });
    saveClients();
    return c;
  }
  function рисоватьКлиентов() {
    const sel = $('zb-client');
    sel.innerHTML = clients.map(c => `<option value="${c.id}">${escHtml(c.name)}</option>`).join('')
      || '<option value="">— клиентов пока нет —</option>';
    if (inv.clientId) sel.value = inv.clientId;
  }
  function заполнитьКарточку() {
    const c = клиент(), v = (id, val) => { $(id).value = val == null ? '' : val; };
    v('zb-cl-name', c ? c.name : ''); v('zb-cl-unp', c ? c.unp : ''); v('zb-cl-okpo', c ? c.okpo : '');
    v('zb-cl-addr', c ? c.addr : '');
    v('zb-cl-tel', c ? c.tel : ''); v('zb-cl-email', c ? c.email : '');
    v('zb-cl-rs', c ? c.rs : ''); v('zb-cl-bank', c ? c.bank : ''); v('zb-cl-bic', c ? c.bic : '');
    v('zb-cl-goal', c ? c.goal : ''); v('zb-cl-extra', c ? c.extra : '');
    v('zb-cl-tariff', c ? c.tariff : ''); v('zb-cl-gap', c ? c.gap : ПРИПУСК_ПО_УМОЛЧАНИЮ);
    v('zb-cl-minp', c ? c.minp : 0); v('zb-cl-markup', c ? c.markup : 0); v('zb-cl-vat', c ? c.vat : 20);
    v('zb-cl-agent', c ? c.agent : ''); v('zb-cl-fee', c ? c.fee : 0);
  }
  function рисоватьШапку() {
    const список = фирмы(), sel = $('zb-org');
    sel.innerHTML = список.length
      ? список.map(o => `<option value="${o.id}">${escHtml(o.краткое || o.полное || 'без названия')}</option>`).join('')
      : '<option value="">— фирма не заведена —</option>';
    const т = фирма();
    if (т) { sel.value = т.id; inv.orgId = т.id; }
    $('zb-date').value = inv.date;
    $('zb-days').value = inv.days;
    $('zb-tariff').value = inv.tariff;
    $('zb-gap').value = inv.gap;
    $('zb-minp').value = inv.minp;
    $('zb-markup').value = inv.markup;
    $('zb-vat').value = inv.vat;
    $('zb-fullnames').checked = !!inv.fullNames;
    const тариф = тарифныйРежим();
    document.querySelectorAll('.zb-tariff-only, #zb-cl-tariff-wrap, #zb-cl-gap-wrap, #zb-cl-minp-wrap, #zb-cl-markup-wrap')
      .forEach(el => el.style.display = тариф ? '' : 'none');
    $('zb-head-hint').textContent = тариф
      ? 'Цена за пог. м = (ширина + припуск) × тариф × наценка, но не ниже минималки. Припуск ставится ТОЛЬКО отливам — у нащельников и прочих доборных его нет. У позиции припуск можно задать свой. Ни тариф, ни наценка в счёт не печатаются.'
      : 'Цены пришли из калькулятора по прайсу. Любую можно поправить руками — итоги пересчитаются.';
    $('zb-chk-hint').textContent = примерИмени() +
      ' У бухгалтера карточки заведены без цвета («Отлив 190 мм») — с галочкой в 1С создадутся новые.';
  }
  // пример берём из первой позиции, чтобы подсказка совпадала с тем, что человек видит ниже
  function примерИмени() {
    const l = inv.lines.find(x => x.base);
    if (!l) return '';
    const был = inv.fullNames, к = (inv.fullNames = false, автоИмя(l)), п = (inv.fullNames = true, автоИмя(l));
    inv.fullNames = был;
    return к === п ? '' : `«${п}» вместо «${к}».`;
  }
  function рисоватьПозиции() {
    const box = $('zb-lines');
    if (!inv.lines.length) { box.innerHTML = '<div class="zb-empty">Позиций нет — сначала посчитайте заказ.</div>'; return; }
    const t = итоги(), тариф = тарифныйРежим();
    box.innerHTML = t.rows.map(r => {
      const l = r.l, ед = ['пог.м', 'шт', 'м²'];
      const мета = [l.razv ? `${тарифныйРежим() ? 'разв. ' : 'ширина '}${чис(l.razv)} мм` : '',
                    l.thickness ? `${чис(l.thickness, 2)} мм` : '', цветПодпись(l.ral),
                    тарифныйРежим() && l.pogm ? `${чис(l.pogm, 2)} пог. м` : '',
                    тарифныйРежим() && l.pcs ? `${l.pcs} шт` : '', l.note,
                    формулаЦены(l, r.price)].filter(Boolean).join(' · ');
      return `<div class="zb-line${l.minApplied ? ' min' : ''}" data-i="${r.n - 1}">
        <div class="zb-lhead">
          <span class="zb-lnum">${r.n}</span>
          <input class="zb-lname" data-f="name" value="${escHtml(l.name)}">
          <button class="zb-ldel" data-del="${r.n - 1}" type="button" title="Убрать позицию">&times;</button>
        </div>
        <div class="zb-lgrid">
          <div class="zb-f"><label>Ед. изм.</label><select data-f="unit">${ед.map(u => `<option${u === l.unit ? ' selected' : ''}>${u}</option>`).join('')}</select></div>
          <div class="zb-f"><label>Кол-во</label><input class="num" data-f="qty" type="number" step="0.001" inputmode="decimal" value="${r.qty}"></div>
          ${тариф ? `<div class="zb-f"><label>Тариф, руб/м²</label><input class="num" data-f="tariff" type="number" step="0.01" inputmode="decimal" value="${l.tariff != null ? l.tariff : ''}" placeholder="${inv.tariff || ''}"></div>
          <div class="zb-f"><label>Припуск, мм</label><input class="num" data-f="gap" type="number" step="1" inputmode="numeric" value="${l.gap != null ? l.gap : ''}" placeholder="${припускДля(l)}"></div>` : ''}
          <div class="zb-f"><label>Цена</label><input class="num zb-price" data-f="price" type="number" step="0.01" inputmode="decimal" value="${r.price}"></div>
          <div class="zb-lsum">${money(r.sum)} + НДС ${money(r.vat)}<b>${money(r.gross)} руб.</b></div>
        </div>
        ${мета ? `<div class="zb-lmeta">${мета}</div>` : ''}
      </div>`;
    }).join('');
    box.querySelectorAll('.zb-line').forEach(row => {
      const i = +row.dataset.i, l = inv.lines[i];
      row.querySelectorAll('[data-f]').forEach(inp => {
        const f = inp.dataset.f;
        inp.onchange = () => {
          if (f === 'name') { l.name = inp.value; l.nameManual = (inp.value !== автоИмя(l)); }
          else if (f === 'unit') { l.unit = inp.value; if (тарифныйРежим()) { l.qty = null; l.price = null; } }
          else if (f === 'qty') l.qty = parseFloat(inp.value) || 0;
          else if (f === 'tariff') { l.tariff = inp.value === '' ? null : (parseFloat(inp.value) || 0); l.price = null; }
          else if (f === 'gap') { l.gap = inp.value === '' ? null : (parseFloat(inp.value) || 0); l.price = null; }
          else if (f === 'price') l.price = parseFloat(inp.value) || 0;
          сохранить(); рисоватьПозиции(); рисоватьИтоги();
        };
      });
      row.querySelector('[data-del]').onclick = () => {
        inv.lines.splice(i, 1); сохранить(); рисоватьПозиции(); рисоватьИтоги();
      };
    });
  }
  function рисоватьИтоги() {
    const t = итоги();
    $('zb-t-net').textContent = money(t.net) + ' руб.';
    $('zb-t-vat').textContent = money(t.vat) + ' руб.';
    $('zb-t-gross').textContent = money(t.gross) + ' руб.';
    $('zb-words').innerHTML = `НДС: ${суммаПрописью(t.vat)}<br>Всего: ${суммаПрописью(t.gross)}`;
    рисоватьВознаграждение(t);
  }
  // Вознаграждение тому, кто привёл клиента. Только для глаз владельца:
  // в бланк заявки и в файл для 1С не попадает. Выплачивается по договору
  // возмездного оказания услуг, после поступления денег на счёт.
  function рисоватьВознаграждение(t) {
    const box = $('zb-fee');
    const ставка = parseFloat(inv.fee) || 0;
    if (!(ставка > 0) || !t.net) { box.style.display = 'none'; return; }
    const сумма = r2(t.net * ставка / 100);
    const кому = inv.agent ? ' — ' + escHtml(inv.agent) : '';
    box.style.display = '';
    box.innerHTML = `Вознаграждение ${чис(ставка, 1)} %${кому}: <b>${money(сумма)} руб.</b>` +
      `<span>Остаётся с заказа: ${money(r2(t.net - сумма))} руб. без НДС</span>` +
      `<span class="note">Считается от суммы без НДС. В счёт и в 1С не попадает: платится отдельно, по акту и после оплаты заказа.</span>`;
  }

  function рисоватьВсё() { рисоватьКлиентов(); заполнитьКарточку(); рисоватьШапку(); рисоватьПозиции(); рисоватьИтоги(); }

  // ── обработчики (вешаются один раз при монтировании) ──
  function подписаться() {
    const ov = $('zb-overlay');
    $('zb-x').onclick = закрыть;
    ov.onclick = e => { if (e.target === ov) закрыть(); };

    $('zb-org').onchange = e => {
      inv.orgId = e.target.value;
      const о = фирма();
      if (о && о.ндс != null) inv.vat = о.ндс;      // у фирм разные режимы: НДС или упрощёнка
      рисоватьШапку(); рисоватьПозиции(); рисоватьИтоги(); сохранить();
    };
    $('zb-client').onchange = e => {
      inv.clientId = e.target.value;
      применитьКлиента();
      заполнитьКарточку(); рисоватьШапку(); рисоватьПозиции(); рисоватьИтоги(); сохранить();
    };
    ['date', 'days', 'tariff', 'gap', 'minp', 'markup', 'vat'].forEach(f => {
      $('zb-' + f).onchange = e => {
        inv[f] = (f === 'date') ? e.target.value : (parseFloat(e.target.value) || 0);
        рисоватьПозиции(); рисоватьИтоги(); сохранить();
      };
    });
    $('zb-fullnames').onchange = e => {
      inv.fullNames = e.target.checked; переименовать(); рисоватьПозиции(); сохранить();
    };
    $('zb-reload').onclick = () => {
      if (!confirm('Собрать позиции из расчёта заново? Правки в позициях пропадут.')) return;
      const свежие = ОПЦ.источник ? ОПЦ.источник() : [];
      inv.lines = нормализовать(свежие); inv.sig = сигнатура(свежие);
      рисоватьПозиции(); рисоватьИтоги(); сохранить();
    };

    $('zb-cl-toggle').onclick = () => $('zb-cl-edit').classList.toggle('show');

    // быстрый ввод: разнести вставленный текст / файл по полям карточки
    const показатьСообщ = (t, cls) => {
      const e = $('zb-cl-parse-msg'); if (!e) return;
      e.textContent = t || ''; e.className = 'zb-quick-msg' + (cls ? ' ' + cls : '');
    };
    $('zb-cl-parse').onclick = () => {
      const txt = $('zb-cl-paste').value;
      if (!txt.trim()) { показатьСообщ('Сначала вставьте текст реквизитов в поле выше.', 'err'); return; }
      const n = разнестиВКарточку(разобратьРеквизиты(txt));
      показатьСообщ(n ? `Распознано полей: ${n}. Проверьте их и нажмите «Сохранить клиента».`
                      : 'Не удалось распознать реквизиты — заполните поля вручную.', n ? 'ok' : 'err');
    };
    $('zb-cl-file').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      if (/\.docx$/i.test(f.name) === false && /\.doc$/i.test(f.name)) {
        показатьСообщ('Старый формат .doc в браузере не читается. Пересохраните файл как .docx или вставьте текст.', 'err');
        e.target.value = ''; return;
      }
      показатьСообщ('Читаю файл…');
      try {
        const buf = await f.arrayBuffer();
        const текст = /\.docx$/i.test(f.name) ? await текстИзDocx(buf) : текстИзTxt(buf);
        $('zb-cl-paste').value = текст;
        const n = разнестиВКарточку(разобратьРеквизиты(текст));
        показатьСообщ(n ? `Файл разобран, распознано полей: ${n}. Проверьте и «Сохранить клиента».`
                        : 'Файл прочитан (текст выше), но реквизиты не распознаны — проверьте вручную.', n ? 'ok' : 'err');
      } catch (err) {
        показатьСообщ('Не смог прочитать файл: ' + ((err && err.message) || err) + '. Откройте его и вставьте текст.', 'err');
      }
      e.target.value = '';
    };

    $('zb-cl-new').onclick = () => {
      const id = 'cl' + Date.now();
      clients.push({ id, name: 'Новый клиент', addr: '', tel: '', email: '', unp: '', rs: '', bank: '', bic: '', goal: '', extra: '',
                     tariff: inv.tariff || ДЕФОЛТ.tariff, gap: inv.gap != null ? inv.gap : ДЕФОЛТ.gap,
                     minp: inv.minp != null ? inv.minp : ДЕФОЛТ.minp,
                     markup: inv.markup || 0, vat: inv.vat != null ? inv.vat : ДЕФОЛТ.vat });
      saveClients(); inv.clientId = id; рисоватьКлиентов(); заполнитьКарточку(); сохранить();
      $('zb-cl-edit').classList.add('show'); $('zb-cl-name').focus();
    };
    $('zb-cl-save').onclick = () => {
      const c = клиент(); if (!c) return;
      const g = id => $(id).value.trim();
      c.name = g('zb-cl-name') || 'Без названия'; c.unp = g('zb-cl-unp'); c.okpo = g('zb-cl-okpo'); c.addr = g('zb-cl-addr');
      c.tel = g('zb-cl-tel'); c.email = g('zb-cl-email');
      c.rs = g('zb-cl-rs'); c.bank = g('zb-cl-bank'); c.bic = g('zb-cl-bic');
      c.goal = g('zb-cl-goal'); c.extra = g('zb-cl-extra');
      c.tariff = parseFloat(g('zb-cl-tariff')) || 0;
      c.gap = g('zb-cl-gap') === '' ? ПРИПУСК_ПО_УМОЛЧАНИЮ : (parseFloat(g('zb-cl-gap')) || 0);
      c.minp = parseFloat(g('zb-cl-minp')) || 0;
      c.markup = parseFloat(g('zb-cl-markup')) || 0;
      c.agent = g('zb-cl-agent'); c.fee = parseFloat(g('zb-cl-fee')) || 0;
      c.vat = g('zb-cl-vat') === '' ? 20 : (parseFloat(g('zb-cl-vat')) || 0);
      saveClients();
      if (тарифныйРежим() && c.tariff) inv.tariff = c.tariff;
      inv.gap = c.gap; inv.minp = c.minp; inv.markup = c.markup; inv.vat = c.vat;
      inv.agent = c.agent; inv.fee = c.fee;
      рисоватьКлиентов(); рисоватьШапку(); рисоватьПозиции(); рисоватьИтоги(); сохранить();
      const b = $('zb-cl-save'), t = b.textContent; b.textContent = 'Сохранено ✓';
      setTimeout(() => { b.textContent = t; }, 1200);
    };
    $('zb-cl-del').onclick = () => {
      const c = клиент(); if (!c) return;
      if (!confirm('Удалить клиента «' + c.name + '» из справочника?')) return;
      clients = clients.filter(x => x.id !== c.id); saveClients();
      inv.clientId = clients[0] ? clients[0].id : '';
      рисоватьКлиентов(); заполнитьКарточку(); сохранить();
    };

    $('zb-print').onclick = () => {
      // Бланк показываем в iframe ВНУТРИ страницы: в установленном PWA новые окна (window.open)
      // блокируются, и раньше счёт «не выставлялся». Печать — через contentWindow.print() (печатает бланк).
      let ov = document.getElementById('zb-blank');
      if (!ov) {
        ov = document.createElement('div');
        ov.id = 'zb-blank';
        ov.style.cssText = 'display:none;position:fixed;inset:0;z-index:200;background:#fff';
        ov.innerHTML =
          '<div style="position:absolute;top:0;left:0;right:0;height:52px;background:#1A1A1A;display:flex;align-items:center;justify-content:space-between;padding:0 12px;z-index:210">' +
            '<button id="zb-blank-x" type="button" style="background:none;border:none;color:#fff;font-size:15px;font-weight:800;cursor:pointer;font-family:inherit">← Закрыть</button>' +
            '<button id="zb-blank-print" type="button" style="background:#D4521E;border:none;color:#fff;border-radius:9px;font-size:14px;font-weight:800;padding:9px 16px;cursor:pointer;font-family:inherit">🖨 Печать / PDF</button>' +
          '</div>' +
          '<iframe id="zb-blank-frame" style="border:0;position:absolute;top:52px;left:0;right:0;bottom:0"></iframe>';
        document.body.appendChild(ov);
        document.getElementById('zb-blank-x').onclick = () => { ov.style.display = 'none'; };
        document.getElementById('zb-blank-print').onclick = () => {
          const f = document.getElementById('zb-blank-frame');
          if (f && f.contentWindow) { f.contentWindow.focus(); f.contentWindow.print(); }
        };
      }
      document.getElementById('zb-blank-frame').srcdoc = бланкHtml();
      ov.style.display = 'block';
    };
    $('zb-save-html').onclick = () => скачать(имяФайла() + '.html', new Blob([бланкHtml()], { type: 'text/html;charset=utf-8' }));
    $('zb-1c').onclick = () => {
      const c = клиент() || {};
      скачать(`schet_${c.unp || 'client'}_${inv.date}.csv`, new Blob([вWin1251(текст1С())], { type: 'text/csv' }));
    };
  }

  // ── печатный бланк (формат счёта бухгалтера, образец № 8 от 13.07.2026) ──
  function бланкHtml() {
    const c = клиент() || {}, t = итоги(), ПОСТАВЩИК = поставщик();
    const [y, m, d] = inv.date.split('-').map(Number);
    const дата = `${d} ${МЕСЯЦЫ[m - 1]} ${y} г.`;
    const строки = t.rows.map(r => `  <tr><td class="c">${r.n}</td><td>${escHtml(r.l.name)}</td><td class="c">${r.l.unit}</td>` +
      `<td class="num">${чис(r.qty, 3)}</td><td class="num">${money(r.price)}</td><td class="num">${money(r.sum)}</td>` +
      `<td class="c">${t.rate ? чис(t.rate) : '—'}</td><td class="num">${money(r.vat)}</td><td class="num">${money(r.gross)}</td></tr>`).join('\n');
    // Расчёт цен в бланк НЕ выводим: он раскрывал бы тариф и наценку клиента.
    // Проверить формулу можно в форме заявки — там она под каждой позицией.
    return `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8">
<title>Заявка на счёт — ${escHtml(c.name || '')}, ${дата}</title>
<style>
  @page { size: A4; margin: 12mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 12.5px; color:#000; max-width:780px; margin:0 auto; padding:16px; }
  .note { color:#777; font-style:italic; font-size:11px; margin-bottom:10px; }
  .warn { font-size:11.5px; margin-bottom:14px; }
  .h-block { border:1.5px solid #000; padding:8px 10px; margin-bottom:18px; }
  .h-block .lbl { font-weight:bold; }
  .h-inner { margin-left:38%; }
  .title { font-size:20px; font-weight:bold; margin:10px 0 14px; }
  .payer p { margin:2px 0; }
  table { border-collapse:collapse; width:100%; margin-top:8px; }
  th, td { border:1px solid #000; padding:4px 6px; }
  th { font-weight:normal; text-align:center; }
  td.num, th.num { text-align:right; }
  td.c { text-align:center; }
  .itogo td { font-weight:bold; }
  .sums { margin-top:10px; }
  .sign { margin-top:40px; }
  .pbtn { position:fixed; top:12px; right:12px; background:#D4521E; color:#fff; border:none; border-radius:9px;
          font-size:14px; font-weight:800; padding:11px 18px; cursor:pointer; font-family:inherit; }
  @media print { .note, .pbtn { display:none; } body { padding:0; } }
</style></head>
<body>
<button class="pbtn" onclick="window.print()">🖨 Печать / PDF</button>

<div class="note">Заявка для бухгалтера — данные для выставления счёта. Формат и реквизиты — по образцу счёта № 8 от 13.07.2026. Номер счёта проставить свой.</div>

<div class="warn">Внимание! Товар отпускается по факту прихода денег на р/с Поставщика, при наличии доверенности и паспорта. В доверенности должны быть указаны УНП и ОКПО Плательщика.</div>

<div class="h-block">
  <span class="lbl">ПОСТАВЩИК:</span>
  <div class="h-inner">
    ${ПОСТАВЩИК.name}<br>
    Адрес: ${ПОСТАВЩИК.addr}<br>
    Тел.: ${ПОСТАВЩИК.tel}<br>
    УНП&nbsp; ${ПОСТАВЩИК.unp},&nbsp; ОКПО ${ПОСТАВЩИК.okpo}<br>
    Банк: ${ПОСТАВЩИК.bank}<br>
    Р/с ${ПОСТАВЩИК.rs}<br>
    Код банка: ${ПОСТАВЩИК.bic}
  </div>
</div>

<div class="title">СЧЕТ № _____ от ${дата}</div>

<div class="payer">
  <p><b>ПЛАТЕЛЬЩИК:&nbsp; ${escHtml(c.name || '')}</b></p>
  <p>${escHtml(c.addr || '')}${c.tel ? '&nbsp;&nbsp; тел/факс: ' + escHtml(c.tel) : ''}&nbsp;&nbsp; УНП: ${escHtml(c.unp || '')}</p>
  ${(c.rs || c.bank || c.bic) ? `<p>р/с ${escHtml(c.rs || '')} в ${escHtml(c.bank || '')}, код банка ${escHtml(c.bic || '')}</p>` : ''}
  ${c.goal ? `<p><b>Цель приобретения:</b> &nbsp;&nbsp;&nbsp;&nbsp; ${escHtml(c.goal)}</p>` : ''}
  ${c.extra ? `<p><b>Дополнение: ${escHtml(c.extra)}</b></p>` : ''}
  <p style="margin-top:6px">Счет действителен в течение ${inv.days} дн.<span style="float:right">руб.</span></p>
</div>

<table>
  <tr>
    <th style="width:28px">№</th>
    <th>Наименование товара (услуги, работы)</th>
    <th style="width:58px">Ед. изм.</th>
    <th style="width:58px">Кол-во</th>
    <th style="width:70px">Цена</th>
    <th style="width:80px">Сумма</th>
    <th style="width:58px">Ставка НДС %</th>
    <th style="width:70px">НДС</th>
    <th style="width:88px">Сумма с НДС</th>
  </tr>
${строки}
  <tr class="itogo">
    <td colspan="5" style="border-left:none;border-bottom:none;text-align:right">Итого:</td>
    <td class="num">${money(t.net)}</td><td></td><td class="num">${money(t.vat)}</td><td class="num">${money(t.gross)}</td>
  </tr>
</table>

<div class="sums">
  <p style="text-decoration:underline;margin:6px 0 2px">Всего наименований ${t.rows.length}</p>
  <p style="margin:2px 0">Сумма&nbsp; НДС: <b>${суммаПрописью(t.vat)}</b></p>
  <p style="margin:2px 0">Всего отпущено&nbsp; на сумму с НДС: <b>${суммаПрописью(t.gross)}</b></p>
</div>

<div class="sign"><i>Счет выдал</i>___________________________</div>
</body></html>`;
  }

  // ── файл данных для 1С 7.7 ──
  // Кодировка windows-1251: UTF-8 платформа 7.7 не читает — будут кракозябры.
  function вWin1251(str) {
    const карта = { 0x401: 0xA8, 0x451: 0xB8, 0x2116: 0xB9, 0x00AB: 0xAB, 0x00BB: 0xBB, 0x2014: 0x97, 0x2013: 0x96,
                    0x00A0: 0xA0, 0x00B0: 0xB0, 0x2026: 0x85, 0x201C: 0x93, 0x201D: 0x94, 0x00B7: 0xB7, 0x00A9: 0xA9, 0x2019: 0x92 };
    const out = [];
    for (const ch of str) {
      const c = ch.codePointAt(0);
      if (c < 128) out.push(c);
      else if (c >= 0x410 && c <= 0x44F) out.push(c - 0x410 + 0xC0);   // А-я идут подряд и там, и там
      else out.push(карта[c] != null ? карта[c] : 0x3F);
    }
    return new Uint8Array(out);
  }
  function текст1С() {
    const c = клиент() || {}, t = итоги(), ПОСТАВЩИК = поставщик();
    const ч = n => String(r2(n).toFixed(2));                            // числа с точкой — так их читает 1С 7.7
    const L = [];
    L.push('#ФОРМАТ;DIANAST-СЧЕТ;1.0');
    L.push('#ДАТА;' + inv.date.split('-').reverse().join('.'));
    L.push('#СРОК_ДНЕЙ;' + inv.days);
    L.push('#ВАЛЮТА;BYN');
    L.push('#ПОСТАВЩИК;' + ПОСТАВЩИК.name);
    L.push('#ПОСТАВЩИК_УНП;' + ПОСТАВЩИК.unp);
    L.push('#ПЛАТЕЛЬЩИК;' + (c.name || ''));
    L.push('#ПЛАТЕЛЬЩИК_УНП;' + (c.unp || ''));
    L.push('#ПЛАТЕЛЬЩИК_АДРЕС;' + (c.addr || ''));
    L.push('#ПЛАТЕЛЬЩИК_ТЕЛ;' + (c.tel || ''));
    L.push('#ПЛАТЕЛЬЩИК_РС;' + (c.rs || ''));
    L.push('#ПЛАТЕЛЬЩИК_БАНК;' + (c.bank || ''));
    L.push('#ПЛАТЕЛЬЩИК_БИК;' + (c.bic || ''));
    L.push('#ЦЕЛЬ;' + (c.goal || ''));
    L.push('#ДОПОЛНЕНИЕ;' + (c.extra || ''));
    L.push('#СТАВКА_НДС;' + t.rate);
    L.push('#ИТОГО_БЕЗ_НДС;' + ч(t.net));
    L.push('#ИТОГО_НДС;' + ч(t.vat));
    L.push('#ИТОГО_С_НДС;' + ч(t.gross));
    L.push('#ПОЗИЦИЙ;' + t.rows.length);
    L.push('#КОЛОНКИ;N;НАИМЕНОВАНИЕ;ЕД;КОЛИЧЕСТВО;ЦЕНА;СУММА;СТАВКА_НДС;НДС;СУММА_С_НДС;РАЗВЕРТКА_ММ;ТОЛЩИНА_ММ;RAL');
    t.rows.forEach(r => {
      L.push([r.n, r.l.name.replace(/;/g, ','), r.l.unit, ч(r.qty), ч(r.price), ч(r.sum),
              t.rate, ч(r.vat), ч(r.gross), r.l.razv || '', r.l.thickness != null ? ч(r.l.thickness) : '',
              r.l.ral || ''].join(';'));
    });
    return L.join('\r\n') + '\r\n';
  }
  function скачать(name, blob) {
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  function имяФайла() {
    const c = клиент() || {};
    const имя = (c.name || 'клиент').replace(/["«»]/g, '').replace(/\s+/g, ' ').trim();
    return `${inv.date} ${имя} — заявка на счёт`;
  }

  // ── публичный вход ──
  // открыть({ позиции, источник, ключЧерновика, тариф })
  //   позиции      — массив позиций (см. нормализовать)
  //   источник     — функция, возвращающая позиции заново (кнопка «Пересобрать»)
  //   ключЧерновика— ключ localStorage для черновика заявки
  //   тариф        — true: цена = развёртка × тариф (доборные); false: цены готовые (отливы)
  function открыть(о) {
    о = о || {};
    ОПЦ = { источник: о.источник || null, ключЧерновика: о.ключЧерновика || 'dianast_invoice_v1', тариф: !!о.тариф };
    const позиции = о.позиции || (ОПЦ.источник ? ОПЦ.источник() : []);
    if (!позиции.length) { alert('Сначала посчитайте заказ — позиций нет.'); return; }
    монтировать();

    let saved = null; try { saved = JSON.parse(localStorage.getItem(ОПЦ.ключЧерновика) || 'null'); } catch (e) {}
    const sig = сигнатура(позиции);
    if (saved && saved.sig === sig && Array.isArray(saved.lines) && saved.lines.length) {
      inv = saved;                                   // расчёт не менялся — возвращаем правки
      if (о.клиентId && inv.clientId !== о.клиентId && clients.some(c => c.id === о.клиентId)) {
        inv.clientId = о.клиентId; применитьКлиента();   // в калькуляторе выбрали другого клиента
      }
    } else {
      const c = (о.клиентId && clients.find(x => x.id === о.клиентId)) || clients[0] || null;
      const d = new Date();
      const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      inv = { clientId: c ? c.id : '', date: iso, days: 5,
              tariff: c ? c.tariff : ДЕФОЛТ.tariff, gap: c && c.gap != null ? c.gap : ДЕФОЛТ.gap,
              minp: c && c.minp != null ? c.minp : ДЕФОЛТ.minp,
              markup: c ? (c.markup || 0) : 0, vat: c && c.vat != null ? c.vat : ДЕФОЛТ.vat,
              agent: c ? (c.agent || '') : '', fee: c ? (c.fee || 0) : 0,
              orgId: (фирма() || {}).id || '',
              fullNames: false, lines: [], sig };
      inv.lines = нормализовать(позиции);            // имена зависят от inv.fullNames — только после создания inv
    }
    рисоватьВсё(); сохранить();
    const п = поставщик();
    if (!п.unp || !п.name) {                    // без реквизитов бланк уйдёт с пустой шапкой
      const s = document.querySelector('.zb-sub');
      if (s) s.innerHTML = '<b style="color:#C1440E">Реквизиты компании не заполнены</b> — в бланке будет пустая шапка. ' +
        'Заполните их один раз на главной приложения: «⚙ Настройки».';
    }
    $('zb-overlay').classList.add('show');
  }
  function закрыть() { const o = $('zb-overlay'); if (o) o.classList.remove('show'); }

  return { открыть, закрыть, клиенты: () => clients, добавитьКлиента, обновитьКлиента, поставщик, суммаПрописью };
})();

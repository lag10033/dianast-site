// ============================================================
//  НАСТРОЙКИ — прайс и реквизиты компании
//
//  Всё, что нельзя держать в коде опубликованного приложения:
//  цены за квадрат, минималка, коэффициенты и реквизиты для счетов.
//  Хранится в памяти браузера, переносится файлом (данные.js).
//
//  Подключается на главной:  <script src="настройки.js"></script>
//  Открывается кнопкой:      Настройки.открыть()
// ============================================================

const Настройки = (function () {
  const КЛЮЧ_П = 'dianast_price_v1', КЛЮЧ_Р = 'dianast_requisites_v1';
  let смонтировано = false;
  const $ = id => document.getElementById(id);
  const чит = (k, d) => { try { return JSON.parse(localStorage.getItem(k) || 'null') || d; } catch (e) { return d; } };

  const CSS = `
  #ns-overlay{ display:none; position:fixed; inset:0; z-index:200; background:rgba(20,15,10,.55); overflow:auto; padding:24px 12px;
               font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1A1A1A; line-height:1.5; }
  #ns-overlay.show{ display:block; }
  #ns-overlay *{ box-sizing:border-box; }
  #ns-box{ max-width:860px; margin:0 auto; background:#fff; border-radius:16px; padding:20px; position:relative; }
  #ns-box h2{ font-size:18px; font-weight:800; margin:0 0 2px; }
  #ns-box button{ cursor:pointer; font-family:inherit; }
  .ns-sub{ font-size:12.5px; color:#4a4a4a; margin-bottom:14px; }
  .ns-x{ position:absolute; top:14px; right:14px; border:none; background:none; font-size:24px; line-height:1; color:#b5aca0; padding:0; }
  .ns-x:hover{ color:#C1440E; }
  .ns-warn{ font-size:12.5px; background:#fdf6df; border:1px solid #ead9a0; border-radius:9px; padding:10px 12px; margin-bottom:14px; line-height:1.45; color:#7a5c00; }
  .ns-tabs{ display:flex; gap:8px; margin-bottom:14px; }
  .ns-tab{ border:1.5px solid #E2DCD3; background:#fff; color:#4a4a4a; border-radius:999px; font-size:13px; font-weight:800; padding:8px 15px; }
  .ns-tab.on{ background:#D4521E; border-color:#D4521E; color:#fff; }
  .ns-pane{ display:none; } .ns-pane.on{ display:block; }
  .ns-sec{ border:1px solid #E2DCD3; border-radius:12px; padding:12px 13px; margin-bottom:12px; }
  .ns-sec h3{ font-size:11px; font-weight:800; text-transform:uppercase; letter-spacing:.06em; color:#4a4a4a; margin:0 0 9px; }
  .ns-row{ display:flex; flex-wrap:wrap; gap:9px; align-items:flex-end; margin-bottom:9px; }
  .ns-f{ display:flex; flex-direction:column; gap:3px; }
  .ns-f label{ font-size:11px; font-weight:700; color:#4a4a4a; }
  .ns-f input{ font-size:14.5px; padding:8px 10px; border:1.5px solid #E2DCD3; border-radius:9px; font-family:inherit; background:#fff; color:#1A1A1A; }
  .ns-f input:focus-visible{ outline:none; border-color:#D4521E; }
  .ns-f.grow{ flex:1; min-width:200px; } .ns-f.grow input{ width:100%; }
  .ns-f .num{ width:110px; text-align:right; }
  .ns-color{ display:flex; gap:8px; align-items:flex-end; margin-bottom:7px; }
  .ns-color .nm{ flex:1; min-width:150px; }
  .ns-hint{ font-size:11.5px; color:#9a938a; line-height:1.4; margin-top:6px; }
  .ns-actions{ display:flex; flex-wrap:wrap; gap:9px; margin-top:14px; }
  .ns-btn{ border:none; border-radius:11px; background:#D4521E; color:#fff; font-size:14px; font-weight:800; padding:13px 18px; flex:1; min-width:160px; }
  .ns-btn:hover{ background:#C1440E; }
  .ns-btn.ghost{ background:#fff; color:#1A1A1A; border:1.5px solid #E2DCD3; flex:0 0 auto; }
  .ns-btn.ghost:hover{ border-color:#D4521E; color:#D4521E; }`;

  const HTML = `
  <div id="ns-box">
    <button class="ns-x" id="ns-x" type="button" title="Закрыть">&times;</button>
    <h2>Настройки</h2>
    <div class="ns-sub">Прайс и реквизиты хранятся только на этом устройстве и в коде приложения не лежат.</div>
    <div class="ns-warn" id="ns-warn"></div>
    <div class="ns-tabs">
      <button class="ns-tab on" data-pane="price" type="button">Прайс</button>
      <button class="ns-tab" data-pane="req" type="button">Реквизиты</button>
    </div>

    <div class="ns-pane on" id="ns-pane-price">
      <div class="ns-sec">
        <h3>Цена за м² без НДС</h3>
        <div id="ns-colors"></div>
        <div class="ns-hint">«Обычное» — отлив и плоский лист, «сложное» — наличники, жалюзи и прочие малые элементы.</div>
      </div>
      <div class="ns-sec">
        <h3>Параметры расчёта</h3>
        <div class="ns-row">
          <div class="ns-f"><label>Минималка, руб</label><input id="ns-min" class="num" type="number" step="0.01" inputmode="decimal"></div>
          <div class="ns-f"><label>Коэф. до 1500 мм</label><input id="ns-k15" class="num" type="number" step="0.01" inputmode="decimal"></div>
          <div class="ns-f"><label>НДС, %</label><input id="ns-vat" class="num" type="number" step="1" inputmode="numeric"></div>
          <div class="ns-f"><label>Наценка ко всему, %</label><input id="ns-mark" class="num" type="number" step="1" inputmode="numeric"></div>
        </div>
        <div class="ns-row">
          <div class="ns-f"><label>Макс. заготовка, м</label><input id="ns-maxlen" class="num" type="number" step="0.01" inputmode="decimal"></div>
          <div class="ns-f"><label>Макс. ширина, мм</label><input id="ns-maxw" class="num" type="number" step="10" inputmode="numeric"></div>
          <div class="ns-f"><label>Заготовка по умолч., м</label><input id="ns-deflen" class="num" type="number" step="0.05" inputmode="decimal"></div>
          <div class="ns-f"><label>Нахлёст, м</label><input id="ns-lap" class="num" type="number" step="0.005" inputmode="decimal"></div>
        </div>
      </div>
    </div>

    <div class="ns-pane" id="ns-pane-req">
      <div class="ns-sec">
        <h3>Компания — как в счетах и КП</h3>
        <div class="ns-row">
          <div class="ns-f grow"><label>Полное наименование</label><input id="ns-full" placeholder="Частное предприятие «Ромашка»"></div>
          <div class="ns-f grow"><label>Кратко</label><input id="ns-short" placeholder="ЧПТУП «Ромашка»"></div>
        </div>
        <div class="ns-row">
          <div class="ns-f grow"><label>Юридический адрес</label><input id="ns-addr" placeholder="225306, г. Кобрин, ул. ..."></div>
          <div class="ns-f grow"><label>Почтовый адрес</label><input id="ns-post" placeholder="если отличается"></div>
        </div>
        <div class="ns-row">
          <div class="ns-f"><label>УНП</label><input id="ns-unp" class="num" inputmode="numeric"></div>
          <div class="ns-f"><label>ОКПО</label><input id="ns-okpo" class="num" inputmode="numeric"></div>
          <div class="ns-f grow"><label>Телефон / факс</label><input id="ns-tel"></div>
          <div class="ns-f grow"><label>Мобильный</label><input id="ns-mob" placeholder="+375 29 ..."></div>
        </div>
        <div class="ns-row">
          <div class="ns-f grow"><label>Почта</label><input id="ns-mail" type="email"></div>
          <div class="ns-f grow"><label>Почта для заказов</label><input id="ns-mail2" type="email"></div>
        </div>
      </div>
      <div class="ns-sec">
        <h3>Банк</h3>
        <div class="ns-row">
          <div class="ns-f grow"><label>Расчётный счёт (IBAN)</label><input id="ns-iban" placeholder="BY.."></div>
          <div class="ns-f"><label>Код банка (BIC)</label><input id="ns-bic"></div>
        </div>
        <div class="ns-row">
          <div class="ns-f grow"><label>Банк</label><input id="ns-bank" placeholder="ОАО «АСБ Беларусбанк», г. ..."></div>
        </div>
      </div>
      <div class="ns-sec">
        <h3>Подписант</h3>
        <div class="ns-row">
          <div class="ns-f grow"><label>Директор</label><input id="ns-dir" placeholder="Иванов Иван Иванович"></div>
          <div class="ns-f"><label>Коротко</label><input id="ns-dir2" placeholder="Иванов И.И."></div>
          <div class="ns-f"><label>Действует на основании</label><input id="ns-osn" placeholder="Устава"></div>
        </div>
      </div>
    </div>

    <div class="ns-actions">
      <button class="ns-btn" id="ns-save" type="button">Сохранить</button>
      <button class="ns-btn ghost" id="ns-load" type="button">📂 Загрузить из файла</button>
      <button class="ns-btn ghost" id="ns-reset" type="button">Сбросить к демо</button>
      <input type="file" id="ns-file" accept="application/json,.json" hidden>
    </div>
    <div class="ns-hint">Есть файл с данными (прайс, реквизиты, клиенты)? Загрузите — заполнится всё разом,
      вручную вбивать не придётся. Такой же файл делает кнопка «Сохранить в файл» на главной.</div>
  </div>`;

  function монтировать() {
    if (смонтировано) return;
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const ov = document.createElement('div'); ov.id = 'ns-overlay'; ov.innerHTML = HTML; document.body.appendChild(ov);
    смонтировано = true;
    $('ns-x').onclick = закрыть;
    ov.onclick = e => { if (e.target === ov) закрыть(); };
    ov.querySelectorAll('.ns-tab').forEach(t => t.onclick = () => {
      ov.querySelectorAll('.ns-tab').forEach(x => x.classList.toggle('on', x === t));
      ov.querySelectorAll('.ns-pane').forEach(p => p.classList.toggle('on', p.id === 'ns-pane-' + t.dataset.pane));
    });
    $('ns-save').onclick = сохранить;
    $('ns-load').onclick = () => {
      if (typeof ДанныеУстройства === 'undefined') {          // модуль данные.js подключён только на главной
        alert('Загрузка файла доступна на главной странице приложения.'); return;
      }
      $('ns-file').click();
    };
    $('ns-file').onchange = (e) => {
      const f = e.target.files[0]; if (!f) return;
      ДанныеУстройства.импорт(f, (n) => {
        alert('Загружено записей: ' + n + '. Страница обновится.');
        location.reload();
      });
      e.target.value = '';
    };
    $('ns-reset').onclick = () => {
      if (!confirm('Убрать свой прайс и реквизиты с этого устройства и вернуть демо-значения?')) return;
      localStorage.removeItem(КЛЮЧ_П); localStorage.removeItem(КЛЮЧ_Р);
      alert('Готово. Страница обновится.'); location.reload();
    };
  }

  function рисоватьЦвета(п) {
    const box = $('ns-colors');
    box.innerHTML = (п.цвета || []).map((c, i) => c.ручной
      ? `<div class="ns-color"><div class="ns-f grow nm"><label>${i === 0 ? 'Цвет' : ''}</label>
           <input value="${(c.название || '').replace(/"/g, '&quot;')}" data-c="${i}" data-f="название"></div>
         <div class="ns-hint" style="flex:1;margin:0 0 10px">цена вводится вручную при расчёте</div></div>`
      : `<div class="ns-color">
           <div class="ns-f grow nm"><label>${i === 0 ? 'Цвет' : ''}</label>
             <input value="${(c.название || '').replace(/"/g, '&quot;')}" data-c="${i}" data-f="название"></div>
           <div class="ns-f"><label>${i === 0 ? 'Обычное' : ''}</label>
             <input class="num" type="number" step="0.01" inputmode="decimal" value="${c.обычное ?? ''}" data-c="${i}" data-f="обычное"></div>
           <div class="ns-f"><label>${i === 0 ? 'Сложное' : ''}</label>
             <input class="num" type="number" step="0.01" inputmode="decimal" value="${c.сложное ?? ''}" data-c="${i}" data-f="сложное"></div>
         </div>`).join('');
  }

  function заполнить() {
    const п = чит(КЛЮЧ_П, ДЕМО_ЦЕНЫ), р = чит(КЛЮЧ_Р, ДЕМО_РЕКВИЗИТЫ);
    рисоватьЦвета(п);
    const v = (id, val) => { const e = $(id); if (e) e.value = val == null ? '' : val; };
    v('ns-min', п.минималка); v('ns-k15', п.коэф_до_1500); v('ns-vat', п.ндс_процент); v('ns-mark', п.наценка_процент || 0);
    v('ns-maxlen', п.макс_заготовка_м); v('ns-maxw', п.макс_ширина_мм);
    v('ns-deflen', п.заготовка_по_умолчанию_м); v('ns-lap', п.нахлёст_м);
    v('ns-full', р.полное); v('ns-short', р.краткое); v('ns-addr', р.юрАдрес); v('ns-post', р.почтАдрес);
    v('ns-unp', р.унп); v('ns-okpo', р.окпо); v('ns-tel', р.телФакс); v('ns-mob', р.моб);
    v('ns-mail', р.email); v('ns-mail2', р.заказыEmail);
    v('ns-iban', р.iban); v('ns-bic', р.bic); v('ns-bank', р.банк);
    v('ns-dir', р.директор); v('ns-dir2', р.директорКоротко); v('ns-osn', р.основание);

    const демоПрайс = !localStorage.getItem(КЛЮЧ_П), демоРекв = !localStorage.getItem(КЛЮЧ_Р);
    const w = $('ns-warn');
    if (демоПрайс || демоРекв) {
      w.style.display = '';
      w.textContent = демоПрайс && демоРекв
        ? 'Сейчас стоят демо-цены и пустые реквизиты. Впишите свои — иначе сметы и счета уйдут клиенту с чужими цифрами.'
        : (демоПрайс ? 'Прайс демонстрационный — цены не ваши. Замените своими.'
                     : 'Реквизиты не заполнены — в счетах и КП будут пустые поля.');
    } else { w.style.display = 'none'; }
  }

  function сохранить() {
    const п = Object.assign({}, чит(КЛЮЧ_П, ДЕМО_ЦЕНЫ));
    п.цвета = (п.цвета || []).map(c => Object.assign({}, c));
    document.querySelectorAll('#ns-colors [data-c]').forEach(inp => {
      const c = п.цвета[+inp.dataset.c]; if (!c) return;
      const f = inp.dataset.f;
      c[f] = f === 'название' ? inp.value.trim() : (parseFloat(inp.value) || 0);
    });
    const ч = id => parseFloat($(id).value) || 0;
    п.минималка = ч('ns-min'); п.коэф_до_1500 = ч('ns-k15') || 1; п.ндс_процент = ч('ns-vat');
    п.наценка_процент = ч('ns-mark'); п.макс_заготовка_м = ч('ns-maxlen'); п.макс_ширина_мм = ч('ns-maxw');
    п.заготовка_по_умолчанию_м = ч('ns-deflen'); п.нахлёст_м = ч('ns-lap');
    delete п.демо;

    const т = id => $(id).value.trim();
    const р = { полное: т('ns-full'), краткое: т('ns-short'), юрАдрес: т('ns-addr'), почтАдрес: т('ns-post'),
                унп: т('ns-unp'), окпо: т('ns-okpo'), телФакс: т('ns-tel'), моб: т('ns-mob'),
                email: т('ns-mail'), заказыEmail: т('ns-mail2'), iban: т('ns-iban'), bic: т('ns-bic'),
                банк: т('ns-bank'), директор: т('ns-dir'), директорКоротко: т('ns-dir2'), основание: т('ns-osn') };
    try {
      localStorage.setItem(КЛЮЧ_П, JSON.stringify(п));
      localStorage.setItem(КЛЮЧ_Р, JSON.stringify(р));
    } catch (e) { alert('Не удалось сохранить: ' + e.message); return; }
    const b = $('ns-save'), t = b.textContent; b.textContent = 'Сохранено ✓';
    setTimeout(() => { b.textContent = t; location.reload(); }, 900);   // перечитать цены во всех расчётах
  }

  function открыть() { монтировать(); заполнить(); $('ns-overlay').classList.add('show'); }
  function закрыть() { const o = $('ns-overlay'); if (o) o.classList.remove('show'); }
  function настроено() { return !!(localStorage.getItem(КЛЮЧ_П) && localStorage.getItem(КЛЮЧ_Р)); }

  return { открыть, закрыть, настроено };
})();

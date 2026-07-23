// ============================================================
//  ОБЛАКО — вход по почте и синхронизация между устройствами
//
//  Подключается ПЕРВЫМ на каждой странице приложения:
//     <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//     <script src="облако.js"></script>
//
//  Главный принцип — local-first: данные живут в памяти браузера
//  и работают без сети. Облако лишь зеркалит их между устройствами.
//  Пропала связь в цеху — расчёты продолжаются, изменения уйдут потом.
// ============================================================

const Облако = (function () {
  const URL_ = 'https://rsqrrkiymdtrmmjkmxwl.supabase.co';
  // Публичный ключ: он и должен лежать в коде страницы. Доступ к данным
  // закрывает не он, а правила на уровне базы — чужое пространство не отдаётся.
  const KEY_ = 'sb_publishable_O7tsvwruO3nAM6KiI7pR5Q_Aa1nIAGA';

  const МЕТА = 'dianast_sync_meta';                 // когда что синхронизировали
  const WS_KEY = 'dianast_workspace';               // id своего пространства
  const ПОЛЬЗ = 'dianast_last_user';                // кто входил на этом устройстве
  const СЛУЖЕБНЫЕ = [МЕТА, WS_KEY, ПОЛЬЗ, 'dianast_app_session_v2'];
  const своиДанные = k => k && k.startsWith('dianast_') && СЛУЖЕБНЫЕ.indexOf(k) === -1;

  let sb = null, сессия = null, ws = null, статусЭл = null;
  let таймерPush = null, грязные = new Set(), занят = false;

  const мета = () => { try { return JSON.parse(localStorage.getItem(МЕТА) || '{}'); } catch (e) { return {}; } };
  const сохрМета = m => { try { localStorage.setItem(МЕТА, JSON.stringify(m)); } catch (e) {} };

  // ── статус в углу экрана ──
  function статус(текст, вид) {
    if (!статусЭл) return;
    статусЭл.textContent = текст;
    статусЭл.className = 'obl-chip' + (вид ? ' ' + вид : '');
  }
  function монтироватьСтатус() {
    const st = document.createElement('style');
    st.textContent = `
      .obl-chip{ position:fixed; left:12px; bottom:12px; z-index:150; background:#fff; border:1.5px solid #E2DCD3;
                 border-radius:999px; font:600 12px/1 -apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#4a4a4a;
                 padding:8px 13px; box-shadow:0 2px 10px rgba(0,0,0,.06); cursor:pointer; }
      .obl-chip.ok{ color:#2e7d32; border-color:#cfe6d0; }
      .obl-chip.err{ color:#C1440E; border-color:#f0c8ae; }
      .obl-chip.wait{ color:#7a5c00; border-color:#ead9a0; }
      @media print{ .obl-chip{ display:none; } }`;
    document.head.appendChild(st);
    статусЭл = document.createElement('div');
    статусЭл.className = 'obl-chip';
    статусЭл.textContent = '⟳ подключаюсь…';
    статусЭл.title = 'Нажмите, чтобы синхронизировать сейчас';
    статусЭл.onclick = () => синхронизировать(true);
    document.body.appendChild(статусЭл);
  }

  // ── экран входа ──
  function показатьВход(ошибка) {
    if (document.getElementById('obl-gate')) {
      if (ошибка) document.getElementById('obl-err').textContent = ошибка;
      return;
    }
    const st = document.createElement('style');
    st.textContent = `
      #obl-gate{ position:fixed; inset:0; z-index:9999; background:#F7F5F2; display:flex; align-items:center; justify-content:center;
                 padding:24px 16px; font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1A1A1A; }
      #obl-box{ width:100%; max-width:340px; background:#fff; border:1px solid #E2DCD3; border-radius:16px; padding:24px 22px; }
      #obl-box .bn{ font-size:23px; font-weight:900; letter-spacing:2px; color:#C1440E; text-align:center; }
      #obl-box .bn i{ color:#2B2B2B; font-style:normal; }
      #obl-box .bs{ font-size:9px; color:#4a4a4a; letter-spacing:.4px; margin:3px 0 18px; text-align:center; }
      #obl-box h2{ font-size:16px; font-weight:800; margin-bottom:4px; text-align:center; }
      #obl-box p{ font-size:12.5px; color:#4a4a4a; margin-bottom:16px; line-height:1.45; text-align:center; }
      #obl-box label{ display:block; font-size:11px; font-weight:700; color:#4a4a4a; margin:0 0 4px; }
      #obl-box input{ width:100%; font-size:16px; padding:11px 12px; border:1.5px solid #E2DCD3; border-radius:10px;
                      font-family:inherit; margin-bottom:11px; background:#fff; color:#1A1A1A; }
      #obl-box input:focus-visible{ outline:none; border-color:#D4521E; }
      #obl-go{ width:100%; border:none; border-radius:11px; background:#D4521E; color:#fff; font-size:15px; font-weight:800;
               padding:13px; font-family:inherit; cursor:pointer; }
      #obl-go:hover{ background:#C1440E; }
      #obl-err{ font-size:12.5px; font-weight:700; color:#b3261e; margin-top:10px; min-height:17px; text-align:center; }`;
    document.head.appendChild(st);
    const g = document.createElement('div');
    g.id = 'obl-gate';
    g.innerHTML = `<div id="obl-box">
      <div class="bn">DI<i>A</i>NAST</div>
      <div class="bs">ОТЛИВЫ ОТ ПРОИЗВОДИТЕЛЯ И НЕ ТОЛЬКО!</div>
      <h2>Вход</h2>
      <p>Та же почта и пароль, что в CRM. Устройство запомнит вход.</p>
      <label for="obl-mail">Почта</label>
      <input id="obl-mail" type="email" autocomplete="username" placeholder="mail@example.com">
      <label for="obl-pass">Пароль</label>
      <input id="obl-pass" type="password" autocomplete="current-password" placeholder="••••••••">
      <button id="obl-go" type="button">Войти</button>
      <div id="obl-err">${ошибка || ''}</div>
    </div>`;
    document.body.appendChild(g);
    document.body.style.overflow = 'hidden';

    const войти = async () => {
      const email = document.getElementById('obl-mail').value.trim();
      const pass = document.getElementById('obl-pass').value;
      const err = document.getElementById('obl-err');
      if (!email || !pass) { err.textContent = 'Заполните почту и пароль'; return; }
      err.textContent = 'Проверяю…';
      const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) { err.textContent = переводОшибки(error.message); return; }
      сессия = data.session;
      закрытьВход();
      await послеВхода();
    };
    document.getElementById('obl-go').onclick = войти;
    g.querySelectorAll('input').forEach(i => i.onkeydown = e => { if (e.key === 'Enter') войти(); });
    setTimeout(() => document.getElementById('obl-mail').focus(), 100);
  }
  function закрытьВход() {
    const g = document.getElementById('obl-gate');
    if (g) g.remove();
    document.body.style.overflow = '';
  }
  const переводОшибки = m => /invalid login/i.test(m) ? 'Неверная почта или пароль'
    : /network|fetch/i.test(m) ? 'Нет связи с сервером'
    : /email not confirmed/i.test(m) ? 'Почта не подтверждена'
    : m;

  // ── синхронизация ──
  async function найтиПространство() {
    const сохр = localStorage.getItem(WS_KEY);
    if (сохр) { ws = сохр; return ws; }
    const { data, error } = await sb.from('workspace_members').select('workspace_id').limit(1);
    if (error) throw error;
    if (!data || !data.length) throw new Error('Вас ещё не добавили в рабочее пространство');
    ws = data[0].workspace_id;
    try { localStorage.setItem(WS_KEY, ws); } catch (e) {}
    return ws;
  }

  async function pull() {
    const { data, error } = await sb.from('workspace_data').select('key,value,updated_at').eq('workspace_id', ws);
    if (error) throw error;
    const m = мета();
    let применено = 0;
    (data || []).forEach(строка => {
      if (!своиДанные(строка.key)) return;
      const мой = m[строка.key];
      // своё несохранённое не затираем — оно уедет в облако при отправке
      if (мой && мой.dirty) return;
      if (мой && мой.t && new Date(мой.t) >= new Date(строка.updated_at)) return;
      try {
        localStorage.setItem(строка.key, typeof строка.value === 'string' ? строка.value : JSON.stringify(строка.value));
        m[строка.key] = { t: строка.updated_at, dirty: false };
        применено++;
      } catch (e) {}
    });
    сохрМета(m);
    return применено;
  }

  async function push() {
    const m = мета();
    // при первом запуске облако пустое — отправляем всё, что есть на устройстве
    const ключи = грязные.size ? [...грязные]
                               : Object.keys(localStorage).filter(своиДанные).filter(k => !m[k]);
    if (!ключи.length) return 0;
    const строки = [];
    ключи.forEach(k => {
      const сырое = localStorage.getItem(k);
      if (сырое == null) return;
      let знач; try { знач = JSON.parse(сырое); } catch (e) { знач = сырое; }
      строки.push({ workspace_id: ws, key: k, value: знач, updated_at: new Date().toISOString(),
                    updated_by: сессия && сессия.user ? сессия.user.id : null });
    });
    if (!строки.length) return 0;
    const { data, error } = await sb.from('workspace_data')
      .upsert(строки, { onConflict: 'workspace_id,key' }).select('key,updated_at');
    if (error) throw error;
    (data || []).forEach(р => { m[р.key] = { t: р.updated_at, dirty: false }; грязные.delete(р.key); });
    сохрМета(m);
    return строки.length;
  }

  async function синхронизировать(вручную) {
    if (!sb || !сессия || занят) return;
    if (!navigator.onLine) { статус('⚠ нет сети — работаем локально', 'wait'); return; }
    занят = true;
    статус('⟳ синхронизация…', 'wait');
    try {
      if (!ws) await найтиПространство();
      const отправлено = await push();
      const принято = await pull();
      статус('☁ синхронизировано', 'ok');
      if (принято && !вручную) {
        // данные пришли с другого устройства — показываем актуальные цифры
        setTimeout(() => location.reload(), 400);
      }
    } catch (e) {
      const текст = String(e.message || e);
      // PostgREST на отсутствующую таблицу отвечает по-английски и длинно —
      // человеку нужно понятное действие, а не текст ошибки
      const нетТаблиц = /relation|does not exist|could not find the table|schema cache/i.test(текст);
      const неДобавлен = /рабочее пространство/i.test(текст);
      статус(нетТаблиц ? '⚠ база не готова — запустите схему в Supabase'
           : неДобавлен ? '⚠ вас не добавили в пространство'
           : '⚠ ' + текст.slice(0, 40), 'err');
      console.warn('[облако]', e);
    }
    занят = false;
  }

  // ── ловим изменения данных: модулям про облако знать не нужно ──
  function перехватитьЗапись() {
    const оригинал = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      оригинал(k, v);
      if (!своиДанные(k)) return;
      const m = мета(); m[k] = { t: (m[k] && m[k].t) || null, dirty: true }; сохрМета(m);
      грязные.add(k);
      clearTimeout(таймерPush);
      таймерPush = setTimeout(() => синхронизировать(true), 2000);   // копим правки, потом отправляем разом
    };
  }

  // Если на устройстве до этого работал ДРУГОЙ человек — его данные здесь
  // чужие: не показываем их и, главное, не даём push() отправить их
  // в новое пространство. Прайс одного цеха не должен утечь другому.
  function проверитьСменуПользователя() {
    const был = localStorage.getItem(ПОЛЬЗ);
    const стал = сессия && сессия.user ? сессия.user.id : null;
    if (!стал) return;
    if (был && был !== стал) {
      Object.keys(localStorage).filter(своиДанные).forEach(k => localStorage.removeItem(k));
      localStorage.removeItem(МЕТА);
      localStorage.removeItem(WS_KEY);
      грязные.clear();
    }
    try { localStorage.setItem(ПОЛЬЗ, стал); } catch (e) {}
  }

  async function послеВхода() {
    проверитьСменуПользователя();
    монтироватьСтатус();
    статусЭл.title = (сессия.user && сессия.user.email ? сессия.user.email + ' · ' : '') + 'нажмите, чтобы синхронизировать';
    перехватитьЗапись();
    // стартовая синхронизация — не «ручная»: если из облака пришли данные,
    // страница перезагрузится и сразу покажет их (важно при первом входе)
    await синхронизировать(false);
    window.addEventListener('online', () => синхронизировать(true));
    document.addEventListener('visibilitychange', () => { if (!document.hidden) синхронизировать(true); });
  }

  async function старт() {
    if (typeof window.supabase === 'undefined') {          // нет сети при первой загрузке
      монтироватьСтатус(); статус('⚠ облако недоступно — работаем локально', 'wait'); return;
    }
    sb = window.supabase.createClient(URL_, KEY_);
    const { data } = await sb.auth.getSession();           // сессия хранится локально: офлайн вход работает
    сессия = data ? data.session : null;
    if (!сессия) {
      // Без сети войти всё равно нельзя, а перекрывать расчёт экраном входа —
      // значит оставить мастера на объекте без калькулятора. Работаем локально.
      if (!navigator.onLine) { монтироватьСтатус(); статус('⚠ нет сети — работаем локально', 'wait'); return; }
      показатьВход(); return;
    }
    await послеВхода();
  }

  function выйти() {
    if (sb) sb.auth.signOut();
    try { localStorage.removeItem(WS_KEY); localStorage.removeItem(МЕТА); } catch (e) {}
    location.reload();
  }

  if (document.body) старт(); else document.addEventListener('DOMContentLoaded', старт);
  return { синхронизировать, выйти, статус: () => (статусЭл ? статусЭл.textContent : '') };
})();

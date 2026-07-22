// ============================================================
//  ВХОД В ПРИЛОЖЕНИЕ — код доступа на все страницы DIANAST-app
//
//  Подключается первым скриптом на каждой странице:
//     <script src="вход.js"></script>          (главная)
//     <script src="../../вход.js"></script>    (инструменты)
//
//  Код вводится один раз на устройстве и запоминается.
//  ЧЕСТНО О ЗАЩИТЕ: это не шифрование. Код лежит в коде страницы
//  (в виде хеша) — человек, понимающий в вебе, его обойдёт.
//  Задача — закрыть от случайных посетителей сайта, не более.
//  Реквизиты клиентов и цены в коде НЕ хранятся: они живут
//  только в памяти браузера на вашем устройстве.
//
//  КАК ПОМЕНЯТЬ КОД: посчитайте хеш нового кода и впишите в КОД_ХЕШ.
//  Хеш можно получить в консоли браузера: ХешКода('1234')
// ============================================================

(function () {
  const KEY = 'dianast_app_session_v2';
  const КОД_ХЕШ = 2085963234;              // текущий код доступа

  // простой хеш (djb2): работает и по https, и с локального файла
  function хеш(s) {
    let h = 5381;
    for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0;
    return h;
  }
  window.ХешКода = хеш;                    // чтобы посчитать хеш нового кода из консоли

  function впущен() { try { return localStorage.getItem(KEY) === String(КОД_ХЕШ); } catch (e) { return false; } }
  window.ВыйтиИзПриложения = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    location.reload();
  };
  if (впущен()) return;

  const CSS = `
  #vh-gate{ position:fixed; inset:0; z-index:9999; background:#F7F5F2; display:flex; align-items:center; justify-content:center;
            padding:24px 16px; font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif; color:#1A1A1A; }
  #vh-box{ width:100%; max-width:340px; background:#fff; border:1px solid #E2DCD3; border-radius:16px; padding:24px 22px; text-align:center; }
  #vh-box .bn{ font-size:23px; font-weight:900; letter-spacing:2px; color:#C1440E; }
  #vh-box .bn i{ color:#2B2B2B; font-style:normal; }
  #vh-box .bs{ font-size:9px; color:#4a4a4a; letter-spacing:.4px; margin:3px 0 18px; }
  #vh-box h2{ font-size:16px; font-weight:800; margin-bottom:4px; }
  #vh-box p{ font-size:12.5px; color:#4a4a4a; margin-bottom:16px; line-height:1.45; }
  #vh-pin{ width:100%; font-size:26px; font-weight:800; letter-spacing:.32em; text-align:center; padding:12px 10px;
           border:1.5px solid #E2DCD3; border-radius:11px; font-family:inherit; background:#fff; color:#1A1A1A; }
  #vh-pin:focus-visible{ outline:none; border-color:#D4521E; }
  #vh-go{ width:100%; margin-top:12px; border:none; border-radius:11px; background:#D4521E; color:#fff;
          font-size:15px; font-weight:800; padding:13px; font-family:inherit; cursor:pointer; }
  #vh-go:hover{ background:#C1440E; }
  #vh-err{ font-size:12.5px; font-weight:700; color:#b3261e; margin-top:10px; min-height:17px; }`;

  function показать() {
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    const g = document.createElement('div');
    g.id = 'vh-gate';
    g.innerHTML = `<div id="vh-box">
      <div class="bn">DI<i>A</i>NAST</div>
      <div class="bs">ОТЛИВЫ ОТ ПРОИЗВОДИТЕЛЯ И НЕ ТОЛЬКО!</div>
      <h2>Код доступа</h2>
      <p>Рабочее место жестянщика. Код вводится один раз — устройство запомнит.</p>
      <input id="vh-pin" type="tel" inputmode="numeric" maxlength="8" autocomplete="off" placeholder="••••">
      <button id="vh-go" type="button">Войти</button>
      <div id="vh-err"></div>
    </div>`;
    document.body.appendChild(g);
    document.body.style.overflow = 'hidden';

    const inp = g.querySelector('#vh-pin'), err = g.querySelector('#vh-err');
    const проверить = () => {
      if (хеш(inp.value.trim()) === КОД_ХЕШ) {
        try { localStorage.setItem(KEY, String(КОД_ХЕШ)); } catch (e) {}
        document.body.style.overflow = '';
        g.remove();
        return;
      }
      err.textContent = 'Неверный код';
      inp.value = ''; inp.focus();
    };
    g.querySelector('#vh-go').onclick = проверить;
    inp.onkeydown = e => { if (e.key === 'Enter') проверить(); };
    inp.oninput = () => { err.textContent = ''; };
    setTimeout(() => inp.focus(), 100);
  }

  if (document.body) показать();
  else document.addEventListener('DOMContentLoaded', показать);
})();

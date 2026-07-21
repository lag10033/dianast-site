// Чат-бот строителя Dianast: пузырь слева внизу + окно чата.
// Мозг на сервере CRM (/api/bot) — здесь только интерфейс.
// Память диалога в localStorage; цели Метрики chat_open / chat_lead.
(function(){
  var API = 'https://dianast-crm.vercel.app/api/bot';
  var LS = 'dianast_chat_v1';
  var HINT_LS = 'dianast_chat_hint';
  var history = [];
  try { history = JSON.parse(localStorage.getItem(LS) || '[]'); } catch(e){}

  var css = document.createElement('style');
  css.textContent =
    '.dch-bubble{position:fixed;left:28px;bottom:28px;z-index:998;width:60px;height:60px;border-radius:50%;background:#E8600A;box-shadow:0 4px 20px rgba(232,96,10,.45);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:all .2s}' +
    '.dch-bubble:hover{transform:scale(1.1)}' +
    '.dch-bubble svg{width:30px;height:30px;fill:#fff}' +
    '.dch-hint{position:fixed;left:96px;bottom:38px;z-index:998;background:#1a1a1a;color:#fff;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;padding:10px 14px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer;max-width:220px}' +
    '.dch-hint:after{content:"";position:absolute;left:-6px;bottom:14px;border:6px solid transparent;border-right-color:#1a1a1a;border-left:0}' +
    '.dch-win{position:fixed;left:28px;bottom:100px;z-index:999;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 130px);background:#fff;border-radius:16px;box-shadow:0 12px 48px rgba(0,0,0,.3);display:none;flex-direction:column;overflow:hidden;font-family:Inter,sans-serif}' +
    '.dch-win.open{display:flex}' +
    '.dch-head{background:#1a1a1a;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:10px}' +
    '.dch-ava{width:36px;height:36px;border-radius:50%;background:#E8600A;display:flex;align-items:center;justify-content:center;font-family:Montserrat,sans-serif;font-weight:800;font-size:16px;color:#fff;flex:none}' +
    '.dch-head b{font-family:Montserrat,sans-serif;font-size:14px;font-weight:700;display:block}' +
    '.dch-head small{font-size:11px;color:rgba(255,255,255,.65)}' +
    '.dch-close{margin-left:auto;background:none;border:none;color:#fff;font-size:22px;cursor:pointer;line-height:1;padding:4px}' +
    '.dch-msgs{flex:1;overflow-y:auto;padding:14px;background:#f4f0eb;display:flex;flex-direction:column;gap:8px}' +
    '.dch-m{max-width:85%;padding:9px 12px;border-radius:12px;font-size:14px;line-height:1.5;white-space:pre-wrap;word-break:break-word}' +
    '.dch-m.bot{background:#fff;color:#1a1a1a;align-self:flex-start;border-bottom-left-radius:4px}' +
    '.dch-m.user{background:#E8600A;color:#fff;align-self:flex-end;border-bottom-right-radius:4px}' +
    '.dch-quick{display:flex;flex-wrap:wrap;gap:6px;padding:0 14px 8px;background:#f4f0eb}' +
    '.dch-q{background:#fff;border:1px solid #e0d9cf;border-radius:16px;font-size:12px;font-family:Inter,sans-serif;padding:6px 12px;cursor:pointer;color:#1a1a1a}' +
    '.dch-q:hover{border-color:#E8600A;color:#E8600A}' +
    '.dch-form{display:flex;gap:8px;padding:12px;border-top:1px solid #eee;background:#fff}' +
    '.dch-in{flex:1;border:1.5px solid #e0d9cf;border-radius:8px;padding:10px 12px;font-size:14px;font-family:Inter,sans-serif;outline:none}' +
    '.dch-in:focus{border-color:#E8600A}' +
    '.dch-send{background:#E8600A;color:#fff;border:none;border-radius:8px;width:42px;cursor:pointer;font-size:16px}' +
    '.dch-typing{font-size:12px;color:#999;padding:0 14px 6px;background:#f4f0eb;display:none}' +
    '@media(max-width:620px){.dch-win{left:10px;right:10px;bottom:96px;width:auto;height:calc(100vh - 120px)}}';
  document.head.appendChild(css);

  var bubble = document.createElement('button');
  bubble.className = 'dch-bubble';
  bubble.setAttribute('aria-label', 'Чат со строителем');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.2 1 4.2 2.6 5.7L4 21l3.9-1.6c1.3.4 2.7.6 4.1.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3zm-5 7h10v1.5H7V10zm0 3h7v1.5H7V13z"/></svg>';
  document.body.appendChild(bubble);

  var win = document.createElement('div');
  win.className = 'dch-win';
  win.innerHTML =
    '<div class="dch-head"><div class="dch-ava">Г</div><div><b>Григорич · Dianast</b><small>инженер, кирпич и заборы — отвечу без воды</small></div><button class="dch-close" aria-label="Закрыть">×</button></div>' +
    '<div class="dch-msgs"></div><div class="dch-typing">Григорич печатает…</div>' +
    '<div class="dch-quick">' +
      '<button class="dch-q" data-t="Сколько стоит кирпич?">Цена кирпича</button>' +
      '<button class="dch-q" data-t="Как считается доставка?">Доставка</button>' +
      '<button class="dch-q" data-go="/quiz">Рассчитать забор</button>' +
      '<button class="dch-q" data-go="tel:+375297974362">Позвонить</button>' +
    '</div>' +
    '<div class="dch-form"><input class="dch-in" placeholder="Ваш вопрос…" maxlength="500"><input type="text" class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;border:0;padding:0"><button class="dch-send" aria-label="Отправить">➤</button></div>';
  document.body.appendChild(win);

  var msgs = win.querySelector('.dch-msgs');
  var input = win.querySelector('.dch-in');
  var typing = win.querySelector('.dch-typing');

  function add(role, text, save){
    var d = document.createElement('div');
    d.className = 'dch-m ' + (role === 'user' ? 'user' : 'bot');
    d.textContent = text;
    msgs.appendChild(d);
    msgs.scrollTop = msgs.scrollHeight;
    if (save !== false){ history.push({role: role, text: text}); try{ localStorage.setItem(LS, JSON.stringify(history.slice(-30))); }catch(e){} }
  }

  function greet(){
    if (history.length){ history.forEach(function(m){ add(m.role, m.text, false); }); return; }
    fetch(API, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[]})})
      .then(function(r){return r.json()}).then(function(d){ add('assistant', d.reply); })
      .catch(function(){ add('assistant', 'Здравствуйте! Григорич на связи — спрашивайте про кирпич и заборы.'); });
  }

  function send(text){
    if (!text.trim()) return;
    add('user', text.trim());
    input.value = '';
    typing.style.display = 'block';
    fetch(API, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: history.slice(-12), page: location.pathname, hp: win.querySelector('.hp-f').value})
    }).then(function(r){ return r.json(); }).then(function(d){
      typing.style.display = 'none';
      add('assistant', d.reply || 'Позвоните нам: +375 29 797-43-62');
      if (d.lead && typeof ym === 'function') ym(110181067, 'reachGoal', 'chat_lead');
    }).catch(function(){
      typing.style.display = 'none';
      add('assistant', 'Связь шалит. Позвоните нам: +375 29 797-43-62');
    });
  }

  var opened = false;
  function open(){
    win.classList.add('open');
    hint.style.display = 'none';
    try{ localStorage.setItem(HINT_LS, '1'); }catch(e){}
    if (!opened){ opened = true; greet(); if (typeof ym === 'function') ym(110181067, 'reachGoal', 'chat_open'); }
    input.focus();
  }
  bubble.onclick = function(){ win.classList.contains('open') ? win.classList.remove('open') : open(); };
  win.querySelector('.dch-close').onclick = function(){ win.classList.remove('open'); };
  win.querySelector('.dch-send').onclick = function(){ send(input.value); };
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter') send(input.value); });
  win.querySelectorAll('.dch-q').forEach(function(b){
    b.onclick = function(){
      if (b.dataset.go){ location.href = b.dataset.go; return; }
      open(); send(b.dataset.t);
    };
  });

  var hint = document.createElement('div');
  hint.className = 'dch-hint';
  hint.textContent = 'Сколько стоит забор? Спросите строителя 👷';
  hint.style.display = 'none';
  hint.onclick = open;
  document.body.appendChild(hint);
  var hintSeen = false;
  try{ hintSeen = !!localStorage.getItem(HINT_LS); }catch(e){}
  if (!hintSeen) setTimeout(function(){ if (!win.classList.contains('open')) hint.style.display = 'block'; }, 5000);

  window.dianastChat = { open: open };
})();

// Чат-бот строителя Dianast: пузырь слева внизу + окно чата.
// Мозг на сервере CRM (/api/bot) — здесь только интерфейс.
// Память диалога в localStorage; цели Метрики chat_open / chat_lead.
// Григорич сидит на кромке шапки и меняет состояние по ходу диалога
// (кадры — /assets/grigorich/*.webp, грузятся лениво при первом открытии).
(function(){
  var API = 'https://dianast-crm.vercel.app/api/bot';
  var LS = 'dianast_chat_v1';
  var HINT_LS = 'dianast_chat_hint';
  var GRIG = '/assets/grigorich/';
  var MOODS = ['hello','think','praise','grumble','boss','brick','rest'];
  var history = [];
  try { history = JSON.parse(localStorage.getItem(LS) || '[]'); } catch(e){}

  var css = document.createElement('style');
  css.textContent =
    '.dch-bubble{position:fixed;left:28px;bottom:28px;z-index:998;width:60px;height:60px;border-radius:50%;background:#E8600A;box-shadow:0 4px 20px rgba(232,96,10,.45);display:flex;align-items:center;justify-content:center;cursor:pointer;border:none;transition:transform .2s}' +
    '.dch-bubble:hover{transform:scale(1.1)}' +
    '.dch-bubble svg{width:30px;height:30px;fill:#fff}' +
    '.dch-hint{position:fixed;left:96px;bottom:38px;z-index:998;background:#2B2521;color:#fff;font-family:Montserrat,sans-serif;font-size:13px;font-weight:600;padding:10px 14px;border-radius:12px;box-shadow:0 4px 16px rgba(0,0,0,.3);cursor:pointer;max-width:220px}' +
    '.dch-hint:after{content:"";position:absolute;left:-6px;bottom:14px;border:6px solid transparent;border-right-color:#2B2521;border-left:0}' +
    '.dch-stage{position:fixed;left:28px;bottom:100px;z-index:999;width:360px;max-width:calc(100vw - 40px);display:none;font-family:Inter,sans-serif}' +
    '.dch-stage.open{display:block}' +
    '.dch-win{position:relative;height:520px;max-height:calc(100vh - 130px);background:#FBF1EA;border-radius:18px;box-shadow:0 12px 48px rgba(60,32,10,.32);display:flex;flex-direction:column;overflow:hidden}' +
    '.dch-head{position:relative;background:#E8600A;color:#fff;padding:14px 16px;display:flex;align-items:center;gap:11px;min-height:60px}' +
    '.dch-head:before{content:"";position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(255,255,255,.09) 0 1px,transparent 1px 22px),repeating-linear-gradient(90deg,rgba(255,255,255,.09) 0 1px,transparent 1px 22px)}' +
    '.dch-logo{position:relative;z-index:1;width:40px;height:40px;border-radius:50%;background:#fff;flex:none;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 8px rgba(0,0,0,.15)}' +
    '.dch-logo svg{width:26px;height:26px}' +
    '.dch-who{position:relative;z-index:1;line-height:1.25}' +
    '.dch-who b{font-family:Montserrat,sans-serif;font-size:17px;font-weight:800;letter-spacing:.2px;display:block}' +
    '.dch-who span{display:inline-flex;align-items:center;gap:6px;font-size:11px;font-weight:600;letter-spacing:.4px;text-transform:uppercase;color:rgba(255,255,255,.92)}' +
    '.dch-dot{width:7px;height:7px;border-radius:50%;background:#35B96A;box-shadow:0 0 0 3px rgba(53,185,106,.35)}' +
    '.dch-close{position:relative;z-index:6;margin-left:auto;width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.18);border:none;color:#fff;font-size:20px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center}' +
    '.dch-msgs{flex:1;overflow-y:auto;padding:16px 14px 6px;background:#FBF1EA;display:flex;flex-direction:column;gap:10px}' +
    '.dch-row{display:flex;gap:8px;align-items:flex-end}' +
    '.dch-row.user{justify-content:flex-end}' +
    '.dch-ava{width:34px;height:34px;border-radius:50%;flex:none;background:#E8600A url(' + GRIG + 'avatar.webp) center/cover no-repeat;border:2px solid #fff;box-shadow:0 2px 6px rgba(60,32,10,.2)}' +
    '.dch-m{max-width:80%;padding:10px 13px;border-radius:15px;font-size:14px;line-height:1.5;font-weight:500;white-space:pre-wrap;word-break:break-word}' +
    '.dch-m.bot{background:#fff;color:#2B2521;border-bottom-left-radius:5px;box-shadow:0 3px 12px rgba(60,32,10,.07)}' +
    '.dch-m.user{background:#E8600A;color:#fff;border-bottom-right-radius:5px}' +
    '.dch-quick{display:flex;flex-direction:column;gap:8px;padding:6px 14px 4px;background:#FBF1EA}' +
    '.dch-q{align-self:flex-start;background:transparent;border:2px solid #E8600A;color:#C24E08;border-radius:22px;font-size:13px;font-weight:700;font-family:Inter,sans-serif;padding:8px 15px;cursor:pointer;text-align:left;transition:background .15s,color .15s}' +
    '.dch-q:hover{background:#E8600A;color:#fff}' +
    '.dch-form{display:flex;gap:9px;padding:12px 14px 14px;background:#FBF1EA}' +
    '.dch-in{flex:1;border:2px solid #EBDDD0;background:#fff;border-radius:13px;padding:11px 14px;font-size:14px;font-family:Inter,sans-serif;color:#2B2521;outline:none}' +
    '.dch-in:focus{border-color:#E8600A}' +
    '.dch-send{background:#E8600A;color:#fff;border:none;border-radius:13px;width:48px;cursor:pointer;font-size:18px;flex:none}' +
    '.dch-typing{font-size:12px;font-weight:600;color:#C24E08;padding:2px 16px 8px;background:#FBF1EA;display:none}' +
    // Григорич на кромке шапки — над окном, поверх шапки
    '.dch-grig{position:absolute;right:var(--g-right);top:var(--g-top);height:var(--g-h);aspect-ratio:820/800;z-index:5;pointer-events:none;filter:drop-shadow(0 9px 9px rgba(60,32,10,.22));opacity:1;transition:opacity .2s;animation:dchBreath 4.5s ease-in-out infinite}' +
    '@keyframes dchBreath{0%,100%{transform:translateY(0)}50%{transform:translateY(-2.5px)}}' +
    '.dch-layer{position:absolute;inset:0;background-size:contain;background-position:bottom center;background-repeat:no-repeat;opacity:0;transition:opacity .28s ease}' +
    '.dch-layer.on{opacity:1}' +
    '.dch-rest{position:absolute;right:var(--r-right);top:var(--r-top);width:var(--r-w);aspect-ratio:1211/379;background-size:contain;background-position:bottom center;background-repeat:no-repeat;z-index:5;pointer-events:none;filter:drop-shadow(0 8px 8px rgba(60,32,10,.22));opacity:0;transition:opacity .28s ease}' +
    '.dch-stage[data-mood="rest"] .dch-grig{opacity:0}' +
    '.dch-stage[data-mood="rest"] .dch-rest{opacity:1}' +
    ':root{}' +
    '.dch-stage{--g-h:200px;--g-right:-32px;--g-top:-119px;--r-w:250px;--r-right:16px;--r-top:-70px}' +
    '@media(prefers-reduced-motion:reduce){.dch-grig,.dch-rest,.dch-layer{transition:none}.dch-grig{animation:none}}' +
    '@media(max-width:620px){.dch-stage{left:8px;right:8px;bottom:88px;width:auto;--g-right:-6px;--r-right:22px}.dch-win{height:calc(100vh - 232px)}}';
  document.head.appendChild(css);

  var bubble = document.createElement('button');
  bubble.className = 'dch-bubble';
  bubble.setAttribute('aria-label', 'Чат со строителем');
  bubble.innerHTML = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 3C6.5 3 2 6.9 2 11.7c0 2.2 1 4.2 2.6 5.7L4 21l3.9-1.6c1.3.4 2.7.6 4.1.6 5.5 0 10-3.9 10-8.7S17.5 3 12 3zm-5 7h10v1.5H7V10zm0 3h7v1.5H7V13z"/></svg>';
  document.body.appendChild(bubble);

  // слои Григорича (сидячие состояния) + отдельный лежачий кадр
  var grigLayers = '';
  ['hello','think','praise','grumble','boss','brick'].forEach(function(m){
    grigLayers += '<div class="dch-layer" data-mood="' + m + '" style="background-image:url(' + GRIG + m + '.webp)"></div>';
  });

  var stage = document.createElement('div');
  stage.className = 'dch-stage';
  stage.setAttribute('data-mood', 'hello');
  stage.innerHTML =
    '<div class="dch-win">' +
      '<div class="dch-head">' +
        '<div class="dch-logo" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none"><rect x="3" y="9" width="18" height="12" rx="1" fill="#B83010"/><path d="M2 9l10-6 10 6" stroke="#B83010" stroke-width="2" stroke-linejoin="round"/><g fill="#fff"><rect x="6" y="12" width="3" height="3"/><rect x="10.5" y="12" width="3" height="3"/><rect x="15" y="12" width="3" height="3"/><rect x="6" y="16.5" width="3" height="3"/><rect x="15" y="16.5" width="3" height="3"/></g></svg></div>' +
        '<div class="dch-who"><b>Григорич</b><span><i class="dch-dot"></i>строитель на связи</span></div>' +
        '<button class="dch-close" aria-label="Закрыть">×</button>' +
      '</div>' +
      '<div class="dch-msgs"></div><div class="dch-typing">Григорич считает…</div>' +
      '<div class="dch-quick">' +
        '<button class="dch-q" data-t="Сколько стоит кирпич?">Цена кирпича</button>' +
        '<button class="dch-q" data-t="Как считается доставка?">Доставка</button>' +
        '<button class="dch-q" data-go="/quiz">Рассчитать забор</button>' +
        '<button class="dch-q" data-go="tel:+375297974362">Позвонить</button>' +
      '</div>' +
      '<div class="dch-form"><input class="dch-in" placeholder="Спросите про забор…" maxlength="500"><input type="text" class="hp-f" name="website" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;height:0;width:0;border:0;padding:0"><button class="dch-send" aria-label="Отправить">➤</button></div>' +
    '</div>' +
    '<div class="dch-grig" role="img" aria-label="Григорич на связи">' + grigLayers + '</div>' +
    '<div class="dch-rest" role="img" aria-label="Григорич отдыхает" style="background-image:url(' + GRIG + 'rest.webp)"></div>';
  document.body.appendChild(stage);

  var win = stage.querySelector('.dch-win');
  var msgs = stage.querySelector('.dch-msgs');
  var input = stage.querySelector('.dch-in');
  var typing = stage.querySelector('.dch-typing');
  var layers = stage.querySelectorAll('.dch-layer');

  // Ночной статус: по Минску (UTC+3) с 22:00 до 08:00 — честно «отвечу утром».
  (function(){
    var mh = (new Date().getUTCHours() + 3) % 24;
    if (mh < 8 || mh >= 22){
      var s = stage.querySelector('.dch-who span');
      if (s) s.innerHTML = '<i class="dch-dot" style="background:#E8A400;box-shadow:0 0 0 3px rgba(232,164,0,.3)"></i>ночью — отвечу утром';
    }
  })();

  // --- состояния Григорича ---
  var idle1, idle2;
  function setMood(m){
    stage.setAttribute('data-mood', m);
    if (m !== 'rest') layers.forEach(function(l){ l.classList.toggle('on', l.dataset.mood === m); });
  }
  function armIdle(){            // простой: сначала «за делом», потом «прилёг»
    clearTimeout(idle1); clearTimeout(idle2);
    idle1 = setTimeout(function(){ setMood('brick'); }, 30000);
    idle2 = setTimeout(function(){ setMood('rest'); }, 75000);
  }
  function moodFromReply(t){     // лёгкая реакция на смысл ответа; по умолчанию — приветливый
    t = (t || '').toLowerCase();
    if (/технолог|по норм|нельзя|только так|обязательн|основани|фундамент|не рекоменд|нарушать/.test(t)) return 'boss';
    if (/дорого|дешевл|скидк|торг|сэконом|подешевле|переплат/.test(t)) return 'grumble';
    if (/отличный вопрос|правильн|верно мысл|хороший выбор|дельн|по делу|молодец/.test(t)) return 'praise';
    return 'hello';
  }
  var preloaded = false;
  function preload(){
    if (preloaded) return; preloaded = true;
    MOODS.concat('avatar').forEach(function(m){ var i = new Image(); i.src = GRIG + m + '.webp'; });
  }

  function add(role, text, save){
    var isUser = role === 'user';
    var row = document.createElement('div');
    row.className = 'dch-row ' + (isUser ? 'user' : 'bot');
    row.innerHTML = (isUser ? '' : '<div class="dch-ava" aria-hidden="true"></div>') +
                    '<div class="dch-m ' + (isUser ? 'user' : 'bot') + '"></div>';
    row.querySelector('.dch-m').textContent = text;
    msgs.appendChild(row);
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
    setMood('think'); clearTimeout(idle1); clearTimeout(idle2);
    fetch(API, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({messages: history.slice(-12), page: location.pathname, hp: stage.querySelector('.hp-f').value})
    }).then(function(r){ return r.json(); }).then(function(d){
      typing.style.display = 'none';
      var reply = d.reply || 'Позвоните нам: +375 29 797-43-62';
      add('assistant', reply);
      // Настроение: приоритет — серверная метка d.mood, иначе клиентская эвристика.
      setMood(d.reply ? (d.mood || moodFromReply(reply)) : 'hello'); armIdle();
      if (d.lead && typeof ym === 'function') ym(110181067, 'reachGoal', 'chat_lead');
    }).catch(function(){
      typing.style.display = 'none';
      add('assistant', 'Связь шалит. Позвоните нам: +375 29 797-43-62');
      setMood('hello'); armIdle();
    });
  }

  var opened = false;
  function open(){
    stage.classList.add('open');
    hint.style.display = 'none';
    try{ localStorage.setItem(HINT_LS, '1'); }catch(e){}
    preload(); setMood('hello'); armIdle();
    if (!opened){ opened = true; greet(); if (typeof ym === 'function') ym(110181067, 'reachGoal', 'chat_open'); }
    input.focus();
  }
  bubble.onclick = function(){ stage.classList.contains('open') ? stage.classList.remove('open') : open(); };
  stage.querySelector('.dch-close').onclick = function(){ stage.classList.remove('open'); };
  stage.querySelector('.dch-send').onclick = function(){ send(input.value); };
  input.addEventListener('keydown', function(e){ armIdle(); if (e.key === 'Enter') send(input.value); });
  stage.querySelectorAll('.dch-q').forEach(function(b){
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
  // Показываем подсказку через 5 сек и убираем через 10 сек показа:
  // фиксированная подсказка перекрывала главную кнопку в первом экране на мобильных.
  if (!hintSeen) setTimeout(function(){
    if (stage.classList.contains('open')) return;
    hint.style.display = 'block';
    setTimeout(function(){ hint.style.display = 'none'; }, 10000);
  }, 5000);

  window.dianastChat = { open: open };
})();

// Отправка заявок dianast.by на сервер CRM (dianast-crm.vercel.app).
// Сервер кладёт заявку в базу, шлёт уведомление в Telegram и режет спам
// (скрытые поля-ловушки .hp-f подхватываются отсюда автоматически).
// Токенов в этом файле нет и быть не должно: код виден каждому посетителю.
// Один файл на все страницы — менять адрес или логику в одном месте.
var LEAD_URL = 'https://dianast-crm.vercel.app/api/lead';
function sendLead(text, onOk, onErr){
  onOk = onOk || function(){};
  onErr = onErr || function(){};
  var hp = [].map.call(document.querySelectorAll('.hp-f'), function(i){ return i.value; }).join('');
  fetch(LEAD_URL, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({text: text, page: location.pathname, hp: hp})
  }).then(function(r){ if(r.ok) onOk(); else onErr(); }).catch(onErr);
}

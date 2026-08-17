// Отправка заявок dianast.by на сервер CRM (dianast-crm.vercel.app).
// Сервер кладёт заявку в базу, шлёт уведомление в Telegram и режет спам
// (скрытые поля-ловушки .hp-f подхватываются отсюда автоматически).
// Токенов в этом файле нет и быть не должно: код виден каждому посетителю.
// Один файл на все страницы — менять адрес или логику в одном месте.
var LEAD_URL = 'https://dianast-crm.vercel.app/api/lead';
// Сохранение сметы по постоянной ссылке (квиз). Клиент возвращается к своему
// расчёту и показывает его дома, менеджер звонит по готовой смете.
var QUOTE_URL = 'https://dianast-crm.vercel.app/api/quote';
// Маска телефона — одна на весь сайт. Раньше в каждой странице лежала своя
// копия, и обе ломались на вставке из контактов: вариант без префикса из
// «+375297974362» делал «37 529 79 74» (в CRM уходил битый номер), вариант с
// префиксом стирал поле начисто при любой вставке. Здесь код страны срезается
// сам, откуда бы человек ни скопировал номер.
// Возвращает 9 цифр без кода — их же слать в заявке как +375XXXXXXXXX.
function phoneDigitsOf(value){
  var d = String(value).replace(/\D/g, '');
  if (d.slice(0, 3) === '375') d = d.slice(3);          // +375 29 797-43-62
  else if (d.slice(0, 2) === '80') d = d.slice(2);      // 8 029 797-43-62
  return d.slice(0, 9);
}
function phoneFormat(d){
  var f = '';
  if (d.length > 0) f += d.slice(0, 2);
  if (d.length > 2) f += ' ' + d.slice(2, 5);
  if (d.length > 5) f += ' ' + d.slice(5, 7);
  if (d.length > 7) f += ' ' + d.slice(7, 9);
  return f;
}
// Поле, рядом с которым «+375» нарисован отдельной подписью
function phoneMask(el){ el.value = phoneFormat(phoneDigitsOf(el.value)); }
// Поле, внутри которого «+375 » — часть значения
function phoneMaskFull(el){ el.value = '+375 ' + phoneFormat(phoneDigitsOf(el.value)); }

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

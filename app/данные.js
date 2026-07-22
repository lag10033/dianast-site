// ============================================================
//  ДАННЫЕ УСТРОЙСТВА — перенос между компьютером и телефоном
//
//  Всё, что помнит приложение (справочник клиентов, корзина заказа,
//  свои профили, черновики заявок, настройки станка), хранится
//  в памяти браузера. Она не переезжает сама: ни с компьютера
//  на телефон, ни с localhost на сайт. Эти кнопки переносят её файлом.
//
//  Файл — обычный JSON. Он же резервная копия: чистка браузера
//  стирает всё разом, а из файла восстанавливается за секунду.
// ============================================================

const ДанныеУстройства = (function () {
  const ПРЕФИКС = 'dianast_';
  // Служебное — не данные работы: не выгружаем и не затираем при импорте,
  // иначе после загрузки файла человека выбрасывает на ввод кода доступа.
  const СЛУЖЕБНЫЕ = ['dianast_app_session_v2'];
  const свои = k => k && k.startsWith(ПРЕФИКС) && СЛУЖЕБНЫЕ.indexOf(k) === -1;

  function собрать() {
    const out = {};
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (свои(k)) out[k] = localStorage.getItem(k);
    }
    return out;
  }
  function имяФайла() {
    const d = new Date();
    const p = n => String(n).padStart(2, '0');
    return `dianast-данные-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
  }
  function экспорт() {
    const данные = собрать(), ключей = Object.keys(данные).length;
    if (!ключей) { alert('Сохранять пока нечего — приложение ещё ничего не запомнило.'); return; }
    const пакет = { формат: 'DIANAST-данные', версия: 1, дата: new Date().toISOString(), данные };
    const blob = new Blob([JSON.stringify(пакет, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = имяФайла(); document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
    return ключей;
  }
  function импорт(file, готово) {
    const r = new FileReader();
    r.onload = () => {
      let пакет;
      try { пакет = JSON.parse(r.result); } catch (e) { alert('Это не файл с данными приложения.'); return; }
      if (!пакет || пакет.формат !== 'DIANAST-данные' || !пакет.данные) {
        alert('Это не файл с данными приложения.'); return;
      }
      const ключей = Object.keys(пакет.данные).length;
      const дата = (пакет.дата || '').slice(0, 10);
      if (!confirm(`Загрузить данные от ${дата} (${ключей} записей)?\n\nТо, что сейчас хранится на этом устройстве, будет заменено.`)) return;
      try {
        for (const k of Object.keys(localStorage)) if (свои(k)) localStorage.removeItem(k);
        for (const [k, v] of Object.entries(пакет.данные)) if (свои(k)) localStorage.setItem(k, v);
      } catch (e) { alert('Не удалось записать данные: ' + e.message); return; }
      if (готово) готово(ключей);
    };
    r.readAsText(file);
  }
  return { экспорт, импорт, собрать };
})();

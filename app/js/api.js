import { API_BASE } from './config.js';

/**
 * Загрузить данные страницы по имени ('dashboard' | 'sales' | 'warehouse' | 'foodcost').
 * Сначала пробуем API ({API_BASE}/<name>); если он недоступен — берём локальный
 * data/<name>.json. Так дашборд работает и с бэкендом, и без него.
 * @returns {Promise<object>}
 */
export async function fetchData(name) {
  try {
    const res = await fetch(`${API_BASE}/${name}`, { headers: { Accept: 'application/json' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.warn(`[api] «${name}»: API недоступен (${err.message}); беру data/${name}.json`);
    const res = await fetch(`data/${name}.json`);
    if (!res.ok) throw new Error(`не удалось загрузить «${name}» (HTTP ${res.status})`);
    return await res.json();
  }
}

/**
 * Загрузить данные и отрисовать страницу. При ошибке — показать сообщение,
 * не падая молча.
 * @param {string} name        имя набора данных
 * @param {(data: object) => void} render  функция отрисовки
 * @param {string} [errorTarget]  селектор контейнера для сообщения об ошибке
 */
export async function loadPage(name, render, errorTarget = '.main') {
  try {
    render(await fetchData(name));
  } catch (err) {
    console.error(err);
    const host = document.querySelector(errorTarget);
    if (host) {
      const box = document.createElement('div');
      box.className = 'load-error';
      box.textContent = `Не удалось загрузить данные: ${err.message}`;
      host.prepend(box);
    }
  }
}

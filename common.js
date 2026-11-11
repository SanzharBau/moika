// Общие помощники для клиента и кабинета мойки.
const MIN = 60000;
const TZ = 5 * 60 * MIN; // Астана, UTC+5

const STATE = {
  free: "Свободен", busy: "Занят", reserved: "Зарезервирован", prep: "Подготовка",
  down: "Недоступен", nodata: "Нет актуальных данных",
};
const B_STATUS = {
  hold: "Ожидает оплаты", paid_claimed: "Оплата проверяется", confirmed: "Подтверждена",
  arrived: "Вы в боксе", done: "Завершена", cancelled: "Отменена", expired: "Резерв истёк",
  missed: "Опоздание — нужен перенос", wash_cancelled: "Отменена мойкой", refund: "Нужен возврат",
};
const Q_STATUS = {
  waiting: "В очереди", called: "Ваш бокс свободен!", entered: "Вы в боксе", done: "Завершено",
  left: "Вы вышли из очереди", skipped: "Пропущено — вы не приехали вовремя",
};

function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
function hhmm(ms) {
  const m = Math.floor(((ms + TZ) % 86400000) / MIN);
  return String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
}
function dayLabel(ms) {
  const d = Math.floor((ms + TZ) / 86400000) - Math.floor((Date.now() + TZ) / 86400000);
  return d === 0 ? "сегодня" : d === 1 ? "завтра" : "через " + d + " дн.";
}
function ago(ms) {
  const m = Math.round((Date.now() - ms) / MIN);
  return m <= 0 ? "только что" : m < 60 ? m + " мин назад" : Math.round(m / 60) + " ч назад";
}
function left(ms) {
  const s = Math.max(0, Math.round((ms - Date.now()) / 1000));
  return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
}
// Фото мойки или яркая заглушка, пока мойка не загрузила свои фото.
function photoHtml(photos, i = 0, seed = "") {
  const url = (photos || [])[i];
  if (url) return `<img class="photo" src="${esc(url)}" alt="" loading="lazy">`;
  const n = (([...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) + i) % 4) + 1;
  return `<div class="ph g${n}"><span>фото мойки</span></div>`;
}
// Видео: играют только на экране, без звука; при «уменьшить движение» — только заставка.
function initVideos() {
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const vids = document.querySelectorAll("video");
  if (reduce) { vids.forEach(v => { v.removeAttribute("autoplay"); v.pause(); }); return; }
  const io = new IntersectionObserver(es => es.forEach(e => {
    const v = e.target;
    if (e.isIntersecting) { if (v.dataset.lazy !== undefined && v.preload === "none") v.preload = "auto"; v.play().catch(() => {}); }
    else v.pause();
  }), { threshold: 0.15 });
  vids.forEach(v => io.observe(v));
}
document.addEventListener("DOMContentLoaded", initVideos);
function setTitle(t) { document.title = t + " — Мойка без очереди"; }
function money(n) { return Number(n).toLocaleString("ru-RU") + " ₸"; }
function pill(state) { return `<span class="pill s-${state}"><span class="dot"></span>${STATE[state] || state}</span>`; }

async function api(path, body, headers = {}) {
  const opt = body ? { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) }
                   : { headers };
  const r = await fetch(path, opt);
  const j = await r.json().catch(() => ({ error: "Нет связи с сервером" }));
  if (!r.ok) throw new Error(j.error || "Ошибка");
  return j;
}

let toastTimer;
function toast(msg, err = false) {
  let el = document.querySelector(".toast");
  if (!el) { el = document.createElement("div"); document.body.appendChild(el); }
  el.className = "toast" + (err ? " err" : "");
  el.textContent = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), err ? 6000 : 3000);
}

function legend() {
  return `<div class="legend">${["free", "busy", "reserved", "prep", "down", "nodata"].map(pill).join("")}</div>`;
}

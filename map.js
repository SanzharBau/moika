// Карта моек: Leaflet + OpenStreetMap. Библиотека грузится только при первом открытии карты.
let leafletP = null, map = null, washLayer = null, meMarker = null, markers = {};

function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return (leafletP ||= new Promise((ok, fail) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    css.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
    css.crossOrigin = "";
    document.head.appendChild(css);
    const s = document.createElement("script");
    s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    s.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
    s.crossOrigin = "";
    s.onload = ok;
    s.onerror = () => { leafletP = null; fail(new Error("Не удалось загрузить карту — проверьте интернет. Список моек работает.")); };
    document.head.appendChild(s);
  }));
}

function pinState(w) { return w.stale ? "nodata" : w.free > 0 ? "free" : "busy"; }

function pinIcon(w) {
  const label = w.stale ? "?" : `${w.free}/${w.total}`;
  return L.divIcon({
    className: "",
    html: `<div class="pin s-${pinState(w)}">${label}${w.queue ? `<i>+${w.queue}</i>` : ""}</div>`,
    iconSize: [64, 34], iconAnchor: [32, 34], popupAnchor: [0, -30],
  });
}

function popupHtml(w) {
  const wait = w.wait === 0 ? "0–5 мин" : w.wait == null ? "—" : "~" + w.wait + " мин";
  return `<div class="pop">
    <b>${esc(w.name)}</b>
    <div class="muted">${w.type === "self" ? "Самомойка" : "С персоналом"} · ${w.k.toFixed(1)} км · от ${money(w.price_from)}</div>
    ${w.stale ? `<div class="stale">Нет актуальных данных о боксах (${ago(w.last_seen)})</div>`
      : `<div>Свободно <b>${w.free} из ${w.total}</b> · ожидание <b>${wait}</b>${w.queue ? ` · в очереди ${w.queue}` : ""}</div>
         <div class="muted">Заезд с дорогой ~${hhmm(Date.now() + w.eta * MIN)}</div>`}
    <div class="muted">★ ${w.rating ?? "—"} · ${w.reviews} отзывов</div>
    <div class="row" style="margin-top:8px">
      <a class="btn primary" href="#/wash/${w.id}">Очередь и запись</a>
      <a class="btn" href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}" target="_blank" rel="noopener">Маршрут</a>
    </div></div>`;
}

async function drawMap(list) {
  const el = document.getElementById("map");
  if (!el) return;
  try { await loadLeaflet(); }
  catch (e) { el.innerHTML = `<div class="stale" style="margin:12px">${esc(e.message)}</div>`; return; }
  let fresh = false;
  if (!map || map.getContainer() !== el) {
    if (map) map.remove();
    map = L.map(el).setView([S.pos.lat, S.pos.lng], 12);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    washLayer = L.layerGroup().addTo(map);
    meMarker = null; markers = {}; fresh = true;
  }
  map.invalidateSize();

  // Положение пользователя
  const me = [S.pos.lat, S.pos.lng];
  if (!meMarker) meMarker = L.circleMarker(me, { radius: 8, color: "#fff", weight: 3, fillColor: "#0a6cff", fillOpacity: 1 }).addTo(map);
  meMarker.setLatLng(me).bindTooltip(S.geo ? "Вы здесь" : "Центр Астаны");

  // Мойки: обновляем существующие маркеры, чтобы открытая подсказка не закрывалась при обновлении
  const seen = new Set();
  for (const w of list) {
    seen.add(w.id);
    const icon = pinIcon(w), pop = popupHtml(w), m = markers[w.id];
    if (!m) {
      markers[w.id] = L.marker([w.lat, w.lng], { icon, title: w.name }).bindPopup(pop, { maxWidth: 280 }).addTo(washLayer);
      Object.assign(markers[w.id], { _pinHtml: icon.options.html, _popHtml: pop });
      continue;
    }
    // Перерисовываем только при изменениях, чтобы не сбивать нажатие на маркер
    if (m._pinHtml !== icon.options.html) { m.setIcon(icon); m._pinHtml = icon.options.html; }
    if (m._popHtml !== pop) { m.setPopupContent(pop); m._popHtml = pop; }
  }
  for (const id of Object.keys(markers)) if (!seen.has(id)) { washLayer.removeLayer(markers[id]); delete markers[id]; }

  if (fresh && list.length) map.fitBounds(L.latLngBounds([me, ...list.map(w => [w.lat, w.lng])]), { padding: [40, 40], maxZoom: 14 });
}

function mapLegend() {
  return `<div class="legend">
    <span class="pill s-free"><span class="dot"></span>Есть свободные боксы</span>
    <span class="pill s-busy"><span class="dot"></span>Все заняты</span>
    <span class="pill s-nodata"><span class="dot"></span>Нет данных</span>
    <span class="pill">4/8 — свободно из всех · +2 — в очереди</span></div>`;
}

// Клиентская часть: список моек, боксы, очередь, бронь, «Моя запись».
const $app = document.getElementById("app");
const S = {
  phone: localStorage.phone || "", car: localStorage.car || "",
  pos: { lat: 51.135, lng: 71.445 }, geo: false,
  f: { type: "", sort: "rec", freeNow: false, warm: false, top: false, price: "" },
  wash: null, service: null, day: 0, tab: "queue", slot: null, my: [], resched: null,
  view: localStorage.view || "list",
};
const RULE_TEXT = "Заезд в бокс — только по брони или через очередь в приложении.";

// ---------- маршрутизация
function route() {
  const h = location.hash.replace(/^#\/?/, "").split("/");
  document.getElementById("back").hidden = !h[0];
  document.body.classList.remove("has-wbar");
  if (h[0] === "wash") return viewWash(h[1]);
  if (h[0] === "my") return viewMy();
  return viewList();
}
window.addEventListener("hashchange", () => { S.slot = null; S.resched = null; scrollTo(0, 0); route(); });
document.getElementById("back").onclick = () => (location.hash = "#/");
document.getElementById("myBtn").onclick = () => (location.hash = "#/my");
document.getElementById("mybar").onclick = () => (location.hash = "#/my");

// ---------- правило сервиса: главный экран
function goView(v) {
  S.view = localStorage.view = v;
  if (location.hash.replace(/^#\/?/, "")) location.hash = "#/"; else route();
  scrollTo(0, 0);
  return false;
}
function ruleBanner() {
  const open = !localStorage.ruleSeen;
  return `<section class="hero">
    <div class="hero-in">
      <p class="kicker">Астана · реальная загрузка боксов</p>
      <h1>Мойки Астаны</h1>
      <p class="lead"><b>Сначала — бронь или очередь, потом — бокс.</b> Видно, сколько боксов свободно прямо сейчас, сколько ждать и когда вы реально заедете.</p>
      ${open ? `<ol class="hero-steps">
        <li><span>01</span><b>Бронь или очередь</b>Без записи в бокс не заезжают: свободный сейчас бокс может быть обещан другому клиенту.</li>
        <li><span>02</span><b>Помыть сейчас</b>Встаньте в очередь за 10 минут до приезда. Освободился бокс — его получает первый в очереди.</li>
        <li><span>03</span><b>Ко времени</b>Забронируйте точное время. Предоплата через Kaspi засчитывается в стоимость.</li>
        <li><span>04</span><b>Заезд по вызову</b>Отсчёт времени начинается с момента заезда в бокс.</li>
      </ol>
      <div class="hero-actions"><button class="btn-light" onclick="localStorage.ruleSeen=1;route()">Понятно</button></div>`
      : `<a href="#" class="hero-more" onclick="localStorage.removeItem('ruleSeen');route();return false">Как это работает</a>`}
    </div>
  </section>`;
}

// ---------- геолокация и расстояние
function km(a, b) {
  const r = x => x * Math.PI / 180, R = 6371;
  const d = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(d));
}
const drive = k => Math.round(k / 25 * 60 + 2); // ~25 км/ч по городу + парковка
function locate() {
  navigator.geolocation?.getCurrentPosition(p => {
    S.pos = { lat: p.coords.latitude, lng: p.coords.longitude }; S.geo = true; route();
  }, () => {}, { timeout: 5000 });
}

// ---------- список моек
let washes = [];
async function viewList() {
  setTitle("Астана");
  $app.innerHTML = ruleBanner() + `
    <div class="filters">
      <select id="fType"><option value="">Все мойки</option><option value="self">Самомойки</option><option value="staff">С персоналом</option></select>
      <select id="fSort"><option value="rec">Рекомендуем</option><option value="eta">Быстрее заехать</option><option value="dist">Ближе</option><option value="price">Дешевле</option><option value="rating">Рейтинг</option></select>
      <button class="chip" data-k="freeNow">Свободно сейчас</button>
      <button class="chip" data-k="warm">Тёплый бокс</button>
      <button class="chip" data-k="top">Рейтинг 4.5+</button>
      <select id="fPrice"><option value="">Любая цена</option><option value="2000">до 2 000 ₸</option><option value="5000">до 5 000 ₸</option></select>
    </div>
    <div class="tabs" id="viewTabs" style="margin-top:8px"><button data-v="list">Список</button><button data-v="map">Карта</button></div>
    <p class="muted">${S.geo ? "Расстояние от вас" : `Расстояние от центра Астаны · <a href="#" id="geo">определить моё место</a>`}</p>
    <div id="mapWrap" hidden>${mapLegend()}<div id="map" class="map"></div>
      <p class="muted">Цифры на карте — свободно сейчас. Это ещё не место за вами: оно появится только после брони или вызова из очереди.</p></div>
    <div id="cards"></div>
    <footer class="note">Прогноз ожидания — оценка по текущей загрузке, не гарантия. Гарантия места — только подтверждённая бронь или вызов из очереди.</footer>`;
  const ft = document.getElementById("fType"), fs = document.getElementById("fSort"), fp = document.getElementById("fPrice");
  ft.value = S.f.type; fs.value = S.f.sort; fp.value = S.f.price;
  ft.onchange = () => { S.f.type = ft.value; drawCards(); };
  fs.onchange = () => { S.f.sort = fs.value; drawCards(); };
  fp.onchange = () => { S.f.price = fp.value; drawCards(); };
  document.querySelectorAll(".chip").forEach(c => {
    c.classList.toggle("on", S.f[c.dataset.k]);
    c.onclick = () => { S.f[c.dataset.k] = !S.f[c.dataset.k]; c.classList.toggle("on"); drawCards(); };
  });
  document.getElementById("geo")?.addEventListener("click", e => { e.preventDefault(); locate(); });
  document.querySelectorAll("#viewTabs button").forEach(b => b.onclick = () => { S.view = localStorage.view = b.dataset.v; drawCards(); });
  if (washes.length) drawCards();
  await loadList();
}
async function loadList() {
  try {
    washes = await api("/api/washes");
    if (!S.ads) S.ads = (await api("/api/home")).ads;
    drawCards();
  } catch (e) { toast(e.message, true); }
}
// Платное место: premium выше top, top выше обычных. Работает только в сортировке «Рекомендуем».
const PROMO_RANK = { premium: 2, top: 1, none: 0 };
function adCard(a) {
  return `<aside class="ad-card"><div class="ad-ico">✦</div><div><small>Реклама · ${esc(a.advertiser)}</small><b>${esc(a.title)}</b>
    <span class="muted" style="color:inherit">${esc(a.text)}</span>${a.link ? ` <a href="${esc(a.link)}" target="_blank" rel="noopener sponsored">Подробнее</a>` : ""}</div></aside>`;
}
function drawCards() {
  const el = document.getElementById("cards");
  if (!el) return;
  let list = washes.map(w => {
    const k = km(S.pos, w), d = drive(k);
    const eta = w.stale || w.wait == null ? null : Math.max(d, w.wait);
    return { ...w, k, d, eta };
  }).filter(w => (!S.f.type || w.type === S.f.type) && (!S.f.freeNow || w.free > 0) && (!S.f.warm || w.warm)
    && (!S.f.top || w.rating >= 4.5) && (!S.f.price || w.price_from <= +S.f.price));
  const key = { rec: w => w.eta ?? 999, eta: w => w.eta ?? 999, dist: w => w.k, price: w => w.price_from, rating: w => -(w.rating || 0) }[S.f.sort] || (w => w.eta ?? 999);
  list.sort((a, b) => (S.f.sort === "rec" ? PROMO_RANK[b.promo || "none"] - PROMO_RANK[a.promo || "none"] : 0) || key(a) - key(b));
  const onMap = S.view === "map";
  document.querySelectorAll("#viewTabs button").forEach(b => b.classList.toggle("on", b.dataset.v === S.view));
  document.getElementById("mapWrap").hidden = !onMap;
  el.innerHTML = !list.length ? `<div class="card muted">Нет моек под выбранные фильтры.</div>`
    : onMap ? "" : list.map((w, i) => card(w, i) + (i === 1 && S.ads?.length ? adCard(S.ads[0]) : "")).join("");
  if (onMap) drawMap(list);
}
function card(w, i = 0) {
  const route = `https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}`;
  const next = w.next_slot ? `${w.next_slot.day ? "завтра " : ""}${w.next_slot.time}` : "нет";
  const paid = S.f.sort === "rec" && w.promo && w.promo !== "none";
  return `<article class="wash${paid ? " promoted" : ""}">
    <a class="wash-photo" href="#/wash/${w.id}">${photoHtml(w.photos, 0, w.id)}</a>
    <div class="wash-body">
    <div class="wash-head"><h2><a href="#/wash/${w.id}">${esc(w.name)}</a></h2><span class="dist">${w.k.toFixed(1)} км</span></div>
    <p class="meta">${esc(w.address)}</p>
    <div class="tags">${paid ? '<span class="tag ad">Реклама</span>' : ""}<span class="tag">${w.type === "self" ? "Самомойка" : "Мойка с персоналом"}</span>${w.warm ? '<span class="tag">Тёплый бокс</span>' : ""}<span class="tag">от ${money(w.price_from)}</span></div>
    ${w.offer ? `<div class="offer-line"><span class="tag offer" style="background:#fff;margin-right:6px">Спецпредложение</span><b>${esc(w.offer.title)}</b></div>` : ""}
    ${w.stale ? `<div class="stale">Нет актуальных данных о боксах — последнее подтверждение ${ago(w.last_seen)}. Мы не показываем такие боксы как свободные. Запись на время доступна.</div>` : `
    <div class="stats">
      <div class="stat"><b>${w.free} из ${w.total}</b><span>боксов свободно</span></div>
      <div class="stat"><b>${w.wait === 0 ? "0–5 мин" : w.wait == null ? "—" : "~" + w.wait + " мин"}</b><span>ожидание (прогноз)${w.queue ? ", в очереди " + w.queue : ""}</span></div>
      <div class="stat"><b>~${hhmm(Date.now() + w.eta * MIN)}</b><span>заезд с дорогой ${w.d} мин</span></div>
    </div>`}
    <p class="meta">★ ${w.rating ?? "—"} · ${w.reviews} подтверждённых отзывов · вовремя ${Math.round(w.on_time * 100)}% · ближайшая запись: ${next}</p>
    <div class="actions">
      <a class="btn hot" href="#/wash/${w.id}">Очередь и запись</a>
      <a class="btn" href="${route}" target="_blank" rel="noopener">Маршрут</a>
    </div></div></article>`;
}

// ---------- страница мойки
async function viewWash(id) {
  S.wash = id;
  try {
    const d = await api(`/api/wash?id=${id}&service=${S.service || ""}&day=${S.day}`);
    S.service = d.service; S.detail = d;
  } catch (e) { return toast(e.message, true); }
  const d = S.detail, w = d.wash;
  setTitle(w.name);
  $app.innerHTML = `<section class="hero hero-sm"><div class="hero-in">
      <p class="kicker">${w.type === "self" ? "Самомойка" : "Мойка с персоналом"} · ${esc(w.address)}</p>
      <h1>${esc(w.name)}</h1>
      <p class="lead">★ ${w.rating ?? "—"} · ${w.reviews} подтверждённых отзывов · вовремя ${Math.round(w.on_time * 100)}% · от ${money(w.price_from)}</p>
    </div></section>
    <div class="rule-mini"><b>${RULE_TEXT}</b> «Свободно сейчас» ещё не значит, что бокс ваш: пока вы едете, его могут занять. Место за вами — только после брони или вызова из очереди.</div>
    <div class="card"><div class="row spread"><h2>Боксы</h2><span class="muted" id="upd"></span></div>${legend()}<div id="boxes" class="boxes"></div></div>
    <div class="card">
      ${d.services.length > 1 ? `<label>Услуга</label><select id="svc">${d.services.map(s => `<option value="${s.id}">${esc(s.name)} — ${s.min} мин, ${money(s.price)}</option>`).join("")}</select>` : `<h2>${esc(d.services[0].name)}</h2><p class="muted">${d.services[0].min} мин · ${money(d.services[0].price)}</p>`}
      <p class="muted" id="svcNote"></p>
      <div class="tabs"><button data-t="queue">Помыть сейчас</button><button data-t="book">Записаться на время</button></div>
      <div id="tab"></div>
    </div>`;
  const svc = document.getElementById("svc");
  if (svc) { svc.value = S.service; svc.onchange = () => { S.service = svc.value; S.slot = null; viewWash(id); }; }
  document.querySelectorAll(".tabs button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; drawTab(); });
  drawBoxes(); drawTab();
}
function curSvc() { return S.detail.services.find(s => s.id === S.service) || S.detail.services[0]; }
function drawBoxes() {
  const d = S.detail, el = document.getElementById("boxes");
  if (!el) return;
  el.innerHTML = d.boxes.map(b => `<div class="box s-${b.state}"><b>${esc(b.name)}</b><span class="st">${STATE[b.state]}</span>
    ${b.until && b.state !== "nodata" ? `<div>до ~${hhmm(b.until)}</div>` : ""}
    ${b.next_booking ? `<div>бронь ${hhmm(b.next_booking)}</div>` : ""}
    ${b.warm ? `<span class="warm">Тёплый</span>` : ""}</div>`).join("");
  document.getElementById("upd").textContent = d.wash.stale ? "нет связи " + ago(d.wash.last_seen) : "обновлено " + ago(d.wash.last_seen);
  const n = document.getElementById("svcNote"); if (n) n.textContent = curSvc().note || "";
}
function contactFields() {
  return `<div class="grid2"><div><label>Телефон</label><input id="phone" inputmode="tel" placeholder="+7 7XX XXX XX XX" value="${esc(S.phone)}"></div>
    <div><label>Госномер</label><input id="car" placeholder="123ABC01" value="${esc(S.car)}"></div></div>`;
}
function readContact() {
  S.phone = document.getElementById("phone").value.trim(); S.car = document.getElementById("car").value.trim();
  localStorage.phone = S.phone; localStorage.car = S.car;
  return { phone: S.phone, car: S.car };
}
function drawTab() {
  document.querySelectorAll(".tabs button").forEach(b => b.classList.toggle("on", b.dataset.t === S.tab));
  const el = document.getElementById("tab"), d = S.detail, w = d.wash, r = d.rules;
  if (S.tab === "queue") {
    const wait = d.queue_wait;
    el.innerHTML = `<h3>Живая очередь на ближайший бокс</h3>
      <div class="stats"><div class="stat"><b>${w.stale ? "—" : w.free}</b><span>свободно сейчас</span></div>
        <div class="stat"><b>${w.queue}</b><span>в очереди</span></div>
        <div class="stat"><b>${w.stale || wait == null ? "—" : wait === 0 ? "0–5 мин" : "~" + wait + " мин"}</b><span>ожидание (прогноз)</span></div></div>
      ${w.stale ? `<div class="stale">Нет актуальных данных о боксах — прогноз ожидания недоступен. Очередь работает, вызов придёт, когда администратор отметит свободный бокс.</div>` : ""}
      <ul class="muted">
        <li>Когда бокс освобождается, его получает <b>первый в очереди</b> — вам придёт вызов «Бокс N ваш».</li>
        <li>После вызова бокс держится за вами <b>${r.call} минут</b>. Не успели — место переходит следующему.</li>
        <li>Поэтому вставайте в очередь, когда до мойки ≤ ${r.call} минут езды.</li>
        <li>Если бокс скоро забронирован другим клиентом, вам дадут бокс, где вы точно успеете.</li>
      </ul>
      ${contactFields()}
      <p><button class="primary big" id="go">Встать в очередь</button></p>`;
    document.getElementById("go").onclick = async () => {
      try { await api("/api/queue", { wash: w.id, service: S.service, ...readContact() }); toast("Вы в очереди"); location.hash = "#/my"; }
      catch (e) { toast(e.message, true); }
    };
    return;
  }
  el.innerHTML = `<h3>Выберите время</h3>
    <div class="row"><button data-day="0" class="${S.day ? "" : "chip on"}">Сегодня</button><button data-day="1" class="${S.day ? "chip on" : ""}">Завтра</button></div>
    <p class="muted">Под предварительную запись открыта часть мощности мойки — остальное для живой очереди.</p>
    <div class="slots" id="slots"></div><div id="sum"></div>`;
  el.querySelectorAll("[data-day]").forEach(b => b.onclick = () => { S.day = +b.dataset.day; S.slot = null; viewWash(S.wash); });
  drawSlots();
}
function drawSlots() {
  const el = document.getElementById("slots");
  if (!el) return;
  const sl = S.detail.slots;
  el.innerHTML = sl.length ? sl.map(s => `<button data-s="${s.start}" ${s.ok ? "" : "disabled"} class="${S.slot === s.start ? "on" : ""}">${s.time}</button>`).join("")
    : `<span class="muted">На этот день свободного времени нет.</span>`;
  el.querySelectorAll("button").forEach(b => b.onclick = () => { S.slot = +b.dataset.s; drawSlots(); drawSummary(); });
  if (S.slot && !sl.some(s => s.start === S.slot && s.ok)) { S.slot = null; drawSummary(); }
}
function drawSummary() {
  const el = document.getElementById("sum"), d = S.detail, svc = curSvc(), st = d.settings, r = d.rules;
  if (!S.slot) { el.innerHTML = ""; return; }
  const pre = Math.min(st.prepay, svc.price), end = S.slot + svc.min * MIN;
  el.innerHTML = `<h3>Проверьте перед оплатой</h3>
    <table class="summary-table">
      <tr><td>Услуга</td><td>${esc(svc.name)}</td></tr>
      <tr><td>Время</td><td>${dayLabel(S.slot)}, ${hhmm(S.slot)}–${hhmm(end)}</td></tr>
      <tr><td>Длительность</td><td>${svc.min} мин</td></tr>
      <tr><td>Стоимость</td><td>${money(svc.price)}</td></tr>
      <tr><td>Предоплата через Kaspi (засчитывается в стоимость)</td><td>${money(pre)}</td></tr>
      <tr><td>Доплата на месте</td><td>${money(svc.price - pre)}</td></tr>
    </table>
    <ul class="muted">
      <li>После выбора время держится <b>${r.hold} минут</b> до оплаты, затем освобождается.</li>
      <li>Бронь подтверждается, когда мойка увидит поступление в Kaspi (не по скриншоту).</li>
      <li>Опоздание: льготные <b>${r.grace} минут</b>. Позже — перенос на свободное время без вытеснения следующего клиента. Окончание брони (${hhmm(end)}) не сдвигается.</li>
      <li>Отмена более чем за 1 час — полный возврат предоплаты; позже — по правилам мойки.</li>
      <li>Напомним за 10 и 5 минут до конца времени.</li>
      ${S.detail.wash.type === "self" ? `<li>Продление — по ${st.extend_step} мин, до ${st.max_total} мин всего, только если нет очереди и следующей брони.</li>` : ""}
    </ul>
    ${contactFields()}
    <p><button class="primary big" id="bookBtn">Забронировать и перейти к оплате</button></p>`;
  document.getElementById("bookBtn").onclick = async () => {
    try {
      await api("/api/book", { wash: S.wash, service: S.service, start: S.slot, ...readContact() });
      toast("Время зарезервировано — оплатите предоплату"); location.hash = "#/my";
    } catch (e) { toast(e.message, true); viewWash(S.wash); }
  };
}

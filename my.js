// «Моя запись»: статус брони/очереди, оплата Kaspi, вызов, таймер сеанса, продление, отзыв.
const ACTIVE = ["hold", "paid_claimed", "confirmed", "arrived", "waiting", "called", "entered"];

async function loadMy() {
  if (!S.phone) { S.my = []; return; }
  try { S.my = (await api("/api/my?phone=" + encodeURIComponent(S.phone))).items; }
  catch { S.my = []; }
}

async function viewMy() {
  setTitle("Моя запись");
  if (!S.phone) {
    $app.innerHTML = myHero() + `<div class="card"><h2>Найти мою запись</h2><label>Телефон</label><input id="ph" inputmode="tel" placeholder="+7 7XX XXX XX XX">
      <p><button class="primary big" id="f">Показать</button></p></div>`;
    document.getElementById("f").onclick = () => { S.phone = localStorage.phone = document.getElementById("ph").value.trim(); viewMy(); };
    return;
  }
  await loadMy();
  drawMy();
}

function drawMy() {
  if (!location.hash.startsWith("#/my")) return;
  const act = S.my.filter(x => ACTIVE.includes(x.status) || (x.status === "confirmed"));
  const past = S.my.filter(x => !act.includes(x));
  $app.innerHTML = myHero(`Телефон ${esc(S.phone)} · <a href="#" id="chg">сменить</a>`) + `
    ${act.length ? `<div class="my-active">${act.map(item).join("")}</div>` : `<div class="card"><h2>Активных записей нет</h2>
      <p class="muted">${RULE_TEXT}</p><a class="btn primary" href="#/">Выбрать мойку</a></div>`}
    ${past.length ? `<h3>Недавние</h3><div class="my-past">${past.map(item).join("")}</div>` : ""}`;
  document.getElementById("chg").onclick = e => { e.preventDefault(); S.phone = ""; localStorage.removeItem("phone"); viewMy(); };
  bindMy();
}

function myHero(sub = "") {
  return `<section class="hero hero-sm"><div class="hero-in"><p class="kicker">Бронь · очередь · сеанс</p><h1>Моя запись</h1>
    ${sub ? `<p class="lead">${sub}</p>` : ""}</div></section>`;
}

function steps(n) { return `<div class="steps">${[1, 2, 3, 4].map(i => `<span class="${i <= n ? "on" : ""}"></span>`).join("")}</div>`; }

function sessionBlock(x) {
  const s = x.session; if (!s) return "";
  const rem = (s.end - Date.now()) / MIN;
  const canExt = x.wash_type === "self" && s.total + x.extend_step <= x.max_total;
  return `<div class="countdown" data-until="${s.end}">${left(s.end)}</div>
    <p class="muted">Время в боксе до ${hhmm(s.end)} · всего ${s.total} мин. Отсчёт идёт с момента заезда.</p>
    ${rem <= 5 ? `<div class="warn">Осталось меньше 5 минут — завершайте мойку и освобождайте бокс.</div>`
      : rem <= 10 ? `<div class="warn">Осталось меньше 10 минут.</div>` : ""}
    ${canExt ? `<button data-a="extend">Продлить на ${x.extend_step} мин</button> <span class="muted">— если нет очереди и следующей брони</span>` : ""}`;
}

function item(x) {
  const head = `<div class="row spread"><b>${esc(x.wash_name)}</b><span class="muted">${esc(x.car)}</span></div>`;
  const id = `data-id="${x.id}"`;
  if (x.kind === "queue") {
    if (x.status === "waiting") return `<div class="card" ${id}>${head}${steps(1)}
      <div class="status-big">Вы №${x.position} в очереди</div>
      ${x.position === 1 ? `<div class="ok">Вы первый: следующий освободившийся бокс — ваш.</div>` : ""}
      <p>Ожидание: <b>${x.wait == null ? "нет данных" : x.wait === 0 ? "0–5 мин" : "~" + x.wait + " мин"}</b> <span class="muted">(прогноз, не гарантия)</span></p>
      <p class="muted">Не заезжайте в бокс, пока не придёт вызов — даже если бокс выглядит свободным. Он может быть обещан брони или тому, кто в очереди перед вами.</p>
      <button class="danger" data-a="cancel">Выйти из очереди</button></div>`;
    if (x.status === "called") return `<div class="card called" ${id}>${head}${steps(2)}
      <div class="status-big">${esc(x.box_name)} ваш — заезжайте!</div>
      <div class="countdown" data-until="${x.call_until}">${left(x.call_until)}</div>
      <p class="muted">Бокс держим до ${hhmm(x.call_until)}. Не успеете — место перейдёт следующему в очереди.</p>
      <button data-a="cancel">Отказаться</button></div>`;
    if (x.status === "entered") return `<div class="card" ${id}>${head}${steps(3)}<div class="status-big">${esc(x.box_name)}</div>${sessionBlock(x)}</div>`;
    return `<div class="card" ${id}>${head}<p>${Q_STATUS[x.status] || x.status}</p>${reviewBlock(x)}
      ${x.status === "skipped" ? `<a class="btn" href="#/wash/${x.wash}">Встать в очередь снова</a>` : ""}</div>`;
  }
  const when = `${dayLabel(x.start)}, ${hhmm(x.start)}–${hhmm(x.end)}`;
  const top = `${head}<div class="muted">${esc(x.svc_name)} · ${when}${x.box_name ? " · " + esc(x.box_name) : ""}</div>`;
  if (x.status === "hold") return `<div class="card" ${id}>${top}${steps(1)}
    <div class="status-big">Оплатите предоплату ${money(x.prepay)}</div>
    <p>Время держим ещё <b data-until="${x.hold_until}">${left(x.hold_until)}</b>.</p>
    <ol class="muted"><li>Мойка выставит счёт Kaspi на ваш номер ${esc(x.phone)} или оплатите по ссылке мойки. Получатель: ${esc(x.kaspi)}.</li>
      <li>Предоплата засчитывается в стоимость (${money(x.price)}), на месте доплата ${money(x.price - x.prepay)}.</li>
      <li>Бронь подтвердится, когда мойка увидит операцию в Kaspi.</li></ol>
    <button class="primary" data-a="paid">Я оплатил</button> <button class="danger" data-a="cancel">Отменить</button></div>`;
  if (x.status === "paid_claimed") return `<div class="card" ${id}>${top}${steps(2)}
    <div class="status-big">Проверяем оплату</div>
    <p class="muted">Мойка сверяет поступление со своей стороны Kaspi. Резерв держим до ${hhmm(x.hold_until)}. Если оплата придёт позже — проверим, свободно ли время, иначе вернём деньги.</p>
    <button class="danger" data-a="cancel">Отменить</button></div>`;
  if (x.status === "confirmed" && x.problem) return `<div class="card" ${id}>${top}
    <div class="warn">Бокс неисправен — мойка не сможет принять вас в это время. Перенесите бронь (только с вашего согласия) или отмените с полным возвратом.</div>
    <button class="primary" data-a="resched">Перенести</button> <button class="danger" data-a="cancel">Отменить с возвратом</button>${reschedBlock(x)}</div>`;
  if (x.status === "confirmed") return `<div class="card" ${id}>${top}${steps(3)}
    <div class="status-big">Бронь подтверждена ✓</div>
    <div class="ok">Приезжайте к ${hhmm(x.start)}. Бокс зарезервирован за вами за 15 минут до начала. Льготный период — 10 минут, позже бронь нужно будет перенести.</div>
    <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${x.lat},${x.lng}">Маршрут</a>
    <button class="danger" data-a="cancel">Отменить</button>
    <p class="muted">Отмена более чем за 1 час — полный возврат предоплаты; позже — по правилам мойки.</p></div>`;
  if (x.status === "arrived") return `<div class="card" ${id}>${top}${steps(4)}<div class="status-big">${esc(x.box_name || "Вы в боксе")}</div>${sessionBlock(x)}</div>`;
  if (x.status === "missed") return `<div class="card" ${id}>${top}
    <div class="warn">Вы опоздали больше чем на 10 минут, и время перешло следующим клиентам. ${x.paid ? "Предоплата сохранена — выберите новое время." : ""}</div>
    ${x.paid ? `<button class="primary" data-a="resched">Перенести</button>${reschedBlock(x)}` : ""}</div>`;
  const refund = x.refund === "full" ? "Предоплата будет возвращена полностью." : x.refund === "rules" ? "Возврат предоплаты — по правилам мойки." : "";
  return `<div class="card" ${id}>${top}<p>${B_STATUS[x.status] || x.status}. ${x.status === "refund" ? "Оплата пришла после окончания резерва, а время уже занято — мойка вернёт деньги." : refund}</p>${reviewBlock(x)}</div>`;
}

function reschedBlock(x) {
  if (S.resched?.id !== x.id) return "";
  const r = S.resched;
  return `<h3>Новое время</h3><div class="row"><button data-rd="0" class="${r.day ? "" : "chip on"}">Сегодня</button><button data-rd="1" class="${r.day ? "chip on" : ""}">Завтра</button></div>
    <div class="slots" style="margin-top:8px">${(r.slots || []).map(s => `<button data-rs="${s.start}" ${s.ok ? "" : "disabled"}>${s.time}</button>`).join("") || '<span class="muted">Нет свободного времени</span>'}</div>`;
}

function reviewBlock(x) {
  if (x.reviewed) return `<p class="muted">Спасибо за отзыв.</p>`;
  if (x.status !== "done" && x.status !== "wash_cancelled") return "";
  const q = x.status === "done"
    ? (x.wash_type === "self" ? "Оцените исправность оборудования, напор, чистоту бокса" : "Оцените качество мойки, обслуживание, соответствие цены")
    : "Мойка сорвала запись — оцените надёжность бронирования";
  return `<h3>${q}</h3><div class="stars">${[1, 2, 3, 4, 5].map(i => `<button data-star="${i}">★</button>`).join("")}</div>
    <textarea rows="2" placeholder="Комментарий (необязательно)"></textarea><p><button data-a="review">Отправить отзыв</button></p>`;
}

function bindMy() {
  $app.querySelectorAll(".card[data-id]").forEach(c => {
    const id = c.dataset.id, x = S.my.find(i => i.id === id);
    let stars = 0;
    c.querySelectorAll("[data-star]").forEach(b => b.onclick = () => {
      stars = +b.dataset.star; c.querySelectorAll("[data-star]").forEach(s => s.classList.toggle("on", +s.dataset.star <= stars));
    });
    c.querySelectorAll("[data-a]").forEach(b => b.onclick = async () => {
      const a = b.dataset.a, base = { id, phone: S.phone };
      try {
        if (a === "cancel") { if (!confirm("Точно отменить?")) return; await api("/api/cancel", base); }
        if (a === "paid") await api("/api/paid", base);
        if (a === "extend") { await api("/api/extend", base); toast("Сеанс продлён"); }
        if (a === "review") { await api("/api/review", { ...base, stars, text: c.querySelector("textarea").value }); toast("Отзыв сохранён"); }
        if (a === "resched") { await openResched(x, 0); return; }
        await refreshMy();
      } catch (e) { toast(e.message, true); }
    });
    c.querySelectorAll("[data-rd]").forEach(b => b.onclick = () => openResched(x, +b.dataset.rd));
    c.querySelectorAll("[data-rs]").forEach(b => b.onclick = async () => {
      try { await api("/api/reschedule", { id, phone: S.phone, start: +b.dataset.rs }); S.resched = null; toast("Бронь перенесена"); await refreshMy(); }
      catch (e) { toast(e.message, true); openResched(x, S.resched.day); }
    });
  });
}

async function openResched(x, day) {
  const d = await api(`/api/wash?id=${x.wash}&service=${x.service}&day=${day}`);
  S.resched = { id: x.id, day, slots: d.slots };
  drawMy();
}

async function refreshMy() { await loadMy(); drawMy(); myBar(); }

// ---------- нижняя плашка и напоминания
function myBar() {
  const a = S.my.find(x => ACTIVE.includes(x.status));
  const bar = document.getElementById("mybar");
  document.getElementById("myBtn").hidden = !S.phone;
  bar.hidden = !a || location.hash.startsWith("#/my");
  if (!a) return;
  const t = a.kind === "queue"
    ? (a.status === "waiting" ? `Очередь: вы №${a.position}` : a.status === "called" ? `${a.box_name} ваш — заезжайте` : `${a.box_name}: до ${hhmm(a.session?.end || 0)}`)
    : `${B_STATUS[a.status]}: ${hhmm(a.start)}`;
  document.getElementById("mybarText").textContent = `${a.wash_name} · ${t}`;
}

function remind() {
  for (const x of S.my) {
    const end = x.session?.end;
    const keys = [];
    if (end) for (const m of [10, 5]) if (end - Date.now() <= m * MIN && end > Date.now()) keys.push([`${x.id}:${m}`, `Осталось меньше ${m} минут в боксе`]);
    if (x.status === "called") keys.push([`${x.id}:call`, `${x.box_name} свободен — заезжайте!`]);
    for (const [k, msg] of keys) {
      if (localStorage["n:" + k]) continue;
      localStorage["n:" + k] = 1;
      toast(msg);
      if (window.Notification?.permission === "granted") new Notification("Мойка без очереди", { body: msg });
    }
  }
}

// ---------- обновление в реальном времени
setInterval(() => document.querySelectorAll("[data-until]").forEach(e => (e.textContent = left(+e.dataset.until))), 1000);
setInterval(async () => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  await loadMy(); myBar(); remind();
  if (typing) return;
  const h = location.hash;
  if (h.startsWith("#/my")) { if (!S.resched) drawMy(); }
  else if (h.startsWith("#/wash/")) {
    try { S.detail = await api(`/api/wash?id=${S.wash}&service=${S.service}&day=${S.day}`); drawBoxes(); if (S.tab === "book") drawSlots(); }
    catch {}
  } else loadList();
}, 5000);

if (window.Notification && Notification.permission === "default") document.addEventListener("click", () => Notification.requestPermission(), { once: true });
loadMy().then(myBar);
route();

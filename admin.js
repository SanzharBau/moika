// Кабинет администратора: отметки по боксам, очередь, подтверждение оплаты Kaspi, настройки.
const $app = document.getElementById("app");
const A = { wash: localStorage.admWash || "w1", pin: localStorage.admPin || "", data: null };

async function call(body) {
  const h = { "X-Pin": A.pin };
  return body ? api("/api/admin", { wash: A.wash, ...body }, h) : api("/api/admin?wash=" + A.wash, null, h);
}

async function init() {
  const list = await api("/api/washes");
  const sel = document.getElementById("washSel");
  sel.innerHTML = list.map(w => `<option value="${w.id}">${esc(w.name)}</option>`).join("");
  sel.value = A.wash;
  sel.onchange = () => { A.wash = localStorage.admWash = sel.value; load(); };
  document.getElementById("logout").onclick = () => { A.pin = ""; localStorage.removeItem("admPin"); login(); };
  A.pin ? load() : login();
}

function login(msg = "") {
  $app.innerHTML = `<section class="hero hero-sm"><div class="hero-in"><p class="kicker">Для владельцев и администраторов</p><h1>Кабинет мойки</h1></div></section>
    <div class="card" style="max-width:420px;margin:40px 0"><h2>Вход для мойки</h2>
    <p class="muted">PIN выдаётся владельцу мойки.</p>
    ${msg ? `<div class="warn">${esc(msg)}</div>` : ""}
    <input id="pin" type="password" inputmode="numeric" placeholder="PIN"><p><button class="primary big" id="go">Войти</button></p></div>`;
  document.getElementById("go").onclick = () => { A.pin = localStorage.admPin = document.getElementById("pin").value; load(); };
}

async function load() {
  try { A.data = await call(); draw(); }
  catch (e) { if (/PIN/.test(e.message)) login(e.message); else toast(e.message, true); }
}

async function act(body) {
  try { A.data = await call(body); A.dirty = false; draw(); return true; } catch (e) { toast(e.message, true); return false; }
}

function boxCard(b) {
  const s = b.session, q = b.called, bk = b.booking;
  let who = "", acts = [];
  if (s) who = `${s.kind === "booking" ? "По брони" : s.kind === "queue" ? "Из очереди" : "Сеанс"} · до ${hhmm(s.end)} <span class="muted">(${left(s.end)})</span>`;
  else if (q) who = `Вызван из очереди: <b>${esc(q.car)}</b> · ждём до ${hhmm(q.called_at + 10 * MIN)}`;
  else if (bk) who = `Бронь ${hhmm(bk.start)}–${hhmm(bk.end)}: <b>${esc(bk.car)}</b>${bk.status !== "confirmed" ? ` <span class="pill s-reserved">${B_STATUS[bk.status]}</span>` : ""}`;
  if (!b.down) {
    if (!s && (q || bk)) acts.push(`<button class="primary" data-a="enter">Заехал</button>`);
    if (s) acts.push(`<button class="primary" data-a="finish">Завершил</button>`);
    if (b.state === "prep") acts.push(`<button class="primary" data-a="ready">Бокс готов</button>`);
    if (q) acts.push(`<button data-q="${q.id}">Не приехал</button>`);
  }
  acts.push(`<button class="${b.down ? "primary" : "danger"}" data-a="down">${b.down ? "Исправен" : "Неисправность"}</button>`);
  return `<div class="adm-box s-${b.state}" data-box="${b.id}">
    <div class="row spread"><b>${esc(b.name)}</b>${pill(b.state)}</div>
    ${b.warm ? `<span class="warm" style="margin:0 0 8px">Тёплый</span>` : ""}
    <div class="muted" style="min-height:2.6em">${who || (b.next_booking ? "Следующая бронь " + hhmm(b.next_booking) : "—")}</div>
    <div class="acts">${acts.join("")}</div></div>`;
}

function draw() {
  const d = A.data, w = d.wash, st = d.settings;
  setTitle("Кабинет: " + w.name);
  const waitingQ = d.queue.filter(q => q.status === "waiting");
  const svcOpts = d.services.map(s => `<option value="${s.id}">${esc(s.name)} (${s.min} мин)</option>`).join("");
  $app.innerHTML = `
    <section class="hero hero-sm"><div class="hero-in">
      <p class="kicker">Кабинет мойки · ${w.type === "self" ? "самомойка" : "мойка с персоналом"}</p>
      <h1>${esc(w.name)}</h1>
      <p class="lead">Свободно <b>${w.free ?? "—"} из ${w.total}</b> · в очереди <b>${waitingQ.length}</b> · броней сегодня и завтра <b>${d.bookings.filter(b => ["hold", "paid_claimed", "confirmed"].includes(b.status)).length}</b></p>
    </div></section>
    <div class="rule-mini">Правило мойки: <b>в бокс заезжают только по брони или по вызову из очереди.</b> Клиента без записи добавьте в очередь — система сама назначит бокс, учитывая ближайшие брони.</div>
    <div class="card"><div class="row spread"><h2>Боксы</h2><span class="muted">Свободно ${w.free ?? "—"} из ${w.total} · в очереди ${waitingQ.length}</span></div>
      <div class="adm-grid">${d.boxes.map(boxCard).join("")}</div></div>

    <div class="grid2" style="align-items:start">
      <div class="card"><h2>Живая очередь</h2>
        ${d.queue.length ? `<table class="list"><tr><th>#</th><th>Авто</th><th>Статус</th><th></th></tr>${d.queue.map((q, i) => `<tr>
          <td>${q.status === "waiting" ? waitingQ.indexOf(q) + 1 : "→"}</td>
          <td><b>${esc(q.car)}</b><div class="muted">${esc(q.phone || "без телефона")} · ${q.channel === "onsite" ? "на месте" : "сайт"} · ${esc(q.svc_name)}</div></td>
          <td>${q.status === "called" ? `Вызван в ${esc(d.boxes.find(b => b.id === q.box)?.name || "")}` : "Ждёт " + ago(q.created).replace(" назад", "")}</td>
          <td><button data-q="${q.id}">Убрать</button></td></tr>`).join("")}</table>` : `<p class="muted">Очередь пуста.</p>`}
        <h3>Добавить клиента, который приехал без записи</h3>
        <div class="grid2"><div><label>Госномер</label><input id="qCar" placeholder="123ABC01"></div>
          <div><label>Телефон (для вызова)</label><input id="qPhone" inputmode="tel" placeholder="необязательно"></div></div>
        ${d.services.length > 1 ? `<label>Услуга</label><select id="qSvc">${svcOpts}</select>` : ""}
        <p><button class="primary" id="qAdd">В очередь</button></p>
      </div>

      <div class="card"><h2>Брони</h2>
        ${d.bookings.length ? `<table class="list">${d.bookings.map(bk => `<tr>
          <td><b>${dayLabel(bk.start)} ${hhmm(bk.start)}</b><div class="muted">${esc(d.boxes.find(b => b.id === bk.box)?.name || "")}</div></td>
          <td><b>${esc(bk.car)}</b><div class="muted">${esc(bk.phone)} · ${esc(bk.svc_name)}</div>
            <div class="muted">Предоплата ${money(bk.prepay)}${bk.op ? " · опер. " + esc(bk.op) : ""}${bk.problem ? ` · <b style="color:var(--busy)">бокс неисправен</b>` : ""}</div></td>
          <td>${B_STATUS[bk.status] || bk.status}
            ${["hold", "paid_claimed", "expired"].includes(bk.status) ? `<div class="row" style="margin-top:4px"><input placeholder="№ операции Kaspi" data-op="${bk.id}"><button data-pay="${bk.id}">Оплата поступила</button></div>` : ""}
            ${["hold", "paid_claimed", "confirmed"].includes(bk.status) ? `<div><button class="danger" data-wc="${bk.id}" style="margin-top:4px;font-size:13px">Отменить (мойка)</button></div>` : ""}</td></tr>`).join("")}</table>`
          : `<p class="muted">Броней пока нет.</p>`}
        <p class="muted">Подтверждайте оплату только по операции в своём кабинете Kaspi, не по скриншоту клиента. Каждая операция учитывается один раз.</p>
      </div>
    </div>

    <div class="grid2" style="align-items:start">
      <div class="card"><h2>Профиль мойки</h2>
        <p class="muted">Это видят водители на странице мойки: история, удобства и фото.</p>
        <label>О мойке</label><textarea id="pStory" rows="5">${esc(d.profile.story)}</textarea>
        <label>Удобства (через запятую)</label><input id="pFeat" value="${esc(d.profile.features.join(", "))}">
        <label>Фото — по одной ссылке https:// на строку, до 12</label><textarea id="pPhotos" rows="4" placeholder="https://...jpg">${esc(d.profile.photos.join("\n"))}</textarea>
        <p><button class="primary" id="saveProfile">Сохранить профиль</button> <a class="btn" href="app.html#/wash/${w.id}" target="_blank">Открыть страницу</a></p>
      </div>
      <div class="card"><h2>Продвижение</h2>
        <p>Сейчас: <b>${{ none: "базовое размещение", top: "выше в списке", premium: "премиум" }[d.promo.tier]}</b>${d.promo.tier !== "none" ? ` до ${new Date(d.promo.until).toLocaleDateString("ru-RU")}` : ""}</p>
        ${d.promo.offer ? `<div class="ok">Спецпредложение: <b>${esc(d.promo.offer.title)}</b></div>` : ""}
        <p class="muted">Платные места всегда помечаются «Реклама» и не меняют рейтинг.</p>
        <label>Что подключить</label><select id="prProd">${Object.entries(d.products).filter(([k]) => k !== "banner").map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join("")}</select>
        <label>Телефон для связи</label><input id="prPhone" inputmode="tel" placeholder="+7 7XX XXX XX XX">
        <label>Комментарий</label><input id="prCom" placeholder="Например: акция на утро будней">
        <p><button class="hot" id="prSend">Отправить заявку</button></p>
      </div>
    </div>

    <div class="card"><h2>Правила этой мойки</h2>
      <div class="grid2">
        ${field("book_share", "Доля мощности под предварительную бронь (0–1)", st.book_share, "0.05")}
        ${field("prepay", "Предоплата, ₸ (засчитывается в стоимость)", st.prepay)}
        ${w.type === "self" ? field("session_min", "Сеанс самомойки, мин", st.session_min) + field("extend_step", "Шаг продления, мин", st.extend_step)
          + field("max_total", "Максимум за посещение, мин", st.max_total) + field("min_free", "Продлевать, если свободно не меньше N боксов", st.min_free)
          : field("staff", "Мойщиков на смене", st.staff)}
        ${field("open", "Открытие, ч", st.open)}${field("close", "Закрытие, ч", st.close)}
      </div>
      <p class="muted">Изменения действуют для новых записей и продлений. Уже подтверждённое время не сокращается.</p>
      <button class="primary" id="saveSet">Сохранить правила</button>
    </div>
    ${d.reviews.length ? `<div class="card"><h2>Отзывы</h2>${d.reviews.map(r => `<p>${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)} <span class="muted">${r.kind === "booking" ? "о бронировании" : "о мойке"}</span><br>${esc(r.text)}</p>`).join("")}</div>` : ""}
    <footer class="note">Кабинет открыт — мойка считается «на связи». Если связь пропадёт больше чем на 15 минут, клиенты увидят «Нет актуальных данных» вместо зелёных боксов.</footer>`;
  bind();
}

function field(k, label, v, step = "1") {
  return `<div><label>${label}</label><input type="number" step="${step}" data-set="${k}" value="${v ?? ""}"></div>`;
}

function bind() {
  $app.querySelectorAll("[data-box] [data-a]").forEach(b => b.onclick = () => {
    const box = b.closest("[data-box]").dataset.box, a = b.dataset.a;
    if (a === "down" && !confirm("Изменить исправность бокса? Брони на этом боксе получат уведомление.")) return;
    act({ action: a, box });
  });
  $app.querySelectorAll("[data-q]").forEach(b => b.onclick = () => act({ action: "skip", queue: b.dataset.q }));
  $app.querySelectorAll("[data-pay]").forEach(b => b.onclick = () =>
    act({ action: "pay", booking: b.dataset.pay, op: $app.querySelector(`[data-op="${b.dataset.pay}"]`).value }));
  $app.querySelectorAll("[data-wc]").forEach(b => b.onclick = () => {
    if (confirm("Отменить бронь со стороны мойки? Клиенту вернётся предоплата, это влияет на рейтинг надёжности.")) act({ action: "wash_cancel", booking: b.dataset.wc });
  });
  document.getElementById("qAdd").onclick = () => act({
    action: "queue_add", car: document.getElementById("qCar").value, phone: document.getElementById("qPhone").value,
    service: document.getElementById("qSvc")?.value,
  });
  document.getElementById("saveProfile").onclick = () => act({ action: "profile", story: pStory.value, features: pFeat.value, photos: pPhotos.value })
    .then(ok => ok && toast("Профиль сохранён"));
  document.getElementById("prSend").onclick = () => act({ action: "promo_request", product: prProd.value, phone: prPhone.value, comment: prCom.value })
    .then(ok => ok && toast("Заявка отправлена — мы свяжемся с вами"));
  document.getElementById("saveSet").onclick = () => {
    const s = { action: "settings" };
    $app.querySelectorAll("[data-set]").forEach(i => (s[i.dataset.set] = i.value));
    act(s).then(ok => ok && toast("Сохранено"));
  };
}

$app.addEventListener("input", e => { if (e.target.matches("textarea, input:not([data-op])")) A.dirty = true; });
setInterval(() => {
  const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName);
  if (A.pin && A.data && !typing && !A.dirty) load();
}, 5000);
init();

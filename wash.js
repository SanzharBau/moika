// Страница мойки: шапка с рейтингом и ценой, история и фото, прайс, живые боксы, очередь/бронь, отзывы,
// закреплённая снизу панель «Очередь / Бронь». Переопределяет viewWash из app.js.
async function viewWash(id) {
  S.wash = id;
  try {
    const d = await api(`/api/wash?id=${id}&service=${S.service || ""}&day=${S.day}`);
    S.service = d.service; S.detail = d;
  } catch (e) { return toast(e.message, true); }
  const d = S.detail, w = d.wash;
  setTitle(w.name);
  document.body.classList.add("has-wbar");
  const P = i => photoHtml(d.photos, i, w.id + i);
  const fmtDate = ms => new Date(ms).toLocaleDateString("ru-RU", { day: "numeric", month: "long" });
  $app.innerHTML = `
    <section class="W-head">
      <p class="kicker">${w.type === "self" ? "Самомойка" : "Мойка с персоналом"} · ${esc(w.address)}</p>
      <h1>${esc(w.name)}</h1>
      <div class="W-facts">
        <div><b>★ ${w.rating ?? "—"}</b><span>${w.reviews} отзывов</span></div>
        <div><b>${money(w.price_from)}</b><span>цена от</span></div>
        <div><b>${w.stale ? "—" : `${w.free}/${w.total}`}</b><span>свободно сейчас</span></div>
        <div><b>${Math.round(w.on_time * 100)}%</b><span>записей вовремя</span></div>
      </div>
      ${d.offer ? `<div class="W-offer"><span class="tag offer" style="background:#fff">Спецпредложение</span>
        <b>${esc(d.offer.title)}</b><span>${esc(d.offer.text)} До ${fmtDate(d.offer.until)}.</span></div>` : ""}
    </section>

    <section class="W-story">
      <div class="W-ph big">${P(0)}</div>
      <div class="W-text">
        <h2>О мойке</h2>
        <p>${esc(d.story || "Мойка ещё не рассказала о себе.")}</p>
        ${d.since ? `<p class="muted">Работаем с ${esc(d.since)} года</p>` : ""}
        <div class="tags">${(d.features || []).map(f => `<span class="tag">${esc(f)}</span>`).join("")}</div>
        <div class="row" style="margin-top:18px"><button class="hot" data-go="queue">Встать в очередь</button>
          <a class="btn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${w.lat},${w.lng}">Маршрут</a></div>
      </div>
      <div class="W-ph small">${P(1)}</div>
    </section>
    <div class="W-gallery">${[2, 3, 4].map(i => `<div class="W-ph">${P(i)}</div>`).join("")}</div>
    ${d.photos.length ? "" : `<p class="muted" style="text-align:center">Фото появятся, когда мойка загрузит их в кабинете.</p>`}

    <div class="rule-mini"><b>${RULE_TEXT}</b> «Свободно сейчас» ещё не значит, что бокс ваш: пока вы едете, его могут занять. Место за вами — только после брони или вызова из очереди.</div>

    <section class="card W-menu">
      <h2>Услуги и цены</h2>
      ${d.services.map(s => `<div class="W-item"><div><b>${esc(s.name)}</b><span class="muted">${s.min} мин${s.note ? " · " + esc(s.note) : ""}</span></div><i></i><strong>${money(s.price)}</strong></div>`).join("")}
    </section>

    <section class="card"><div class="row spread"><h2>Боксы сейчас</h2><span class="muted" id="upd"></span></div>${legend()}<div id="boxes" class="boxes"></div></section>

    <section class="card" id="bookCard">
      <h2>Очередь или бронь</h2>
      ${d.services.length > 1 ? `<label>Услуга</label><select id="svc">${d.services.map(s => `<option value="${s.id}">${esc(s.name)} — ${s.min} мин, ${money(s.price)}</option>`).join("")}</select>` : `<p class="muted">${esc(d.services[0].name)} · ${d.services[0].min} мин · ${money(d.services[0].price)}</p>`}
      <p class="muted" id="svcNote"></p>
      <div class="tabs"><button data-t="queue">Помыть сейчас</button><button data-t="book">Записаться на время</button></div>
      <div id="tab"></div>
    </section>

    <section class="card W-reviews">
      <div class="row spread"><h2>Отзывы</h2><span class="W-score">★ ${w.rating ?? "—"} <small>· ${w.reviews}</small></span></div>
      <p class="muted">Только после подтверждённого посещения. Мойка может ответить, но не может удалить отзыв или купить рейтинг.</p>
      ${d.review_list.length ? d.review_list.map(r => `<article class="W-rev"><div class="row spread"><span class="stars-s">${"★".repeat(r.stars)}${"☆".repeat(5 - r.stars)}</span>
        <span class="muted">${r.kind === "booking" ? "о бронировании · " : ""}${fmtDate(r.created)}</span></div><p>${esc(r.text)}</p>
        ${r.reply ? `<p class="muted">Ответ мойки: ${esc(r.reply)}</p>` : ""}</article>`).join("") : '<p class="muted">Отзывов с текстом пока нет.</p>'}
    </section>

    <div class="W-bar"><button data-go="queue">Встать в очередь</button><button data-go="book">Забронировать</button></div>`;

  const svc = document.getElementById("svc");
  if (svc) { svc.value = S.service; svc.onchange = () => { S.service = svc.value; S.slot = null; viewWash(id); }; }
  document.querySelectorAll("#bookCard .tabs button").forEach(b => b.onclick = () => { S.tab = b.dataset.t; drawTab(); });
  document.querySelectorAll("[data-go]").forEach(b => b.onclick = () => {
    S.tab = b.dataset.go; drawTab();
    document.getElementById("bookCard").scrollIntoView({ behavior: "smooth", block: "start" });
  });
  drawBoxes(); drawTab();
}

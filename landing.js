// Главная: статистика, спецпредложения, рекомендуемые мойки, отзывы — из /api/home.
(async () => {
  let d;
  try { d = await api("/api/home"); } catch { document.getElementById("offersRail").innerHTML = '<span class="muted">Не удалось загрузить предложения.</span>'; return; }
  document.getElementById("stats").innerHTML =
    `<span><b>${d.stats.washes}</b>моек</span><span><b>${d.stats.boxes}</b>боксов</span><span><b>24/7</b>онлайн-очередь</span>`;

  const rail = document.getElementById("offersRail");
  rail.innerHTML = d.offers.length ? d.offers.map(o => `<a class="L-offer" href="app.html#/wash/${o.wash}">
      <span class="tag offer" style="align-self:flex-start">Спецпредложение</span>
      <b>${esc(o.title)}</b><span>${esc(o.text)}</span>
      <span class="muted">${esc(o.name)} · до ${new Date(o.until).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}</span></a>`).join("")
    : '<span class="muted">Сейчас спецпредложений нет — загляните позже.</span>';

  if (d.featured.length) {
    document.getElementById("featured").hidden = false;
    document.getElementById("featRail").innerHTML = d.featured.map(w => `<a href="app.html#/wash/${w.id}">
      <div>${photoHtml(w.photos, 0, w.id)}</div>
      <div><span class="tag ad">Реклама</span><b>${esc(w.name)}</b>
        <span class="muted">★ ${w.rating ?? "—"} · ${w.reviews} отзывов · ${w.stale ? "нет данных о боксах" : `свободно ${w.free} из ${w.total}`}</span></div></a>`).join("");
  }
  if (d.reviews.length) {
    document.getElementById("quotesSec").hidden = false;
    document.getElementById("quotes").innerHTML = d.reviews.map(r => `<blockquote><div class="stars-s">${"★".repeat(r.stars)}</div>
      «${esc(r.text)}»<cite>${esc(r.wash)}</cite></blockquote>`).join("");
  }
})();

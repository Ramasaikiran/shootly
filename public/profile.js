import { get } from "./app.js";
import { esc, inr } from "./components.js";
const box = document.querySelector("#app"), id = new URLSearchParams(location.search).get("c") || "";
const stars = r => r.count ? `★ ${esc(r.avg)} · ${esc(r.count)} review${r.count === 1 ? "" : "s"}` : "No reviews yet";
try {
  const { creator: c } = await get("/api/creators/" + encodeURIComponent(id));
  document.title = `${c.name}, ${c.area} | Shootly`;
  box.innerHTML = `<div class="phead"><div><h1 class="h1">${esc(c.name)}</h1><p class="mute">${esc(c.area)} · ${esc(c.exp)} · ${stars(c.rating)} · <span class="tag ok">ID verified</span></p></div><a class="btn alt" href="customer.html">Back to creators</a></div>
${c.bio ? `<div class="card"><p>${esc(c.bio)}</p></div>` : ""}
<div class="chips">${c.types.map(t => `<span class="tag">${esc(t)}</span>`).join(" ")}</div>
${c.portfolio.length ? `<h2 class="sec2">Portfolio</h2><div class="pgrid big">${c.portfolio.map(p => `<figure><img src="${esc(p.url)}" alt="${esc(p.caption || "Work by " + c.name)}" loading="lazy">${p.caption ? `<figcaption class="mute">${esc(p.caption)}</figcaption>` : ""}</figure>`).join("")}</div>` : ""}
<h2 class="sec2">Packages</h2><div class="stack">${c.pk.map((p, i) => `<div class="card pkr"><div><b>${esc(p.n)}</b><div class="mute">${esc(p.h)} hr · ${esc(p.d)} · files in ${esc(p.days)} days</div></div><div class="pkp"><b>${inr(p.p)}</b> <a class="btn sm" href="customer.html?book=${encodeURIComponent(c.id)}~${i}">Request</a></div></div>`).join("")}</div>
<h2 class="sec2">Reviews</h2>${c.reviews.length ? `<div class="stack">${c.reviews.map(r => `<div class="card"><b>${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}</b> <span class="mute">${esc(r.by)} · ${esc(r.date)}</span>${r.comment ? `<p>${esc(r.comment)}</p>` : ""}</div>`).join("")}</div>` : `<p class="mute">No reviews yet.</p>`}`;
} catch (e) { box.innerHTML = `<div class="card" style="max-width:460px;margin:2rem auto"><h1 class="h1">Creator not found</h1><p>${esc(e.message)}</p><a class="btn" href="customer.html">Find a creator</a></div>`; }

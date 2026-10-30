import { post } from "./app.js";
import { esc } from "./components.js";
const box = document.querySelector("#app"), t = new URLSearchParams((location.hash||"").slice(1)).get("t");
const show = (h, p, link) => { box.innerHTML = `<div class="card" style="max-width:460px;margin:2rem auto"><h1 class="h1">${esc(h)}</h1><p>${esc(p)}</p>${link ? `<a class="btn" href="${link}">Continue</a>` : ""}</div>`; };
if (!t) show("Link incomplete", "Open the full link from your email, or sign in and tap Resend link.", "auth.html");
else try { await post("/api/auth/verify", { token: t }); history.replaceState(null, "", "verify.html"); show("Email verified", "Thanks. You can now book and get listed.", "auth.html"); }
catch (e) { show("Could not verify", e.message + " Sign in and tap Resend link for a new one.", "auth.html"); }

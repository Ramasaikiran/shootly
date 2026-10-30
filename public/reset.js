import { post } from "./app.js";
import { esc } from "./components.js";
import { passwordIssues } from "./policy.js";
const box = document.querySelector("#app"), t = new URLSearchParams((location.hash||"").slice(1)).get("t");
const shell = (h, body) => { box.innerHTML = `<div class="card" style="max-width:460px;margin:2rem auto"><h1 class="h1">${esc(h)}</h1>${body}</div>`; return box.querySelector("form"); };
if (t) {
  const f = shell("Choose a new password", `<form novalidate><label>New password<input name="password" type="password" autocomplete="new-password" maxlength="128" required></label><p class="fe" role="alert" id="e"></p><button class="btn lg" type="submit">Set password</button></form>`);
  f.addEventListener("submit", async ev => {
    ev.preventDefault(); const e = box.querySelector("#e"); e.textContent = "";
    const issue = passwordIssues(f.elements.password.value, "")[0]; if (issue) return void (e.textContent = issue);
    try { await post("/api/auth/reset", { token: t, password: f.elements.password.value }); history.replaceState(null, "", "reset.html"); shell("Password changed", `<p>You are signed out everywhere. <a class="btn" href="auth.html">Sign in</a></p>`); }
    catch (er) { e.textContent = er.message; }
  });
} else {
  const f = shell("Forgot your password?", `<form novalidate><p class="mute">Enter your email. If an account exists, we send a reset link that works for one hour.</p><label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><p class="fe" role="alert" id="e"></p><button class="btn lg" type="submit">Send reset link</button></form><p><a href="auth.html">Back to sign in</a></p>`);
  f.addEventListener("submit", async ev => {
    ev.preventDefault(); const e = box.querySelector("#e"); e.textContent = "";
    try { await post("/api/auth/forgot", { email: f.elements.email.value }); shell("Check your inbox", `<p>If that email has an account, a reset link is on its way. It works for one hour.</p><p><a href="auth.html">Back to sign in</a></p>`); }
    catch (er) { e.textContent = er.message; }
  });
}

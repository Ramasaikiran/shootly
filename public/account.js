import { post, toast } from "./app.js";
import { esc } from "./components.js";
import { passwordIssues } from "./policy.js";
import { confirmDialog } from "./panel.js";

// Account settings shared by customer, creator and admin panels.
export function mountAccount(root, me) {
  root.innerHTML = `<div class="stack">
<form class="card sub" id="ac-name" novalidate><label>Your name<input name="name" value="${esc(me.user.name)}" maxlength="60" required autocomplete="name"></label><label>Mobile number<span class="phone"><span class="cc2" aria-hidden="true">+91</span><input name="phone" type="tel" inputmode="numeric" value="${esc(me.user.phone||"")}" maxlength="14" autocomplete="tel-national" placeholder="98765 43210"></span></label><div><button class="btn" type="submit">Save</button><p class="fe" data-e="name" role="alert"></p></div></form>
<div class="card"><h3>Email</h3><p>${esc(me.user.email)} · ${me.user.emailVerified ? '<span class="tag ok">Verified</span>' : '<span class="tag wait">Not verified</span>'}</p></div>
<form class="card sub" id="ac-pw" novalidate><label>Current password<input name="current" type="password" autocomplete="current-password" maxlength="128" required></label><label>New password<input name="password" type="password" autocomplete="new-password" maxlength="128" required></label><div><button class="btn" type="submit">Change password</button><p class="fe" data-e="pw" role="alert"></p></div></form>
<div class="card"><h3>Sign out everywhere</h3><p class="mute">Ends every session, including this one. Use it if you lost a device.</p><button class="btn alt" id="ac-all" type="button">Sign out of all devices</button></div></div>`;
  const q = s => root.querySelector(s), err = (k, t) => { q(`[data-e="${k}"]`).textContent = t || ""; };
  q("#ac-name").addEventListener("submit", async e => {
    e.preventDefault(); err("name");
    try { await post("/api/me/profile", { name: e.target.elements.name.value, phone: e.target.elements.phone.value || undefined }); toast("Saved."); } catch (er) { err("name", er.message); }
  });
  q("#ac-pw").addEventListener("submit", async e => {
    e.preventDefault(); err("pw"); const f = e.target.elements;
    const issue = passwordIssues(f.password.value, me.user.email)[0]; if (issue) return err("pw", issue);
    try { await post("/api/me/password", { current: f.current.value, password: f.password.value }); e.target.reset(); toast("Password changed. Other devices are signed out."); } catch (er) { err("pw", er.message); }
  });
  q("#ac-all").addEventListener("click", async () => {
    if (!(await confirmDialog("Sign out of every device, including this one?", "Sign out"))) return;
    try { await post("/api/auth/logout-all"); location.href = "auth.html"; } catch (er) { toast(er.message); }
  });
}

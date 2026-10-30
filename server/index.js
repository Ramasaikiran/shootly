import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { openStore } from "./store.js";
import { createService } from "./service.js";
import { createApp } from "./app.js";
import { gatewayFromEnv } from "./payments.js";
import { createMailer } from "./mailer.js";
import { diskUploads } from "./uploads.js";
import { encKeyFromEnv } from "./security.js";
import { passwordIssues } from "../public/policy.js";

const env = process.env, root = path.dirname(fileURLToPath(import.meta.url)), prod = env.NODE_ENV === "production";
const port = +env.PORT || 3000, publicUrl = (env.PUBLIC_URL || `http://localhost:${port}`).replace(/\/$/, "");
if (prod && !env.PUBLIC_URL) throw new Error("Set PUBLIC_URL (for example https://shootly.in). Email links use it.");

const store = await openStore(env, path.join(root, "..", "data.json"));
const gateway = gatewayFromEnv(env), demo = env.DEMO === "1";
const mailer = createMailer(env);
const service = createService({
  store, gateway, demo, publicUrl,
  mailer,
  uploads: diskUploads(env.UPLOAD_DIR || path.join(root, "..", "uploads")),
  encKey: encKeyFromEnv(env)
});

if (!store.d.users.some(u => u.role === "admin")) {
  const em = env.ADMIN_EMAIL || "admin@shootly.local";
  let pw = env.ADMIN_PASSWORD;
  if (prod) {
    if (!env.ADMIN_EMAIL || !pw) throw new Error("Set ADMIN_EMAIL and ADMIN_PASSWORD to create the first admin. The password is never printed.");
    if (passwordIssues(pw, em).length) throw new Error("ADMIN_PASSWORD is too weak: " + passwordIssues(pw, em)[0]);
  } else if (!pw) {
    pw = randomBytes(9).toString("base64url");
    console.log(`Dev admin created: ${em} / ${pw}  (printed in development only)`);
  }
  service.createAdmin(em, pw);
  await store.save();
}

if (demo && !store.d.users.some(u => u.email === "customer@demo.test")) {
  const pw = "Demo-pass-2026", ok = u => { store.d.users.find(x => x.id === u.id).emailVerified = true; return u; };
  ok(service.register({ name: "Demo Customer", email: "customer@demo.test", password: pw, role: "customer" }));
  for (const [n, a, t, k] of [
    ["Aarav Reddy", "Madhapur", ["Birthday", "Family"], [["Mini shoot", 1, "25 edited photos, online gallery", 3, 2500]]],
    ["Meera Iyer", "Banjara Hills", ["Reel", "Restaurant"], [["Reel pack", 2, "3 edited reels, 30 to 45 sec", 2, 6000]]]
  ]) {
    const u = ok(service.register({ name: n, email: n.split(" ")[0].toLowerCase() + "@demo.test", password: pw, role: "creator", area: a, types: t }));
    const c = store.d.creators.find(x => x.userId === u.id);
    c.ver = "verified"; c.pk = k.map(([n, h, d, days, p]) => ({ n, h, d, days, p }));
  }
  console.log("Demo logins: customer@demo.test, aarav@demo.test, meera@demo.test / " + pw);
  await store.save();
}

const handler = createApp({
  service, store, gateway, publicDir: path.join(root, "..", "public"),
  config: { secure: prod, trustProxy: env.TRUST_PROXY === "1" }
});
http.createServer(handler).listen(port, () => console.log(`Shootly on ${publicUrl} | mail: ${mailer.kind}${gateway.mock ? " | mock payments" : ""}`));

// Admin recovery without editing data files.
//   NEW_PASSWORD='...' node tools/admin.js set-password someone@example.com
//   ADMIN_PASSWORD='...' node tools/admin.js create-admin you@example.com
// Uses the same DATABASE_URL or DATA_FILE as the server.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openStore } from "../server/store.js";
import { createService } from "../server/service.js";
import { MockGateway } from "../server/payments.js";
const [cmd, email] = process.argv.slice(2), env = process.env;
const store = await openStore(env, path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data.json"));
const service = createService({ store, gateway: new MockGateway() });
try {
  if (cmd === "set-password" && email && env.NEW_PASSWORD) { service.resetPasswordFor(email, env.NEW_PASSWORD); console.log("Password changed. All sessions signed out."); }
  else if (cmd === "create-admin" && email && env.ADMIN_PASSWORD) { service.createAdmin(email, env.ADMIN_PASSWORD); console.log("Admin created."); }
  else { console.log("Usage:\n  NEW_PASSWORD=... node tools/admin.js set-password <email>\n  ADMIN_PASSWORD=... node tools/admin.js create-admin <email>"); process.exitCode = 1; }
  await store.save();
} catch (e) { console.error(e.message); process.exitCode = 1; }
await store.close?.();

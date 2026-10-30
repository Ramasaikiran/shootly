// Run with Razorpay TEST keys. Never use live keys here.
//   RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... [RAZORPAY_WEBHOOK_SECRET=...] node tools/razorpay_check.js
import { RazorpayGateway } from "../server/payments.js";
const { RAZORPAY_KEY_ID: keyId, RAZORPAY_KEY_SECRET: keySecret, RAZORPAY_WEBHOOK_SECRET: webhookSecret } = process.env;
if (!keyId || !keySecret) { console.error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET (test keys)."); process.exit(1); }
if (keyId.startsWith("rzp_live_")) { console.error("Refusing to run with live keys."); process.exit(1); }
const g = new RazorpayGateway({ keyId, keySecret, webhookSecret });
let bad = 0; const ok = (name, pass, note = "") => { console.log((pass ? "PASS " : "FAIL ") + name + (note ? ": " + note : "")); if (!pass) bad++; };
try { const o = await g.createOrder({ amount: 100, receipt: "check_" + Date.now() }); ok("create order (₹1)", /^order_/.test(o.id), o.id); } catch (e) { ok("create order", false, e.message); }
try { await g.findRefund("pay_doesnotexist000", 100); ok("refund lookup on unknown payment answers with an error", false, "expected an error"); } catch (e) { ok("refund lookup reaches Razorpay and errors cleanly on an unknown payment", !/fetch failed|ENOTFOUND|ECONN/i.test(e.message), e.message); }
ok("webhook secret is set", !!webhookSecret, webhookSecret ? "" : "set RAZORPAY_WEBHOOK_SECRET and the same secret in the Razorpay dashboard");
console.log(bad ? `\n${bad} check(s) failed.` : "\nAll checks passed. Now do one full test-mode booking, payment and refund by hand.");
process.exit(bad ? 1 : 0);

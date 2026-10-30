import test from "node:test";
import assert from "node:assert/strict";
import { makeWorld, seedBasics, startServer, PW } from "./helpers.js";
import { HttpError } from "../server/service.js";
import { encrypt, decrypt, encKeyFromEnv } from "../server/security.js";
import { createMailer } from "../server/mailer.js";
import { sniff, decodeUpload, diskUploads } from "../server/uploads.js";
import { createStore, createPgStore } from "../server/store.js";
import { RazorpayGateway } from "../server/payments.js";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const rejects = (p, status) => assert.rejects(p, e => e instanceof HttpError && e.status === status, "expected " + status);
const throwsS = (f, status) => assert.throws(f, e => e instanceof HttpError && e.status === status, "expected " + status);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(40, 1)]).toString("base64");
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]).toString("base64");
const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(40)]).toString("base64");
const book = (w, o, cust = o.cust, c = o.a.c, date = "2026-11-02", slot = "10:00") => w.service.makeBooking(cust, { creatorId: c.id, pk: 0, date, slot, type: "Birthday" });
async function paid(w, o, b = book(w, o)) {
  const s = w.service; await s.act(o.a.u, b.id, "accept");
  const ord = await s.createOrder(o.cust, b.id), k = w.gateway.mockCheckout(ord.orderId);
  await s.verifyPayment(o.cust, { bookingId: b.id, ...k }); return b;
}
const world = (opts) => { const w = makeWorld(opts), o = seedBasics(w); return { w, o, s: w.service }; };

// ---------- refunds
test("refund failure: booking becomes Refund pending, payment refund_failed, admin retry succeeds", async () => {
  const { w, o, s } = world(); const b = await paid(w, o);
  w.gateway.failRefunds = 1;
  const v = await s.act(o.cust, b.id, "cancel"); assert.equal(v.status, "Refund pending");
  assert.equal(w.store.d.payments[0].status, "refund_failed"); assert.match(w.store.d.payments[0].refundError, /down/);
  assert.equal(s.stats(o.admin).failedRefunds, 1); assert.equal(s.stats(o.admin).refundPending, 1);
  assert.equal(s.adminPayments(o.admin)[0].status, "refund_failed");
  await rejects(s.act(o.cust, b.id, "retry-refund"), 403);
  const r = await s.retryRefund(o.admin, w.store.d.payments[0].id); assert.equal(r.ok, true);
  assert.equal(w.store.d.bookings[0].status, "Refunded"); assert.equal(w.store.d.payments[0].status, "refunded");
  assert.equal(w.gateway.refunds.length, 1);
  assert.ok(s.listAudit(o.admin).some(a => a.action === "refund.failed")); assert.ok(s.listAudit(o.admin).some(a => a.action === "refund.retry"));
});
test("refund retry that fails again stays pending and says why", async () => {
  const { w, o, s } = world(); const b = await paid(w, o); w.gateway.failRefunds = 2;
  await s.act(o.cust, b.id, "cancel");
  await rejects(s.act(o.admin, b.id, "retry-refund"), 502);
  assert.equal(w.store.d.bookings[0].status, "Refund pending"); assert.equal(w.store.d.payments[0].refundTries, 2);
});
test("refund retry never double-refunds when the first attempt actually went through", async () => {
  const { w, o, s } = world(); const b = await paid(w, o); const p = w.store.d.payments[0];
  w.gateway.refunds.push({ paymentId: p.paymentId, amount: p.amount, id: "rfnd_earlier" }); p.status = "refund_failed";
  const before = w.gateway.refunds.length; await s.retryRefund(o.admin, p.id);
  assert.equal(w.gateway.refunds.length, before); assert.equal(p.refundId, "rfnd_earlier");
});
test("customer 'take full refund' retries a failed auto-refund (refund_failed is retryable)", async () => {
  const { w, o, s } = world(); const b1 = book(w, o), b2 = book(w, o, o.cust2);
  await s.act(o.a.u, b1.id, "accept"); await s.act(o.a.u, b2.id, "accept");
  const o1 = await s.createOrder(o.cust, b1.id), o2 = await s.createOrder(o.cust2, b2.id);
  await s.verifyPayment(o.cust, { bookingId: b1.id, ...w.gateway.mockCheckout(o1.orderId) });
  w.gateway.failRefunds = 1; const r = await s.verifyPayment(o.cust2, { bookingId: b2.id, ...w.gateway.mockCheckout(o2.orderId) }); assert.equal(r.refunded, true);
  const p2 = w.store.d.payments[1]; assert.equal(p2.status, "refund_failed");
  const v = await s.act(o.cust2, b2.id, "refund"); assert.equal(v.status, "Refunded"); assert.equal(p2.status, "refunded");
});
test("webhook refund.processed settles a Refund pending booking", async () => {
  const { w, o, s } = world(); const b = await paid(w, o); w.gateway.failRefunds = 1; await s.act(o.cust, b.id, "cancel");
  const p = w.store.d.payments[0], body = JSON.stringify({ event: "refund.processed", payload: { refund: { entity: { id: "rfnd_w", payment_id: p.paymentId } } } });
  const { hmac } = await import("../server/security.js");
  await s.webhook(body, hmac("mock_webhook", body), "evt_refund_1");
  assert.equal(w.store.d.bookings[0].status, "Refunded"); assert.equal(p.status, "refunded");
});
test("RazorpayGateway.findRefund looks up existing refunds with GET", async () => {
  const calls = []; const g = new RazorpayGateway({ keyId: "k", keySecret: "s", webhookSecret: "w", fetchImpl: async (u, o) => { calls.push([u, o.method]); return { ok: true, json: async () => ({ items: [{ id: "rfnd_1", amount: 5000, status: "processed" }] }) }; } });
  assert.deepEqual(await g.findRefund("pay_1", 5000), { id: "rfnd_1" }); assert.equal(await g.findRefund("pay_1", 9000), null);
  assert.deepEqual(calls[0], ["https://api.razorpay.com/v1/payments/pay_1/refunds", "GET"]);
});

// ---------- email verification, reset, account
function mailWorld() {
  const w = makeWorld(); const mailer = createMailer({}); mailer.send = async m => { mailer.outbox.push(m); };
  w.service = null; return { w, mailer };
}
import { createService } from "../server/service.js"; import { MockGateway } from "../server/payments.js";
function fresh() {
  const store = createStore(null), mailer = createMailer({}); mailer.send = async m => { mailer.outbox.push(m); };
  let t = Date.parse("2026-10-25T06:00:00Z"); const service = createService({ store, gateway: new MockGateway(), now: () => new Date(t), mailer, publicUrl: "https://x.test" });
  return { store, mailer, service, advance: ms => { t += ms; } };
}
const tokenOf = (mailer, i = -1) => mailer.outbox.at(i).text.match(/#t=([\w-]+)/)[1];
test("email verification: link verifies, unverified users cannot book", async () => {
  const f = fresh(), s = f.service; const u = s.register({ name: "Zed", email: "zed@t.test", password: PW, role: "customer" });
  await new Promise(r => setTimeout(r, 5)); assert.equal(f.mailer.outbox.length, 1); assert.equal(u.emailVerified, false);
  assert.match(f.mailer.outbox[0].text, /https:\/\/x\.test\/verify\.html#t=/);
  const cu = s.register({ name: "Cee", email: "c@t.test", password: PW, role: "creator", area: "Madhapur", types: ["Birthday"] }); const c = f.store.d.creators[0]; c.ver = "verified"; c.pk = [{ n: "Mini", h: 1, d: "25 photos", days: 3, p: 2500 }];
  throwsS(() => s.makeBooking(u, { creatorId: c.id, pk: 0, date: "2026-11-02", slot: "10:00", type: "Birthday" }), 403);
  assert.throws(() => s.verifyEmail("bad-token"), e => e.status === 400);
  const v = s.verifyEmail(tokenOf(f.mailer, 0)); assert.equal(v.emailVerified, true);
  assert.throws(() => s.verifyEmail(tokenOf(f.mailer, 0)), e => e.status === 400, "single use");
  assert.ok(s.makeBooking({ ...u, emailVerified: true }, { creatorId: c.id, pk: 0, date: "2026-11-02", slot: "10:00", type: "Birthday" }));
  assert.equal(cu.emailVerified, false);
});
test("email verification: token expires after 48 hours; resend works once verified is false", async () => {
  const f = fresh(), s = f.service; const u = s.register({ name: "Zed", email: "zed@t.test", password: PW, role: "customer" }); await new Promise(r => setTimeout(r, 5));
  f.advance(49 * 36e5); assert.throws(() => s.verifyEmail(tokenOf(f.mailer, 0)), e => e.status === 400);
  s.resendVerification(u); await new Promise(r => setTimeout(r, 5)); assert.equal(f.mailer.outbox.length, 2); s.verifyEmail(tokenOf(f.mailer));
  throwsS(() => s.resendVerification(u), 409);
});
test("password reset: link sets a new password, signs out everywhere, is single-use and expires; unknown email sends nothing", async () => {
  const f = fresh(), s = f.service; s.register({ name: "Zed", email: "zed@t.test", password: PW, role: "customer" }); await new Promise(r => setTimeout(r, 5)); f.mailer.outbox.length = 0;
  await s.forgot("nobody@t.test"); assert.equal(f.mailer.outbox.length, 0);
  const sess = s.login({ email: "zed@t.test", password: PW }); await s.forgot("ZED@t.test"); const t = tokenOf(f.mailer);
  assert.throws(() => s.resetPassword({ token: t, password: "short" }), e => e.field === "password");
  s.resetPassword({ token: t, password: "Brand-new-pass-77" }); assert.equal(s.authenticate(sess.token), null);
  assert.throws(() => s.login({ email: "zed@t.test", password: PW }), e => e.status === 401); assert.ok(s.login({ email: "zed@t.test", password: "Brand-new-pass-77" }));
  assert.throws(() => s.resetPassword({ token: t, password: "Another-pass-88" }), e => e.status === 400);
  await s.forgot("zed@t.test"); const t2 = tokenOf(f.mailer); f.advance(61 * 6e4); assert.throws(() => s.resetPassword({ token: t2, password: "Another-pass-88" }), e => e.status === 400);
});
test("account: change name, change password keeps this session, drops others", async () => {
  const { w, o, s } = world(); const a = s.login({ email: "cathy@t.test", password: PW }), b = s.login({ email: "cathy@t.test", password: PW });
  const u = s.authenticate(a.token); assert.equal(s.updateName(u, "Cathy B").name, "Cathy B"); throwsS(() => s.updateName(u, "x"), 400);
  throwsS(() => s.changePassword(u, { current: "wrong-pass-1", password: "Newer-pass-2026" }, a.token), 400);
  s.changePassword(u, { current: PW, password: "Newer-pass-2026" }, a.token); assert.ok(s.authenticate(a.token)); assert.equal(s.authenticate(b.token), null);
  s.logoutAll(u); assert.equal(s.authenticate(a.token), null); assert.ok(w);
  const cu = o.a.u; s.updateName(cu, "Aarav K"); assert.equal(w.store.d.creators.find(c => c.userId === cu.id).name, "Aarav K");
});
test("mailer: production demands a provider; Resend call shape", async () => {
  assert.throws(() => createMailer({ NODE_ENV: "production" })); let seen;
  const m = createMailer({ RESEND_API_KEY: "re_1", MAIL_FROM: "Shootly <no-reply@x.in>" }, { fetchImpl: async (u, o) => { seen = [u, o]; return { ok: true }; } });
  await m.send({ to: "a@b.co", subject: "S", text: "T" }); assert.equal(seen[0], "https://api.resend.com/emails"); assert.equal(seen[1].headers.Authorization, "Bearer re_1"); assert.deepEqual(JSON.parse(seen[1].body).to, ["a@b.co"]);
  await assert.rejects(createMailer({ RESEND_API_KEY: "k", MAIL_FROM: "f" }, { fetchImpl: async () => ({ ok: false, status: 500 }) }).send({ to: "a@b.co", subject: "s", text: "t" }));
});
test("disabled users cannot sign in and lose their sessions; creators get unlisted", () => {
  const { w, o, s } = world(); const sess = s.login({ email: "aarav@t.test", password: PW });
  s.setUserDisabled(o.admin, o.a.u.id, true); assert.equal(s.authenticate(sess.token), null); throwsS(() => s.login({ email: "aarav@t.test", password: PW }), 403);
  assert.equal(s.listCreators({}).length, 1); throwsS(() => s.setUserDisabled(o.admin, o.admin.id, true), 403); throwsS(() => s.setUserDisabled(o.cust, o.a.u.id, true), 403);
  s.setUserDisabled(o.admin, o.a.u.id, false); assert.ok(s.login({ email: "aarav@t.test", password: PW })); assert.equal(w.store.d.creators.find(c => c.userId === o.a.u.id).ver, "suspended");
  const us = s.adminUsers(o.admin); assert.ok(us.find(u => u.email === "aarav@t.test") && us.every(u => !("passHash" in u)));
});

// ---------- files
test("uploads: type is detected from content, size capped, bad base64 refused", () => {
  assert.equal(sniff(Buffer.from(JPG, "base64")), "jpg"); assert.equal(sniff(Buffer.from(PNG, "base64")), "png"); assert.equal(sniff(Buffer.from(PDF, "base64")), "pdf");
  assert.equal(sniff(Buffer.from("<script>alert(1)</script>  ")), null);
  assert.throws(() => decodeUpload(PDF, { max: 1e6, allow: ["jpg"] }), /Unsupported/); assert.throws(() => decodeUpload("!!!", { max: 1e6, allow: ["jpg"] }), /could not be read/);
  assert.throws(() => decodeUpload(Buffer.alloc(3000, 1).toString("base64"), { max: 1000, allow: ["jpg"] }), /too large/);
  assert.ok(decodeUpload("data:image/jpeg;base64," + JPG, { max: 1e6, allow: ["jpg"] }).ext === "jpg");
});
test("disk uploads: random names, private files not served as public, path tricks refused", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "up-")); const u = diskUploads(dir);
  const pub = u.putPublic(Buffer.from(JPG, "base64"), "jpg"), priv = u.putPrivate(Buffer.from(PDF, "base64"), "pdf");
  assert.match(pub, /^[a-f0-9]{36}\.jpg$/); assert.equal(u.readPublic(pub).mime, "image/jpeg"); assert.equal(u.readPublic(priv), null); assert.equal(u.readPublic("../private/" + priv), null);
  assert.equal(u.readPrivate(priv).mime, "application/pdf"); u.remove("public", pub); assert.equal(u.readPublic(pub), null); fs.rmSync(dir, { recursive: true });
});
test("creator ID: upload, admin can view, approval needs ID and verified email", () => {
  const f = fresh(), s = f.service; const adm = s.createAdmin("a@t.test", PW);
  const u = s.register({ name: "Dev", email: "dev@t.test", password: PW, role: "creator", area: "Madhapur", types: ["Birthday"] }), c = f.store.d.creators[0];
  throwsS(() => s.setCreatorStatus(adm, c.id, "verified"), 409); throwsS(() => s.setIdDoc(u, { data: JPG.slice(0, 4) }), 400);
  throwsS(() => s.setIdDoc(u, { data: Buffer.from("<html>").toString("base64") }), 400); s.setIdDoc(u, { data: PDF }); assert.equal(s.myCreator(u).hasId, true);
  throwsS(() => s.setCreatorStatus(adm, c.id, "verified"), 409, "email not verified yet"); f.store.d.users.find(x => x.id === u.id).emailVerified = true;
  throwsS(() => s.readIdDoc(u, c.id), 403); const file = s.readIdDoc(adm, c.id); assert.equal(file.mime, "application/pdf");
  s.setCreatorStatus(adm, c.id, "verified"); assert.equal(c.ver, "verified"); s.setIdDoc(u, { data: PNG }); assert.equal(s.readIdDoc(adm, c.id).mime, "image/png");
  assert.equal(s.uploads.count(), 1, "old ID file removed"); assert.ok(s.listAudit(adm).some(a => a.action === "creator.id_viewed"));
  throwsS(() => s.setIdDoc({ id: "x", role: "customer" }, { data: PDF }), 403);
});
test("portfolio: add, limit of 12, remove deletes the file; public view lists it", () => {
  const { w, o, s } = world(); for (let i = 0; i < 12; i++) s.addPortfolio(o.a.u, { data: JPG, caption: "<b>x</b> " + i });
  throwsS(() => s.addPortfolio(o.a.u, { data: JPG }), 400); throwsS(() => s.addPortfolio(o.a.u, { data: PDF }), 400);
  const m = s.myCreator(o.a.u); assert.equal(m.portfolio.length, 12); assert.ok(m.portfolio[0].url.startsWith("/uploads/")); assert.ok(!m.portfolio[0].caption.includes("<"));
  assert.equal(s.listCreators({}).find(c => c.id === o.a.c.id).cover, m.portfolio[0].url);
  const before = s.uploads.count(); s.removePortfolio(o.a.u, m.portfolio[0].id); assert.equal(s.uploads.count(), before - 1); throwsS(() => s.removePortfolio(o.b.u, m.portfolio[1].id), 404);
  assert.ok(w);
});

// ---------- creator profile, packages, availability
test("profile: edit area, types, bio; validated", () => {
  const { o, s } = world(); s.updateProfile(o.a.u, { area: "Gachibowli", types: ["Reel", "Reel", "Product"], bio: "<i>Hi</i> I shoot " + "x".repeat(700), exp: "8 yrs" });
  const m = s.myCreator(o.a.u); assert.equal(m.area, "Gachibowli"); assert.deepEqual(m.types, ["Reel", "Product"]); assert.ok(m.bio.length <= 600 && !m.bio.includes("<")); assert.equal(m.exp, "8 yrs");
  throwsS(() => s.updateProfile(o.a.u, { area: "Mars", types: ["Reel"] }), 400); throwsS(() => s.updateProfile(o.a.u, { area: "Madhapur", types: [] }), 400); throwsS(() => s.updateProfile(o.cust, { area: "Madhapur", types: ["Reel"] }), 403);
});
test("packages: edit, delete, ids stable; open bookings block delete; booking keeps its price snapshot", () => {
  const { w, o, s } = world(); const m = s.myCreator(o.a.u); const [p0, p1] = m.pk; assert.ok(p0.id && p1.id && p0.id !== p1.id);
  const b = book(w, o); assert.equal(w.store.d.bookings[0].pkgId, p0.id);
  s.editPackage(o.a.u, p0.id, { n: "Mini+", h: 2, d: "30 edited photos", days: 3, p: 3000 }); assert.equal(s.myCreator(o.a.u).pk[0].p, 3000); assert.equal(w.store.d.bookings[0].price, 2500);
  throwsS(() => s.editPackage(o.a.u, p0.id, { n: "x", h: 1, d: "abcde", days: 1, p: 1 }), 400); throwsS(() => s.editPackage(o.b.u, p0.id, { n: "Mini", h: 1, d: "abcdef", days: 1, p: 2500 }), 404);
  throwsS(() => s.deletePackage(o.a.u, p0.id), 409); s.deletePackage(o.a.u, p1.id); assert.equal(s.myCreator(o.a.u).pk.length, 1);
  assert.ok(b);
});
test("replacement swap uses the replacement's current package, not a stale index", async () => {
  const { w, o, s } = world(); o.b.c.types = ["Birthday"]; const b = await paid(w, o); await s.act(o.a.u, b.id, "withdraw");
  await s.act(o.admin, b.id, "offers"); const offered = w.store.d.bookings[0].offers; assert.ok(offered.length);
  const nb = await s.act(o.cust, b.id, "swap", { creatorId: offered[0].creatorId }); assert.equal(nb.status, "Requested"); assert.equal(w.store.d.bookings[0].status, "Refunded");
});
test("availability: block and unblock dates; blocked dates stop new bookings and accepts", async () => {
  const { w, o, s } = world(); s.setBlocked(o.a.u, { date: "2026-11-02", blocked: true }); assert.deepEqual(s.myCreator(o.a.u).blocked, ["2026-11-02"]);
  throwsS(() => book(w, o), 409); assert.ok(!s.listCreators({ date: "2026-11-02" }).some(c => c.id === o.a.c.id));
  s.setBlocked(o.a.u, { date: "2026-11-02", blocked: false }); const b = book(w, o); s.setBlocked(o.a.u, { date: "2026-11-02", blocked: true });
  await rejects(s.act(o.a.u, b.id, "accept"), 409); s.setBlocked(o.a.u, { date: "2026-11-02", blocked: false }); await s.act(o.a.u, b.id, "accept");
  const ord = await s.createOrder(o.cust, b.id); await s.verifyPayment(o.cust, { bookingId: b.id, ...w.gateway.mockCheckout(ord.orderId) });
  throwsS(() => s.setBlocked(o.a.u, { date: "2026-11-02", blocked: true }), 409, "confirmed shoot"); throwsS(() => s.setBlocked(o.a.u, { date: "2020-01-01", blocked: true }), 400); throwsS(() => s.setBlocked(o.a.u, { date: "nope" }), 400);
});

// ---------- payouts, payments, receipts, stats
const PAYOUT_KEY = Buffer.alloc(32, 9);
test("payout details are encrypted at rest; masks shown; validation", () => {
  const { w, o, s } = world(); s.setPayout(o.a.u, { holder: "Aarav Reddy", upi: "aarav@okhdfc" });
  const raw = JSON.stringify(w.store.d.creators); assert.ok(!raw.includes("aarav@okhdfc")); assert.deepEqual(s.myCreator(o.a.u).payout, { holder: "Aarav Reddy", kind: "upi", mask: "aa***@okhdfc" });
  s.setPayout(o.a.u, { holder: "Aarav Reddy", account: "123456789012", ifsc: "hdfc0001234" }); assert.ok(!JSON.stringify(w.store.d.creators).includes("123456789012")); assert.equal(s.myCreator(o.a.u).payout.mask, "••••9012 · HDFC0001234");
  throwsS(() => s.setPayout(o.a.u, { holder: "A", upi: "a@b" }), 400); throwsS(() => s.setPayout(o.a.u, { holder: "Aarav", upi: "bad upi" }), 400); throwsS(() => s.setPayout(o.a.u, { holder: "Aarav", account: "12", ifsc: "HDFC0001234" }), 400); throwsS(() => s.setPayout(o.a.u, { holder: "Aarav", account: "123456789", ifsc: "BAD" }), 400);
  const k = Buffer.alloc(32, 3), e = encrypt(k, "secret"); assert.equal(decrypt(k, e), "secret"); assert.throws(() => decrypt(Buffer.alloc(32, 4), e)); assert.throws(() => decrypt(k, e.slice(0, -2) + "xx"));
  assert.throws(() => encKeyFromEnv({ NODE_ENV: "production" })); assert.throws(() => encKeyFromEnv({ PAYOUT_ENC_KEY: "abc" })); assert.equal(encKeyFromEnv({ PAYOUT_ENC_KEY: "ab".repeat(32) }).length, 32);
  assert.ok(PAYOUT_KEY);
});
async function delivered(w, o) {
  const s = w.service; const b = await paid(w, o); w.store.d.bookings.find(x => x.id === b.id); await s.act(o.a.u, b.id, "start"); await s.act(o.a.u, b.id, "complete"); await s.act(o.a.u, b.id, "deliver", { url: "https://photos.example/g" }); return b;
}
test("payouts: held 7 days after delivery, then due with decrypted destination, mark paid with reference", async () => {
  const { w, o, s } = world({ demo: true }); s.setPayout(o.a.u, { holder: "Aarav Reddy", upi: "aarav@okhdfc" }); const b = await delivered(w, o);
  let row = s.payouts(o.admin)[0]; assert.equal(row.state, "holding"); assert.equal(row.destination, null); assert.equal(row.amount, 2200);
  throwsS(() => s.markPayoutPaid(o.admin, b.id, "UTR12345"), 409); assert.equal(s.listBookings(o.a.u)[0].payoutState, "holding");
  w.clock.advance(7 * 864e5 + 1000); row = s.payouts(o.admin)[0]; assert.equal(row.state, "due"); assert.equal(row.destination.upi, "aarav@okhdfc"); assert.equal(s.stats(o.admin).payoutsDue, 2200);
  throwsS(() => s.payouts(o.a.u), 403); throwsS(() => s.markPayoutPaid(o.a.u, b.id, "UTR12345"), 403); throwsS(() => s.markPayoutPaid(o.admin, b.id, "x"), 400);
  s.markPayoutPaid(o.admin, b.id, "UTR12345"); row = s.payouts(o.admin)[0]; assert.equal(row.state, "paid"); assert.equal(row.ref, "UTR12345"); assert.equal(row.destination, null);
  throwsS(() => s.markPayoutPaid(o.admin, b.id, "UTR99999"), 409); const cv = s.listBookings(o.a.u)[0]; assert.equal(cv.payoutState, "paid"); assert.equal(cv.payoutRef, "UTR12345");
  assert.equal(s.listBookings(o.cust)[0].payoutState, undefined); assert.equal(s.stats(o.admin).payoutsPaid, 2200); assert.ok(s.listAudit(o.admin).some(a => a.action === "payout.paid"));
});
test("payments list, receipts and revenue stats", async () => {
  const { w, o, s } = world({ demo: true }); const b = await delivered(w, o);
  const mine = s.listPayments(o.cust); assert.equal(mine.length, 1); assert.equal(mine[0].amount, 2500); assert.equal(mine[0].status, "paid"); assert.equal(mine[0].receipt, true); assert.ok(!("customerName" in mine[0]));
  assert.equal(s.listPayments(o.cust2).length, 0); assert.equal(s.listPayments(o.a.u).length, 0); assert.equal(s.listPayments(o.admin).length, 1);
  const r = s.receipt(o.cust, b.id); assert.equal(r.amount, 2500); assert.equal(r.customerName, "Cathy"); assert.match(r.receiptNo, /^SH-/); assert.match(r.note, /not a GST/);
  throwsS(() => s.receipt(o.cust2, b.id), 404); throwsS(() => s.receipt(o.a.u, b.id), 404); assert.ok(s.receipt(o.admin, b.id));
  const st = s.stats(o.admin); assert.equal(st.collected, 2500); assert.equal(st.feeEarned, 300); assert.equal(st.refunded, 0);
  const b2 = book(w, o, o.cust2, o.a.c, "2026-11-09"); throwsS(() => s.receipt(o.cust2, b2.id), 404);
});
test("audit log: admin actions recorded newest first, admin only, capped", () => {
  const { w, o, s } = world(); s.setCreatorStatus(o.admin, o.a.c.id, "suspended"); s.setCreatorStatus(o.admin, o.a.c.id, "verified");
  const l = s.listAudit(o.admin); assert.deepEqual(l.slice(0, 2).map(a => a.action), ["creator.approve", "creator.suspend"]); assert.equal(l[0].actorName, "Admin"); throwsS(() => s.listAudit(o.cust), 403);
  assert.equal(s.listAudit(o.admin, { action: "creator.sus" }).length, 1);
  for (let i = 0; i < 5100; i++) s.setCreatorStatus(o.admin, o.a.c.id, "verified"); assert.equal(w.store.d.audit.length, 5000);
});
test("public creator page: rating, reviews with first names, only verified creators", async () => {
  const { w, o, s } = world({ demo: true }); const b = await delivered(w, o); await s.act(o.cust, b.id, "review", { rating: 4, comment: "Great <b>work</b>" });
  const c = s.getCreator(o.a.c.id); assert.equal(c.rating.avg, 4); assert.equal(c.rating.count, 1); assert.equal(c.reviews[0].by, "Cathy"); assert.ok(!c.reviews[0].comment.includes("<")); assert.ok(!("userId" in c));
  assert.equal(s.listCreators({}).find(x => x.id === o.a.c.id).rating.avg, 4); o.b.c.ver = "pending"; throwsS(() => s.getCreator(o.b.c.id), 404); throwsS(() => s.getCreator("nope"), 404);
});

// ---------- store
test("pg store: loads, saves with version check, and a second writer is refused", async () => {
  let row = null; const queries = [];
  const pool = { async query(sql, args) {
    queries.push(sql.slice(0, 20));
    if (/^CREATE/.test(sql)) return { rows: [] };
    if (/^SELECT/.test(sql)) return { rows: row ? [{ data: row.data, version: row.version }] : [] };
    if (/^INSERT/.test(sql)) { row = { data: JSON.parse(args[0]), version: 0 }; return { rows: [] }; }
    if (/^UPDATE/.test(sql)) { if (row.version !== args[1]) return { rows: [] }; row = { data: JSON.parse(args[0]), version: row.version + 1 }; return { rows: [{ version: row.version }] }; }
  } };
  const a = await createPgStore(pool); a.d.users.push({ id: "u1" }); await a.save(); await a.save(); assert.equal(row.version, 2); assert.equal(row.data.users[0].id, "u1");
  const b = await createPgStore(pool); assert.equal(b.d.users[0].id, "u1"); assert.equal(b.d.tokens && typeof b.d.tokens, "object"); b.d.users.push({ id: "u2" }); await b.save();
  await assert.rejects(a.save(), /one server instance/); assert.equal(a.id("x"), "x" + 1);
});

// ---------- HTTP layer
test("http: forgot/reset/verify flow, rate limits, no account enumeration", async () => {
  const { w, o } = world(); const mails = []; const orig = w.service.forgot; void orig;
  const srv = await startServer(w, { mailKeyMax: 1 }); const c = srv.client();
  let r = await c.post("/api/auth/forgot", { email: "nobody@t.test" }); assert.equal(r.status, 200); assert.deepEqual(r.json, { ok: true });
  r = await c.post("/api/auth/forgot", { email: "cathy@t.test" }); assert.deepEqual(r.json, { ok: true }); r = await c.post("/api/auth/forgot", { email: "cathy@t.test" }); assert.equal(r.status, 429);
  assert.equal((await c.post("/api/auth/reset", { token: "nope", password: PW })).status, 400); assert.equal((await c.post("/api/auth/verify", { token: "nope" })).status, 400);
  assert.equal((await srv.client().post("/api/auth/resend-verification")).status, 401); assert.ok(mails);
  await srv.close(); assert.ok(o);
});
test("http: account routes, uploads served publicly, ID only to admin, receipt and payments scoped", async () => {
  const { w, o, s } = world({ demo: true }); const srv = await startServer(w);
  const login = async e => { const c = srv.client(); assert.equal((await c.post("/api/auth/login", { email: e, password: PW })).status, 200); return c; };
  const aar = await login("aarav@t.test"), cath = await login("cathy@t.test"), carl = await login("carl@t.test"), adm = await login("admin@t.test");
  let r = await aar.post("/api/creator/portfolio", { data: JPG, caption: "Wedding" }); assert.equal(r.status, 200); const url = r.json.creator.portfolio[0].url;
  let g = await fetch(srv.base + url); assert.equal(g.status, 200); assert.equal(g.headers.get("content-type"), "image/jpeg"); assert.match(g.headers.get("cache-control"), /immutable/); assert.equal((await fetch(srv.base + "/uploads/../server/store.js")).status, 404);
  assert.equal((await aar.post("/api/creator/portfolio", { data: PDF })).status, 400);
  const big = await aar.post("/api/creator/portfolio", { data: "A".repeat(4e6) }); assert.ok([400, 413].includes(big.status));
  assert.equal((await cath.post("/api/creator/portfolio", { data: JPG })).status, 403);
  assert.equal((await aar.post("/api/creator/id", { data: PDF })).status, 200);
  const idUrl = `/api/admin/creators/${o.a.c.id}/id`; assert.equal((await aar.get(idUrl)).status, 403); assert.equal((await srv.client().get(idUrl)).status, 401);
  const idr = await fetch(srv.base + idUrl, { headers: { Cookie: "sid=" + adm.sid } }); assert.equal(idr.status, 200); assert.equal(idr.headers.get("content-type"), "application/pdf"); assert.equal(idr.headers.get("cache-control"), "no-store"); assert.match(idr.headers.get("content-security-policy"), /sandbox/);
  r = await aar.post("/api/creator/profile", { area: "Gachibowli", types: ["Reel"], bio: "Hello" }); assert.equal(r.json.creator.area, "Gachibowli");
  const pk0 = r.json.creator.pk[0].id; r = await aar.post(`/api/creator/packages/${pk0}/update`, { n: "Mini", h: 1, d: "26 edited photos", days: 3, p: 2800 }); assert.equal(r.json.creator.pk[0].p, 2800);
  assert.equal((await aar.post(`/api/creator/packages/${pk0}/delete`)).status, 200); assert.equal((await carl.post(`/api/creator/packages/${pk0}/delete`)).status, 403);
  r = await aar.post("/api/creator/availability", { date: "2026-12-01", blocked: true }); assert.deepEqual(r.json.creator.blocked, ["2026-12-01"]);
  r = await aar.post("/api/creator/payout", { holder: "Aarav", upi: "aarav@okhdfc" }); assert.equal(r.json.creator.payout.mask, "aa***@okhdfc"); assert.ok(!JSON.stringify(r.json).includes("cipher"));
  r = await cath.post("/api/me/profile", { name: "Cathy Z" }); assert.equal(r.json.user.name, "Cathy Z");
  assert.equal((await cath.post("/api/me/password", { current: "nope-nope-1", password: "Another-pass-88" })).status, 400); assert.equal((await cath.post("/api/me/password", { current: PW, password: "Another-pass-88" })).status, 200); assert.equal((await cath.get("/api/me")).status, 200);
  const nb = (await carl.post("/api/bookings", { creatorId: o.b.c.id, pk: 0, date: "2026-11-02", slot: "10:00", type: "Birthday" })).json.booking; assert.ok(nb);
  assert.equal((await carl.get("/api/payments")).json.payments.length, 0); assert.equal((await carl.get(`/api/bookings/${nb.id}/receipt`)).status, 404);
  for (const p of ["/api/admin/payments", "/api/admin/users", "/api/admin/audit", "/api/admin/payouts"]) { assert.equal((await carl.get(p)).status, 403, p); assert.equal((await adm.get(p)).status, 200, p); }
  assert.equal((await carl.post("/api/admin/users/" + o.cust.id + "/disable")).status, 403); assert.equal((await adm.post("/api/admin/payouts/B1/paid", { ref: "x" })).status, 404);
  assert.equal((await srv.client().get(`/api/creators/${o.b.c.id}`)).status, 200); assert.equal((await srv.client().get("/api/creators/zzz")).status, 404);
  r = await cath.post("/api/auth/logout-all"); assert.equal(r.status, 200); assert.equal((await cath.get("/api/me")).status, 401);
  await srv.close(); assert.ok(s);
});
test("http: failed refund persists state and surfaces to admin", async () => {
  const { w, o, s } = world({ demo: true }); const srv = await startServer(w); const login = async e => { const c = srv.client(); await c.post("/api/auth/login", { email: e, password: PW }); return c; };
  const cath = await login("cathy@t.test"), adm = await login("admin@t.test"); const b = await paid(w, o); w.gateway.failRefunds = 2;
  let r = await cath.post(`/api/bookings/${b.id}/cancel`); assert.equal(r.json.booking.status, "Refund pending");
  const pid = (await adm.get("/api/admin/payments")).json.payments[0].id; r = await adm.post(`/api/admin/payments/${pid}/retry-refund`); assert.equal(r.status, 502); assert.match(r.json.error, /provider refused/);
  r = await adm.post(`/api/admin/payments/${pid}/retry-refund`); assert.equal(r.status, 200); assert.equal((await adm.get("/api/admin/overview")).json.stats.failedRefunds, 0); assert.ok(s); await srv.close();
});

import { get } from "./app.js";
import { esc, inr } from "./components.js";
const box = document.querySelector("#app"), id = new URLSearchParams(location.search).get("b") || "";
try {
  const { receipt: r } = await get(`/api/bookings/${encodeURIComponent(id)}/receipt`);
  const row = (k, v) => `<tr><td class="mute">${esc(k)}</td><td class="right">${esc(v)}</td></tr>`;
  box.innerHTML = `<div class="card rcpt"><h1 class="h1">Payment receipt</h1><p class="mono">${esc(r.receiptNo)}</p><table>${row("Paid by", `${r.customerName} (${r.customerEmail})`)}${row("Creator", r.creatorName)}${row("Package", `${r.pkg.n}, ${r.pkg.h} hr`)}${row("Shoot", `${r.type} on ${r.date} at ${r.slot}`)}${row("Amount", inr(r.amount))}${row("Payment status", r.paymentStatus === "paid" ? "Paid" : r.paymentStatus === "refunded" ? "Refunded" : "Refund pending")}${row("Paid on", r.paidAt ? r.paidAt.slice(0, 10) : "")}${row("Payment ID", r.paymentId || "")}${row("Order ID", r.orderId || "")}</table><p class="mute">${esc(r.note)}</p><p class="noprint"><button class="btn" id="pr" type="button">Print or save as PDF</button> <a class="btn alt" href="customer.html">Back</a></p></div>`;
  box.querySelector("#pr").onclick = () => window.print();
} catch (e) {
  box.innerHTML = `<div class="card rcpt"><h1 class="h1">Receipt not available</h1><p>${esc(e.message)}</p><a class="btn" href="auth.html">Sign in</a></div>`;
}

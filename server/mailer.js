// Email for verification and password reset. Production sends through Resend's HTTP API (no SMTP library needed).
// Dev and tests collect messages in `outbox` and print them to the console.
export function createMailer(env = {}, { fetchImpl = fetch } = {}) {
  const outbox = [];
  if (env.RESEND_API_KEY && env.MAIL_FROM) {
    return {
      kind: "resend", outbox,
      async send({ to, subject, text }) {
        const r = await fetchImpl("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + env.RESEND_API_KEY, "Content-Type": "application/json" },
          body: JSON.stringify({ from: env.MAIL_FROM, to: [to], subject, text })
        });
        if (!r.ok) throw new Error("Email provider error " + r.status);
      }
    };
  }
  if (env.NODE_ENV === "production") throw new Error("Set RESEND_API_KEY and MAIL_FROM in production. Email verification and password reset need them.");
  return { kind: "console", outbox, async send(m) { outbox.push(m); console.log(`[dev mail] to ${m.to} | ${m.subject}\n${m.text}\n`); } };
}

# Shootly (working name)

Node 20+ server, no framework. Static site and API in one process.

## Run
    npm install
    npm run dev          # demo data, mock payments, emails printed to the console, http://localhost:3000
    npm test             # unit, integration, component, page and feature tests

Demo logins (dev only): customer@demo.test, aarav@demo.test, meera@demo.test / Demo-pass-2026.
In dev the first admin gets a random password printed once. In production it is never printed.

## Production env (all required unless marked)
    NODE_ENV=production
    PUBLIC_URL=https://your-domain            # used in email links
    ADMIN_EMAIL=...  ADMIN_PASSWORD=...        # first admin, only read when no admin exists
    DATABASE_URL=postgres://...                # Supabase or any Postgres. Or DATA_FILE=/path/data.json for one small server
    PAYOUT_ENC_KEY=<64 hex chars>              # openssl rand -hex 32. Encrypts creator bank/UPI details. Losing it loses them.
    RAZORPAY_KEY_ID=...  RAZORPAY_KEY_SECRET=...  RAZORPAY_WEBHOOK_SECRET=...
    RESEND_API_KEY=...  MAIL_FROM="Shootly <no-reply@your-domain>"   # verification and password-reset email
    UPLOAD_DIR=/persistent/path                # portfolio photos and ID documents. Must be a persistent disk.
    TRUST_PROXY=1 (behind a proxy)  PORT=3000  PGSSL=require (if your Postgres needs it)
Webhook URL: POST /api/payments/webhook. Events: payment.captured, payment.failed, refund.processed, refund.failed.
Production refuses to start when a required setting is missing. Serve over HTTPS.

## Admin recovery
    NEW_PASSWORD='...' node tools/admin.js set-password you@example.com
    ADMIN_PASSWORD='...' node tools/admin.js create-admin you@example.com
Also: users can reset their own password at reset.html (admins too).

## Check Razorpay before launch
    RAZORPAY_KEY_ID=rzp_test_... RAZORPAY_KEY_SECRET=... node tools/razorpay_check.js
Runs against Razorpay test mode: creates an order and checks that refund lookups answer. Run it with your test keys, then do one full test-mode booking, payment, and refund by hand.

## Limits you should know
- One server instance only. State is held in memory and written to Postgres (or the file). A second instance is refused on its first write instead of overwriting data. Rate limits are also per instance.
- Uploads are on local disk. Use a persistent disk, or replace `server/uploads.js` with S3 or Supabase Storage (same five methods).
- Payouts to creators are manual: the admin sends UPI or bank transfer, then records the reference. Razorpay Route or RazorpayX would automate it.
- Receipts are payment receipts, not GST tax invoices.
- Razorpay calls follow its documented API. They are tested against a stub, not live keys.
- Cancellation and refund rules are simplified. Set your real policy.

## Legal pages
terms.html, privacy.html, refunds.html, contact.html are drafts. Every yellow [placeholder] must be replaced.
Have a lawyer review them before launch. Regenerate pages after edits: `python3 tools/build_pages.py`.

## Design
Direction: contact sheet. Film frames, edge codes, grain, one orange accent.
Fonts: Instrument Serif (display), Schibsted Grotesk (body), DM Mono (frame codes).
Hero frames in tools/build_pages.py are gradient placeholders. Swap `.fm` backgrounds for real portfolio photos.
Contrast checked for all colour pairs (4.5:1 or better), light and dark.

## Conversion (CRO)
- Browsing is public: browse.html needs no account. Sign-up happens at "Request", and the booking resumes after sign-up.
- Landing hero is a search form that GETs browse.html?type=&area=&date=.
- Add real customer quotes later: edit PROOF in tools/build_pages.py, then `python3 tools/build_pages.py`. The section stays hidden while PROOF is empty.
- Every main button has data-cta="..." for click tracking. No analytics is installed. If you add it, update the Privacy Policy cookie section.

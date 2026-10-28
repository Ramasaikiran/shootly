# Shootly (working name)

Node 20+ server, no framework. Static site and API in one process.

## Run
    npm install          # only jsdom, for tests
    npm run dev          # demo data + mock payments, http://localhost:3000
    npm test             # 79 tests: unit, integration, component, page

Demo logins (dev only): customer@demo.test, aarav@demo.test, meera@demo.test / Demo-pass-2026.
Admin: set ADMIN_EMAIL and ADMIN_PASSWORD, or read the password printed on first start.

## Production env
    NODE_ENV=production  RAZORPAY_KEY_ID=...  RAZORPAY_KEY_SECRET=...  RAZORPAY_WEBHOOK_SECRET=...
    TRUST_PROXY=1 (behind a proxy)  DATA_FILE=/path/data.json  PORT=3000
Webhook URL: POST /api/payments/webhook (events: payment.captured, payment.failed).
Production refuses to start without Razorpay keys. Serve over HTTPS.

## Not done yet
- Razorpay calls follow its documented API but are not tested against live keys.
- Storage is a JSON file. Move to Postgres or Supabase before real traffic.
- No email verification or password reset.
- Rate limits are in memory. Use Redis if you run more than one server.
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

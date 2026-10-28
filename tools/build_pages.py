import re,json
SITE="https://www.example.com/"
F=lambda t:f'<mark class="fill">[{t}]</mark>'
CO=F("Company legal name");ADDR=F("Registered address, Hyderabad, Telangana");SUP=F("support@yourdomain.com");GRV=F("Grievance Officer name");GEM=F("grievance@yourdomain.com")
UPD="26 October 2026"
FONTS='<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><link rel="stylesheet" href="shared.css">'
FAQ=[("How do I book a photographer in Hyderabad?","Pick a shoot type and area, compare verified creators and packages, then send a request. The creator accepts, you pay, and the booking is confirmed."),
("When is my booking confirmed?","Only after the creator accepts and your payment is verified. A request or a started payment alone does not confirm a booking."),
("What if the photographer cancels?","You are told straight away and shown replacement creators where available. You can accept one or take a full refund."),
("What is included in the price?","The price shown is all-in. Each package lists shoot hours, number of edited deliverables and the delivery deadline."),
("What if my photos arrive late or are not as agreed?","Report it from your booking. Support reviews the agreed scope and delivery record and decides on a fix or a refund. Read the Refund and Cancellation Policy for the details."),
("How are creators verified?","Creators submit ID and portfolio, and are reviewed manually before they are listed. Verification confirms identity, not artistic quality."),
("How do I pay, and is it safe?","Payments go through Razorpay. We never see or store your card or UPI details. You pay only after the creator accepts.")]
def head(title,desc,path,index=True,ld=""):
    return f'''<!DOCTYPE html>
<html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title><meta name="description" content="{desc}"><link rel="canonical" href="{SITE}{path}"><meta name="robots" content="{'index,follow,max-image-preview:large' if index else 'noindex,nofollow'}">
<meta name="geo.region" content="IN-TG"><meta name="geo.placename" content="Hyderabad"><meta property="og:type" content="website"><meta property="og:title" content="{title}"><meta property="og:description" content="{desc}"><meta property="og:url" content="{SITE}{path}"><meta property="og:locale" content="en_IN"><meta name="twitter:card" content="summary_large_image"><meta name="theme-color" content="#2442E8">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%232442E8'/><circle cx='16' cy='16' r='7' fill='none' stroke='white' stroke-width='3'/></svg>">
{FONTS}{ld}</head><body><a class="skip" href="#main">Skip to content</a>'''
HEADER='''<header class="top"><div class="wrap bar"><a class="logo" href="index.html">Shootly</a><nav class="links" aria-label="Main"><a class="l" href="index.html#how">How it works</a><a class="l" href="index.html#faq">FAQ</a><a class="l" href="auth.html">Sign in</a><a class="btn sm" href="browse.html" data-cta="header-browse">Find a photographer</a></nav></div></header>'''
FOOTER=f'''<footer class="foot"><div class="wrap fgrid"><div><a class="logo" href="index.html">Shootly</a><p>Verified photographers and videographers in Hyderabad. Pilot in progress.</p><p>Payments processed by Razorpay.</p></div>
<nav aria-label="Product"><h2>Product</h2><a href="browse.html">Find a photographer</a><a href="index.html#how">How it works</a><a href="index.html#faq">FAQ</a></nav>
<nav aria-label="Creators"><h2>Creators</h2><a href="auth.html?mode=register">Join as a creator</a><a href="auth.html">Creator sign in</a></nav>
<nav aria-label="Legal"><h2>Legal</h2><a href="terms.html">Terms and Conditions</a><a href="privacy.html">Privacy Policy</a><a href="refunds.html">Refund and Cancellation Policy</a><a href="contact.html">Contact and grievance</a></nav></div>
<div class="wrap fbase"><span>© 2026 {CO}. All rights reserved.</span><span>Support: {SUP}</span></div></footer>'''
CATS=[("Birthday","Parties, cake moments, candid fun"),("Family","Portraits at home or outdoors"),("Graduation","Convocation and campus shoots"),("Reel","Short videos for Instagram"),("Product","Clean photos for your store"),("Restaurant","Food, menu and venue content")]
def sv(d):return f'<svg class="ti" viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{d}</svg>'
TRUST=[(sv('<path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6z"/><path d="m9 12 2 2 4-4"/>'),"ID-verified creators","Reviewed by our team before they are listed."),
(sv('<path d="M4 12V4h8l8 8-8 8z"/><circle cx="8.5" cy="8.5" r="1.2"/>'),"All-in prices","The price you see is the price you pay."),
(sv('<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>'),"Pay after they accept","Free to request. No charge until accepted."),
(sv('<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>'),"Refund if they cancel",'Replacement or full refund. <a href="refunds.html">See the policy</a>.')]
PROOF=[]  # After launch, add real customer quotes: {"name":"Priya S.","shoot":"Birthday shoot","quote":"..."}
import html as _h
def proof():
    if not PROOF:return ''
    cards="".join(f'<figure class="card proof"><blockquote>“{_h.escape(q["quote"])}”</blockquote><figcaption>{_h.escape(q["name"])} · {_h.escape(q["shoot"])}</figcaption></figure>' for q in PROOF)
    return f'<section class="sect" aria-labelledby="h-proof"><p class="eyebrow">Customers</p><h2 id="h-proof">What customers say</h2><div class="three">{cards}</div></section>'
def finder():
    pills='<label class="rp"><input type="radio" name="type" value="" checked><span>Any shoot</span></label>'+"".join(f'<label class="rp"><input type="radio" name="type" value="{n}"><span>{n}</span></label>' for n,_ in CATS)
    areas='<option value="">Any area</option>'+"".join(f'<option>{a}</option>' for a in ["Madhapur","Banjara Hills","Gachibowli","Secunderabad"])
    return f'<form class="finder card" action="browse.html" method="get" aria-labelledby="fh"><h2 id="fh">What are you shooting?</h2><fieldset class="rpills"><legend class="sr">Shoot type</legend>{pills}</fieldset><div class="frow"><label>Area<select name="area">{areas}</select></label><label>Date<input type="date" name="date" id="fdate"></label></div><button class="btn lg block" type="submit" data-cta="hero-search">See available photographers</button><p class="micro">Free to request. Pay only after the creator accepts.</p></form>'
def home():
    faq="".join(f'<details class="q"><summary>{q}</summary><p>{a}</p></details>' for q,a in FAQ)
    cats="".join(f'<a class="cat" href="browse.html?type={n}" data-cta="category-{n.lower()}"><b>{n}</b><span>{d}</span></a>' for n,d in CATS)
    trust="".join(f'<li>{i}<div><b>{t}</b><span>{d}</span></div></li>' for i,t,d in TRUST)
    return f'''<main id="main" class="wrap">
<section class="hero2"><div class="hcopy"><p class="eyebrow">Hyderabad pilot</p><h1>Book a photographer who <em>shows up.</em></h1><p class="lead">Compare ID-verified photographers and videographers. See the all-in price and delivery date before you pay.</p>
<p class="alt-cta">Are you a photographer? <a href="auth.html?mode=register" data-cta="creator-link">Apply to be listed</a></p></div>{finder()}</section>
<section class="trust" aria-label="Why book with us"><ul>{trust}</ul></section>
<section class="sect" id="how" aria-labelledby="h-how"><p class="eyebrow">How it works</p><h2 id="h-how">Three steps. Nothing hidden.</h2>
<ol class="steps"><li><h3>Search and compare</h3><p class="mute">Choose shoot type, area and date. See packages, prices and delivery times. No account needed.</p></li><li><h3>Send a request</h3><p class="mute">Create a free account to send it. The creator accepts or declines. You are not charged yet.</p></li><li><h3>Pay to confirm</h3><p class="mute">Pay when accepted. Your slot is locked. Get your files by the deadline on your booking.</p></li></ol></section>
<section class="sect" id="shoots" aria-labelledby="h-shoots"><p class="eyebrow">What we cover</p><h2 id="h-shoots">Pick your kind of shoot</h2><div class="cats">{cats}</div></section>
<section class="sect" id="pricing" aria-labelledby="h-pr"><p class="eyebrow">Pricing</p><h2 id="h-pr">The price you see is the price you pay</h2><div class="split">
<div class="card"><h3>For customers</h3><p class="mute">Example: Mini shoot, 1 hr, 25 edited photos, delivered in 3 days.</p><table class="bill"><tr><td>Package price</td><td>₹2,500</td></tr><tr><td>Platform fees for you</td><td>₹0</td></tr><tr class="t"><td>You pay</td><td>₹2,500</td></tr></table><p class="micro">Pilot example. Creators set their own prices. {F("Confirm tax treatment")}</p></div>
<div class="card"><h3>For creators</h3><p class="mute">Same booking, from your side. We take a platform fee only on completed bookings.</p><table class="bill"><tr><td>Booking value</td><td>₹2,500</td></tr><tr><td>Platform fee (12%)</td><td>− ₹300</td></tr><tr class="t"><td>You earn</td><td>₹2,200</td></tr></table><p class="micro">Pilot fee. Shown before you accept any booking.</p></div></div></section>
{proof()}
<section class="sect" id="faq" aria-labelledby="h-f"><p class="eyebrow">FAQ</p><h2 id="h-f">Questions people ask</h2>{faq}</section>
<section class="sect" style="text-align:center"><h2>Ready for your shoot?</h2><p class="lede" style="margin-inline:auto">Browse creators now. No account needed until you send a request.</p><a class="btn lg" href="browse.html" data-cta="final-browse">See available photographers</a></section>
<section class="band2" aria-labelledby="h-c"><h2 id="h-c">Photographer or videographer?</h2><p>Get booking requests from people near you. Set your packages, prices and calendar. See payout status on every shoot. We list a small, reviewed group first.</p><a class="btn" href="auth.html?mode=register" data-cta="creator-band">Apply to be listed</a></section></main>
<div class="sticky"><a class="btn" href="browse.html" data-cta="sticky-browse">See available photographers</a></div><script src="landing.js" defer></script>'''
def ld():
    g=[{"@type":"Organization","@id":SITE+"#org","name":"Shootly","url":SITE,"areaServed":{"@type":"City","name":"Hyderabad"}},{"@type":"WebSite","url":SITE,"name":"Shootly","inLanguage":"en-IN"},
    {"@type":"Service","serviceType":"Photography and videography booking marketplace","provider":{"@id":SITE+"#org"},"areaServed":{"@type":"City","name":"Hyderabad"}},
    {"@type":"FAQPage","mainEntity":[{"@type":"Question","name":q,"acceptedAnswer":{"@type":"Answer","text":a}} for q,a in FAQ]}]
    return '<script type="application/ld+json">'+json.dumps({"@context":"https://schema.org","@graph":g},ensure_ascii=False)+"</script>"
STICKY='<style>.sticky{position:fixed;left:0;right:0;bottom:0;z-index:6;background:var(--card);border-top:1px solid var(--line);padding:10px 18px calc(10px + env(safe-area-inset-bottom,0px));display:none}@media (max-width:640px){.sticky{display:block}.sticky .btn{width:100%}.foot{margin-bottom:70px}}.three{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:16px}.cta{display:flex;gap:12px;flex-wrap:wrap}.micro{font-size:14px;color:var(--mute);margin:10px 0 0}</style>'
def ul(*x):return "<ul>"+"".join(f"<li>{i}</li>" for i in x)+"</ul>"
LEGAL={}
LEGAL["terms"]=("Terms and Conditions","The rules for using Shootly to book or offer photography and videography services.",f'''
<h2>About Shootly</h2><p>Shootly is an online marketplace run by {CO}, {ADDR}. We connect customers with independent photographers and videographers (“creators”). We are an intermediary. The shoot itself is a service provided by the creator, not by us.</p>
<h2>Eligibility and accounts</h2><p>You must be at least 18 and able to enter a binding contract in India. Give accurate details. Keep your password private. You are responsible for activity on your account. Tell us at once if you think someone else has access.</p>
<h2>How a booking works</h2>{ul("You send a request for a package, date and time slot.","The creator accepts or declines. Nothing is charged at this stage.","If the creator accepts, you pay through Razorpay.","The booking is confirmed only after the creator has accepted and your payment is verified. A request, or a payment you started but did not finish, does not confirm a booking.")}
<p>The package scope, price and delivery deadline are fixed when you send the request. A creator changing a package later does not change your booking.</p>
<h2>Prices and payments</h2><p>Prices are in Indian rupees and shown in full before you pay. {F("Confirm GST and tax wording")} Payments are processed by Razorpay. We do not see or store your card, UPI or bank details. For creators, a platform fee (currently 12% of the booking value) is deducted from the payout on completed bookings. Payout timing: {F("Add payout schedule")}.</p>
<h2>Cancellations, refunds and disputes</h2><p>These are set out in our <a href="refunds.html">Refund and Cancellation Policy</a>, which forms part of these Terms.</p>
<h2>Delivery and ownership of files</h2><p>The creator delivers the agreed files by secure link before the deadline on the booking. Unless you and the creator agree otherwise in writing, the creator keeps the copyright. You get a licence to use the delivered files for personal use and, for business bookings, for your own marketing. The creator may show the work in their portfolio. {F("Confirm default licence with your lawyer")}</p>
<h2>Rules for creators</h2>{ul("Submit true identity and portfolio details. We review them before listing you. Verification confirms identity, not quality.","Keep your calendar accurate. Accept only slots you can attend.","Show up, shoot to the agreed scope and deliver on time.","Keep bookings that started on Shootly, and their payments, on Shootly.")}
<h2>Reviews</h2><p>Only customers with a completed booking can review. Reviews must be honest. We may remove reviews that are fake, abusive or unrelated to the service.</p>
<h2>What you must not do</h2>{ul("Break the law or post unlawful, abusive or infringing content.","Create fake accounts or impersonate anyone.","Scrape the site, bypass rate limits or probe our security without written permission.","Interfere with other users’ bookings.")}
<p>We may suspend or close an account that breaks these rules.</p>
<h2>Our responsibility</h2><p>We take care to verify creators and run the platform properly. Because creators are independent, we are not responsible for their acts beyond what the law requires. We are not liable for indirect or consequential loss. Our total liability to you for any booking is limited to the amount you paid for that booking. Nothing here limits liability that cannot be limited by law.</p>
<h2>Changes and ending</h2><p>We may update these Terms. We will show the new date and, for material changes, tell you by email. You can close your account at any time. Bookings already confirmed stay covered by the Terms that applied when you made them.</p>
<h2>Governing law</h2><p>These Terms are governed by the laws of India. Courts at {F("Hyderabad, Telangana - confirm")} have jurisdiction. Questions or complaints: see <a href="contact.html">Contact and grievance</a>.</p>''')
LEGAL["privacy"]=("Privacy Policy","What personal data Shootly collects, why, who sees it, and your rights.",f'''
<h2>Who we are</h2><p>{CO}, {ADDR}, runs Shootly and decides how your personal data is used. This policy follows the principles of India’s Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.</p>
<h2>What we collect</h2>{ul("<b>Account:</b> name, email, a hashed password (we never keep the password itself), your role, and the time you accepted our policies.","<b>Creators:</b> area, shoot types, packages, portfolio and, when you submit them for verification, identity documents.","<b>Bookings:</b> date, time slot, shoot type, status and the history of changes.","<b>Payments:</b> order and payment IDs, amount and status. Card, UPI and bank details are handled by Razorpay and never reach us.","<b>Support:</b> messages you send us.","<b>Technical:</b> your IP address, used for security and rate limiting, and one session cookie.")}
<h2>Why we use it</h2>{ul("Create and secure your account.","Run bookings, payments, refunds and delivery.","Verify creators and prevent fraud and abuse.","Answer support requests and resolve disputes.","Meet legal and tax duties.")}
<p>We do not sell your data. We do not show ads.</p>
<h2>Who sees it</h2>{ul("<b>The other side of a booking.</b> Customers see a creator’s name, area, packages and reviews. Creators see the customer’s name and the booking details.","<b>Razorpay</b>, to process payments and refunds.","<b>Our hosting provider</b> ("+F("name")+"), to run the service.","<b>Authorities</b>, only when the law requires it.")}
<h2>Cookies</h2><p>We use one essential cookie, <code>sid</code>. It keeps you signed in, is HttpOnly, and lasts up to 7 days. We do not use advertising or analytics cookies. {F("Update this section if you add analytics")}</p>
<h2>How long we keep it</h2><p>Account data stays while your account is open. Booking and payment records are kept for {F("X years - confirm with your accountant")} to meet tax and legal duties. Sessions expire after 7 days. Identity documents are deleted {F("X days")} after a decision unless the law requires us to keep them.</p>
<h2>How we protect it</h2><p>Passwords are hashed. Access is limited by role. Login and payment endpoints are rate limited. Connections use HTTPS. No system is perfectly secure, and we will tell you and the authorities about serious breaches as the law requires.</p>
<h2>Your rights</h2><p>You can ask us to show you your data, correct it, delete it, or withdraw consent. You can also nominate someone to exercise these rights for you. Email {SUP}. We reply within {F("X days")}. Some records must be kept by law, and we will explain if we cannot delete them. If we do not resolve your complaint, you can approach the Data Protection Board of India.</p>
<h2>Children</h2><p>Shootly is for people aged 18 and over. We do not knowingly collect data from children.</p>
<h2>Changes and contact</h2><p>We will show the date of any update above. Questions or complaints: <a href="contact.html">Contact and grievance</a>.</p>''')
LEGAL["refunds"]=("Refund and Cancellation Policy","When you get a refund, how to ask for one, and how long it takes.",f'''
<h2>At a glance</h2><table><thead><tr><th>Situation</th><th>What happens</th></tr></thead><tbody>
<tr><td>You cancel before the creator accepts</td><td>Nothing was charged. Nothing to refund.</td></tr>
<tr><td>You cancel after paying, before the shoot starts</td><td>Full refund. {F("Confirm: pilot policy. Add a cut-off if you want one")}</td></tr>
<tr><td>The creator cancels or does not show</td><td>You choose a replacement creator or a full refund.</td></tr>
<tr><td>The slot was taken while you were paying</td><td>Automatic full refund.</td></tr>
<tr><td>Files are late</td><td>Report it after the delivery date. Support follows up. If files do not arrive, you get a refund.</td></tr>
<tr><td>Files are not as agreed</td><td>Report within 7 days of delivery. Support reviews and decides on a fix or a refund.</td></tr>
<tr><td>You are unhappy but files match the package</td><td>Not refundable by itself. Talk to support and we will try to help.</td></tr></tbody></table>
<h2>How to cancel</h2><p>Open your booking and choose Cancel booking. You can cancel while the booking is Requested, Accepted or Confirmed. Once the shoot has started, use Report an issue after delivery instead.</p>
<h2>If a creator cancels</h2><p>We tell you straight away and show replacement creators who are free at that time and charge the same or less. You can accept one or take a full refund. We never promise a replacement unless one is available.</p>
<h2>Late or missing files</h2><p>Each booking shows a delivery date. After that date, a Report missing files button appears on your booking. We contact the creator. If the files still do not arrive, you get a full refund.</p>
<h2>Files that are not as agreed</h2><p>Report an issue within 7 days of delivery and describe the problem. Support compares the delivery with the package you booked (hours, number of edited items, format) and the creator’s portfolio, then decides: ask the creator to fix it, a partial refund, or a full refund. We aim to decide within {F("X working days")}.</p>
<h2>How refunds are paid</h2><p>Refunds go back to the original payment method through Razorpay. We start approved refunds within {F("2 working days")}. Your bank or card issuer then usually takes 5 to 7 working days to show it.</p>
<h2>Not refundable</h2>{ul("Changes of mind after the files were delivered as agreed.","Differences of taste when the files match the package.","Delays or problems caused by the customer, such as wrong address or an unavailable venue.")}
<h2>Need help?</h2><p>Write to {SUP} with your booking ID. See <a href="contact.html">Contact and grievance</a>.</p>''')
LEGAL["contact"]=("Contact and Grievance","How to reach Shootly support and the Grievance Officer.",f'''
<h2>Support</h2>{ul("Email: "+SUP,"Phone: "+F("number"),"Hours: "+F("e.g. Mon to Sat, 10:00 to 18:00 IST"),"Please include your booking ID.")}
<h2>Grievance Officer</h2><p>As required under India’s Consumer Protection (E-Commerce) Rules, 2020 and the Information Technology Act, 2000:</p>{ul("Name: "+GRV,"Email: "+GEM,"Address: "+ADDR)}
<p>We acknowledge complaints within 48 hours and aim to resolve them within one month.</p>
<h2>Business details</h2>{ul("Legal name: "+CO,"Registered address: "+ADDR,"GSTIN: "+F("if applicable"))}
<h2>Policies</h2><p><a href="terms.html">Terms and Conditions</a> · <a href="privacy.html">Privacy Policy</a> · <a href="refunds.html">Refund and Cancellation Policy</a></p>''')
def legal_main(k):
    t,d,body=LEGAL[k];hs=re.findall(r'<h2>(.*?)</h2>',body)
    toc=''
    if len(hs)>4:
        body=re.sub(r'<h2>(.*?)</h2>',lambda m:f'<h2 id="s{hs.index(m.group(1))+1}">{m.group(1)}</h2>',body)
        toc='<nav class="toc" aria-label="On this page"><b>On this page</b><ol>'+"".join(f'<li><a href="#s{i+1}">{re.sub("<.*?>","",h)}</a></li>' for i,h in enumerate(hs))+'</ol></nav>'
    return f'<main id="main" class="wrap legal"><p class="crumb"><a href="index.html">Home</a> / {t}</p><h1>{t}</h1><p class="mute">Last updated: {UPD}</p>{toc}{body}</main>',t,d
import os
os.chdir('public')
open('index.html','w').write(head("Book a Photographer in Hyderabad | Shootly","Book verified photographers and videographers in Hyderabad. See the all-in price and delivery date first. Pay only after the creator accepts.","",True,ld()+STICKY)+HEADER+home()+FOOTER+"</body></html>")
for k in LEGAL:
    m,t,d=legal_main(k)
    open(f'{k}.html','w').write("<!-- Draft. Have a lawyer review before launch. Replace every highlighted [placeholder]. -->\n"+head(f"{t} | Shootly",d,f"{k}.html")+HEADER+m+FOOTER+"</body></html>")
BM,BD=("Find a Photographer or Videographer in Hyderabad | Shootly","Compare ID-verified photographers and videographers in Hyderabad. See all-in prices and delivery times. Free to request, pay only after the creator accepts.")
open('browse.html','w').write(head(BM,BD,"browse.html")+HEADER+'<main id="app" class="wrap"><noscript><h1 class="h1">Find a photographer in Hyderabad</h1><p>Turn on JavaScript to search creators and see prices.</p></noscript></main><dialog id="dlg"></dialog><script type="module" src="browse.js"></script>'+FOOTER+"</body></html>")
open('sitemap.xml','w').write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+"".join(f'<url><loc>{SITE}{p}</loc><lastmod>2026-10-26</lastmod><priority>{pr}</priority></url>\n' for p,pr in [("",1.0),("browse.html",.9),("terms.html",.3),("privacy.html",.3),("refunds.html",.4),("contact.html",.4)])+'</urlset>\n')
# preview: single page with hash views
css=open('shared.css').read()
pol=re.sub(r'^export ','',open('policy.js').read(),flags=re.M)
com=open('components.js').read();com=re.sub(r'^import .*\n','',com,flags=re.M);com=re.sub(r'^export ','',com,flags=re.M)
def rw(h):
    for a,b in [('auth.html?mode=register','#register'),('auth.html','#signin'),('browse.html?type=','#browse-'),('browse.html','#browse'),('customer.html','#signin'),('index.html#','#'),('index.html','#home'),('terms.html','#terms'),('privacy.html','#privacy'),('refunds.html','#refunds'),('contact.html','#contact')]:h=h.replace(f'href="{a}',f'href="{b}')
    return h
views={"home":home().replace('<main id="main" class="wrap">','<div>').replace('</main>','</div>')}
for k in LEGAL:
    m,_,_=legal_main(k);views[k]=m.replace('<main id="main" class="wrap legal">','<div class="wrap legal">').replace('</main>','</div>').replace('id="s',f'id="{k}-s').replace('href="#s',f'href="#{k}-s')
views["browse"]='<div class="wrap"><h1 class="h1">Find a photographer in Hyderabad</h1><p class="mute">Compare verified creators. Free to request. You pay only after the creator accepts. <b>(Preview data)</b></p><div class="pills" id="bpills" role="group" aria-label="Shoot type"></div><p class="mute" id="bcount" aria-live="polite"></p><div class="grid" id="bgrid"></div></div>'
views["signin"]='<div class="wrap authwrap"><div class="pitch"><h1>Your next shoot starts here.</h1><p class="mute">One account to book, or to take bookings. Your payment stays safe until the creator accepts.</p><p class="micro">Preview only. Nothing is saved.</p><div id="res" role="status"></div></div><div id="auth"></div></div>'
vh="".join(f'<section data-view="{k}" hidden>{rw(v)}</section>' for k,v in views.items())
js='''
const SAMPLE=[{id:"c1",name:"Aarav Reddy",area:"Madhapur",types:["Birthday","Family","Graduation"],exp:"6 yrs, Sony A7 IV",pk:[{n:"Mini shoot",h:1,d:"25 edited photos, online gallery",days:3,p:2500},{n:"Event coverage",h:3,d:"80 edited photos, 1 highlight reel",days:5,p:7500}]},
{id:"c2",name:"Meera Iyer",area:"Banjara Hills",types:["Reel","Restaurant","Product"],exp:"4 yrs, DJI + FX3",pk:[{n:"Reel pack",h:2,d:"3 edited reels, 30 to 45 sec",days:2,p:6000}]},
{id:"c3",name:"Rohan Das",area:"Gachibowli",types:["Product","Reel","Graduation","Birthday"],exp:"5 yrs, studio lights",pk:[{n:"Product 20",h:2,d:"20 retouched photos",days:3,p:4800},{n:"Birthday lite",h:1,d:"20 edited photos",days:3,p:2000}]}];
function renderBrowse(){const t=window.__t||"",a=window.__a||"";const l=SAMPLE.filter(c=>(!t||c.types.includes(t))&&(!a||c.area===a));
 document.querySelector("#bpills").innerHTML=["",...TYPES].map(x=>`<button type="button" class="pill" data-t="${esc(x)}" aria-pressed="${x===t}">${x||"All shoots"}</button>`).join("");
 document.querySelector("#bcount").textContent=l.length+" verified creator"+(l.length===1?"":"s");
 document.querySelector("#bgrid").innerHTML=l.length?l.map((c,i)=>creatorCard(c,i)).join(""):"<div class='card'>No creators match this filter.</div>"}
document.addEventListener("click",e=>{const p=e.target.closest("#bpills .pill");if(p){window.__t=p.dataset.t;renderBrowse();return}if(e.target.closest('#bgrid [data-act="book"]'))location.hash="register"});
document.addEventListener("submit",e=>{const f=e.target.closest(".finder");if(!f)return;e.preventDefault();const d=new FormData(f);window.__t=d.get("type")||"";window.__a=d.get("area")||"";location.hash="browse"});

const users={};const wait=ms=>new Promise(r=>setTimeout(r,ms));const fail=(m,f)=>{const e=new Error(m);e.field=f;return e};let mounted=null;
function show(){let h=location.hash.slice(1).split("?")[0]||"home";if(h==="register")h="signin";const map={signin:1,register:1};const names=[...document.querySelectorAll("[data-view]")].map(x=>x.dataset.view);if(h.startsWith('browse-')){window.__t=h.slice(7);h='browse'}else if(h==='browse'){window.__t=window.__t||''}\n let anchor=null;if(!names.includes(h)){const el=document.getElementById(h);if(el){anchor=h;h=el.closest("[data-view]").dataset.view}else h="home"}
 document.querySelectorAll("[data-view]").forEach(s=>s.hidden=s.dataset.view!==h);
 if(h==="signin"){const m=location.hash.includes("register")?"register":"login";if(mounted!==m){mounted=m;mountAuth(document.querySelector("#auth"),{mode:m,api:{async register(b){await wait(500);if(users[b.email])throw fail("An account with this email already exists.","email");users[b.email]=b;return{user:{name:b.name,role:b.role}}},async login(b){await wait(500);const u=users[b.email];if(!u||u.password!==b.password)throw fail("Email or password is wrong. In this preview, create an account first.");return{user:{name:u.name,role:u.role}}}},onDone:u=>{document.querySelector("#res").innerHTML='<div class="note">Signed in as '+esc(u.name)+' ('+esc(u.role)+'). The real site opens your panel now.</div>'}})}}
 if(h==='browse')renderBrowse();const t=anchor&&document.getElementById(anchor);if(t)t.scrollIntoView();else scrollTo(0,0)}
addEventListener("hashchange",show);show();
'''
nav=rw(HEADER).replace('#register','#register');foot=rw(FOOTER)
prev=head("Shootly preview","Preview","",False).split("{FONTS}")[0]
prev=f'''<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Shootly site preview</title><link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><style>{css}{STICKY}.note{{background:var(--greenbg);color:var(--green);border-radius:10px;padding:12px 14px;margin-top:12px;font-weight:600}}</style></head><body>{nav}<main id="main">{vh}</main>{foot}<script>{pol}\n{com}\n{js}</script></body></html>'''
open('/mnt/user-data/outputs/preview.html','w').write(prev);print(len(prev))

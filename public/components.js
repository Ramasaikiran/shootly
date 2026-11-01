import {passwordScore,passwordIssues,validEmail,validPhone,AREAS,TYPES,STATES,LOCATIONS,stateOf} from "./policy.js";
export const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export const areaOpts=(state,sel="",any=false)=>(any?'<option value="">Any area</option>':"")+(state?LOCATIONS[state]||[]:AREAS).map(a=>`<option ${a===sel?"selected":""}>${esc(a)}</option>`).join("");
export const stateAreaFields=({state="",area="",any=false,country=true}={})=>{const st=any?(state||stateOf(area)):(state||stateOf(area)||STATES[0]);
 return `${country?'<label>Country<select name="country" disabled><option>India</option></select></label>':""}<label>State<select name="state" data-any="${any}">${any?'<option value="">Any state</option>':""}${STATES.map(s=>`<option ${s===st?"selected":""}>${esc(s)}</option>`).join("")}</select></label><label>Area<select name="area">${areaOpts(st,area,any)}</select></label>`};
export function wireStateArea(root){const st=root.querySelector('select[name="state"]'),ar=root.querySelector('select[name="area"]');if(!st||!ar)return;st.addEventListener("change",()=>{ar.innerHTML=areaOpts(st.value,"",st.dataset.any==="true")})}
export const mapUrl=l=>"https://www.google.com/maps/search/?api=1&query="+(l.lat!=null&&l.lng!=null?l.lat+","+l.lng:encodeURIComponent([l.address,l.area,l.state,"India"].filter(Boolean).join(", ")));
export const inr=n=>"₹"+Number(n).toLocaleString("en-IN");
export const STAGES=["Requested","Accepted","Confirmed","In progress","Completed"];
export const tagFor=s=>["Confirmed","In progress","Completed"].includes(s)?"ok":["Declined","Cancelled","Refunded","Disputed"].includes(s)?"no":"wait";
export function strip(st){const i=STAGES.indexOf(st);return `<div class="strip" role="list">${STAGES.map((s,k)=>`<div class="fr ${i>k||st==="Completed"?"done":i===k?"now":""}" role="listitem"><b>${s}</b><span>${["Customer asks","Creator agrees","Paid and locked","Shoot day","Files delivered"][k]}</span></div>`).join("")}</div>`}
const CONFIRM={cancel:"Cancel this booking? If you have paid, you get a full refund.",decline:"Decline this booking? The customer is told straight away.",withdraw:"Pull out of this booking? The customer will be offered a replacement or a refund.",refund:"Refund this booking in full? This cannot be undone.","resolve-refund":"Refund the customer in full and close the dispute?"};
const btn=(act,id,label,cls="",extra="")=>`<button class="btn sm ${cls}" data-act="${act}" data-b="${esc(id)}" ${CONFIRM[act]?`data-confirm="${esc(CONFIRM[act])}"`:""} ${extra}>${label}</button> `;
const MON=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export const dateParts=d=>{const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(d||"");return m?{m:MON[+m[2]-1]||"",d:String(+m[3])}:{m:"",d:"?"}};
export const needsAction=(b,role)=>role==="customer"?(b.status==="Accepted"||b.status==="Cancelled"||(b.status==="Completed"&&!!b.delivery?.sent&&!b.review)):role==="creator"?(b.status==="Requested"||(b.status==="Completed"&&!!b.delivery&&!b.delivery.sent)):(b.status==="Disputed"||b.status==="Cancelled"||b.status==="Refund pending");
export function nextStep(b,role){const s=b.status,d=b.delivery;
 if(s==="Refund pending")return role==="admin"?"The refund failed at the payment provider. Retry it.":role==="customer"?"Your refund is being processed. We are on it.":"The customer's refund is being processed.";
 if(role!=="customer"&&s==="Completed"&&d?.sent&&b.payoutState)return b.payoutState==="paid"?`Payout sent. Reference ${b.payoutRef}.`:b.payoutState==="due"?"Payout is due. It is sent within a day or two.":"Payout is held for 7 days after delivery, in case of a problem.";
 if(role==="customer"){if(s==="Accepted")return `Creator accepted. Pay ${inr(b.price)} to lock your slot.`;if(s==="Cancelled")return b.offers?.length?"Your creator cancelled. Pick a replacement or take a refund.":"Your creator cancelled. You can take a full refund.";
  if(s==="Completed"&&d?.sent&&!b.review)return "Your files are ready. Open them, then leave a review.";if(s==="Completed"&&d&&!d.sent)return `Files are due by ${d.due}.`}
 if(role==="creator"){if(s==="Requested")return "New request. Accept or decline.";if(s==="Confirmed")return `Paid and confirmed. Shoot on ${b.date} at ${b.slot}.`;if(s==="Completed"&&d&&!d.sent)return `Send the files by ${d.due}.`}
 if(role==="admin"){if(s==="Disputed")return "Customer reported an issue. Decide on a refund.";if(s==="Cancelled")return "Creator cancelled. Find replacements or refund."}
 return ""}
export function track(st){const i=STAGES.indexOf(st);return `<ol class="track" aria-label="Progress: ${esc(st)}">${STAGES.map((s,k)=>`<li class="${st==="Completed"||i>k?"done":i===k?"now":""}"><span>${esc(s)}</span></li>`).join("")}</ol>`}
export function bookingActions(b,role){let a="";const id=b.id,d=b.delivery;
 if(role==="customer"){if(b.status==="Accepted")a+=btn("pay",id,`Pay ${inr(b.price)} to confirm`);
  if(["Requested","Accepted","Confirmed"].includes(b.status))a+=btn("cancel",id,"Cancel booking","alt");
  if(b.status==="Cancelled"){if(b.offers?.length)a+=`<p class="mute">Replacements at the same price or lower:</p>`+b.offers.map(o=>btn("swap",id,`${esc(o.name)}, ${esc(o.pkgName)} ${inr(o.price)}`,"alt",`data-c="${esc(o.creatorId)}"`)).join("");a+=btn("refund",id,"Take full refund")}
  if(b.status==="Completed"&&d&&!d.sent&&d.due<new Date(Date.now()+19800000).toISOString().slice(0,10))a+=`<span class="inl"><input aria-label="Describe the problem" data-reason placeholder="Files are late" maxlength="500">${btn("issue",id,"Report missing files","bad")}</span>`;
  if(b.status==="Completed"&&d?.sent){a+=`<a class="btn alt sm" href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">Open your files</a> `;
   if(!b.review)a+=`<span class="inl"><select aria-label="Rating" data-rating>${[5,4,3,2,1].map(n=>`<option>${n}</option>`).join("")}</select><input aria-label="Review comment (optional)" data-comment placeholder="Say how it went (optional)" maxlength="500">${btn("review",id,"Leave review","alt")}</span><span class="inl"><input aria-label="What went wrong" data-reason placeholder="What went wrong?" maxlength="500">${btn("issue",id,"Report an issue","bad")}</span>`}}
 if(role==="creator"){if(b.status==="Requested")a+=btn("accept",id,"Accept")+btn("decline",id,"Decline","bad");
  if(b.status==="Accepted")a+=btn("decline",id,"Withdraw","bad");if(b.status==="Confirmed")a+=btn("start",id,"Start shoot")+btn("withdraw",id,"I can’t make it","bad");
  if(b.status==="In progress")a+=btn("complete",id,"Mark shoot complete");
  if(b.status==="Completed"&&!d?.sent)a+=`<span class="inl"><input aria-label="Link to files" data-url type="url" placeholder="https://link-to-gallery" maxlength="500">${btn("deliver",id,"Send files")}</span>`}
 if(role==="admin"){if(b.status==="Cancelled")a+=btn("offers",id,"Find replacements")+btn("refund",id,"Refund customer","alt");
  if(b.status==="Refund pending")a+=btn("retry-refund",id,"Retry refund");if(b.status==="Disputed")a+=btn("resolve-refund",id,"Refund customer")+btn("resolve-reject",id,"Reject dispute","alt")}
 return a}
export function bookingCard(b,role){const dead=["Declined","Cancelled","Refunded","Disputed","Refund pending"].includes(b.status),who=role==="customer"?`with ${esc(b.creatorName)}`:`for ${esc(b.customerName||"customer")}`,p=dateParts(b.date),nx=nextStep(b,role),attn=needsAction(b,role);
 return `<article class="card bc${attn?" attn":""}" data-id="${esc(b.id)}"><div class="dt" aria-hidden="true"><small>${esc(p.m)}</small><b>${esc(p.d)}</b></div><div class="bcb">
<div class="row"><h3>${esc(b.pkg.n)} ${who}</h3><span class="tag ${tagFor(b.status)}">${esc(b.status)}</span></div>
<ul class="meta"><li>${esc(b.date)} · ${esc(b.slot)}</li><li>${esc(b.type)}</li><li>${inr(b.price)} all-in</li>${role!=="customer"?`<li>${role==="creator"?"Your":"Creator"} payout ${inr(b.payout)}</li>`:""}${b.payment?`<li>Payment ${esc(b.payment)}</li>`:""}${b.review?`<li>Rated ${esc(b.review.rating)}/5</li>`:""}</ul>
${b.loc?`<p class="where"><b>Shoot location:</b> ${esc(b.loc.address)}${b.loc.landmark?`, near ${esc(b.loc.landmark)}`:""}, ${esc(b.loc.area)}, ${esc(b.loc.state)} · <a href="${esc(mapUrl(b.loc))}" target="_blank" rel="noopener noreferrer">Open in Maps</a></p>`:""}${b.customerPhone?`<p class="where">Customer phone: <a href="tel:+91${esc(b.customerPhone)}">+91 ${esc(b.customerPhone)}</a></p>`:""}${b.reason?`<p class="mute">Issue: ${esc(b.reason)}</p>`:""}${nx?`<p class="next">${esc(nx)}</p>`:""}${dead?"":track(b.status)}<div class="acts">${bookingActions(b,role)}</div>
<details><summary class="mute">Booking history</summary><p class="mute">${b.log.map(esc).join(" → ")}</p></details></div></article>`}
const initials=n=>String(n||"?").trim().split(/\s+/).slice(0,2).map(x=>x[0]||"").join("").toUpperCase();
export function creatorCard(c,hue=0,dated=false){const H=["#2442E8","#E8426B","#16A37F","#B97800","#7B4DFF","#D2541A"];
 return `<article class="card cc"><div class="top"><div class="av" aria-hidden="true" style="background:${H[hue%6]}">${esc(initials(c.name))}</div><div><h3>${esc(c.name)}</h3><div class="mute">Based in ${esc(c.area)} · ${esc(c.exp)}${c.rating?.count?` · ★ ${esc(c.rating.avg)} (${esc(c.rating.count)})`:""}</div></div><span class="tag ok">ID verified</span></div>${c.cover?`<img class="cover" src="${esc(c.cover)}" alt="Sample work by ${esc(c.name)}" loading="lazy">`:""}${c.bio?`<p class="mute bio">${esc(c.bio.length>140?c.bio.slice(0,137)+"…":c.bio)}</p>`:""}
<div class="chips">${c.types.map(t=>`<span class="tag">${esc(t)}</span>`).join(" ")}${dated&&c.free?` <span class="tag wait">Free: ${c.free.map(esc).join(", ")}</span>`:""}</div>
${c.pk.map((p,i)=>`<div class="pkr"><div><b>${esc(p.n)}</b><div class="mute">${esc(p.h)} hr · ${esc(p.d)} · files in ${esc(p.days)} days</div></div><div class="pkp"><b>${inr(p.p)}</b><button class="btn sm" data-act="book" data-c="${esc(c.id)}" data-p="${i}">Request</button></div></div>`).join("")}<a class="mute" href="profile.html?c=${esc(c.id)}">See full profile and reviews</a></article>`}
const LABEL=["Add characters","Underexposed","Dim","Balanced","Well exposed"];
export function exposureMeter(score){return `<div class="exp" role="meter" aria-label="Password strength" aria-valuemin="0" aria-valuemax="4" aria-valuenow="${score}" aria-valuetext="${LABEL[score]}">${[1,2,3,4].map(n=>`<i class="${score>=n?"on s"+score:""}"></i>`).join("")}<span>${LABEL[score]}</span></div>`}
export function mountAuth(root,{api,onDone,mode="login"}){const doc=root.ownerDocument;let m=mode;
 const draw=()=>{const reg=m==="register";root.innerHTML=`<div class="vf" id="vf"><i class="cn tl"></i><i class="cn tr"></i><i class="cn bl"></i><i class="cn br"></i><i class="iris" aria-hidden="true"></i>
<div class="seg" role="tablist" aria-label="Account"><button role="tab" type="button" id="tab-login" aria-selected="${!reg}">Sign in</button><button role="tab" type="button" id="tab-register" aria-selected="${reg}">Create account</button></div>
<form id="af" novalidate aria-labelledby="tab-${m}">
${reg?`<fieldset class="who"><legend>I’m here to</legend><label class="dial"><input type="radio" name="role" value="customer" checked><span><b>Book a shoot</b><small>Find and pay a creator</small></span></label><label class="dial"><input type="radio" name="role" value="creator"><span><b>Take bookings</b><small>List your work</small></span></label></fieldset>
<label>Your name<input name="name" autocomplete="name" maxlength="60" required></label><p class="fe" data-for="name" role="alert"></p>`:""}
<label>Email<input name="email" type="email" autocomplete="email" maxlength="254" required></label><p class="fe" data-for="email" role="alert"></p>
${reg?`<label>Mobile number<span class="phone"><span class="cc2" aria-hidden="true">+91</span><input name="phone" type="tel" inputmode="numeric" autocomplete="tel-national" maxlength="14" placeholder="98765 43210" required></span></label><p class="fe" data-for="phone" role="alert"></p>`:""}
<label>Password<span class="pw"><input name="password" type="password" autocomplete="${reg?"new-password":"current-password"}" maxlength="128" required><button type="button" class="btn alt sm" data-show aria-pressed="false">Show</button></span></label><p class="fe" data-for="password" role="alert"></p>
${reg?"":`<p class="fp"><a href="reset.html">Forgot password?</a></p>`}
${reg?`<div id="meter">${exposureMeter(0)}</div><ul class="hints" id="hints"></ul><div id="cx" hidden>${stateAreaFields()}<fieldset class="types"><legend>Shoots you take</legend>${TYPES.map(t=>`<label class="chk"><input type="checkbox" name="types" value="${esc(t)}"> ${esc(t)}</label>`).join("")}</fieldset><p class="fe" data-for="types" role="alert"></p></div>`:""}
${reg?`<label class="chk agree"><input type="checkbox" name="agree"> <span>I agree to the <a href="terms.html" target="_blank" rel="noopener">Terms</a>, <a href="privacy.html" target="_blank" rel="noopener">Privacy Policy</a> and <a href="refunds.html" target="_blank" rel="noopener">Refund Policy</a>.</span></label><p class="fe" data-for="agree" role="alert"></p>`:""}<p class="fe" id="err" role="alert" aria-live="polite"></p><button class="btn lg" type="submit" id="go">${reg?"Create account":"Sign in"}</button></form></div>`;wire()};
 function wire(){const f=root.querySelector("#af"),q=s=>root.querySelector(s),setErr=(k,t)=>{const e=k?q(`[data-for="${k}"]`):q("#err");if(e)e.textContent=t||""};
  q("#tab-login").onclick=()=>{m="login";draw()};q("#tab-register").onclick=()=>{m="register";draw()};
  q("[data-show]").onclick=e=>{const i=f.elements.password,on=i.type==="password";i.type=on?"text":"password";e.target.textContent=on?"Hide":"Show";e.target.setAttribute("aria-pressed",String(on))};
  if(m==="register"){wireStateArea(q("#cx"));const upd=()=>{const pw=f.elements.password.value;q("#meter").innerHTML=exposureMeter(passwordScore(pw));q("#hints").innerHTML=pw?passwordIssues(pw,f.elements.email.value).map(x=>`<li>${esc(x)}</li>`).join(""):""};
   f.elements.password.addEventListener("input",upd);f.elements.email.addEventListener("input",upd);
   f.addEventListener("change",e=>{if(e.target.name==="role")q("#cx").hidden=e.target.value!=="creator"})}
  f.addEventListener("submit",async e=>{e.preventDefault();root.querySelectorAll(".fe").forEach(x=>x.textContent="");const d=Object.fromEntries(new FormData(f));const errs={};
   if(m==="register"){if(String(d.name||"").trim().length<2)errs.name="Enter your name.";if(!validPhone(d.phone))errs.phone="Enter a valid 10-digit mobile number."}
   if(!validEmail(d.email))errs.email="Enter a valid email.";
   if(m==="register"){const i=passwordIssues(d.password,d.email);if(i.length)errs.password=i[0];if(!f.elements.agree.checked)errs.agree="Please accept the Terms and Privacy Policy.";if(d.role==="creator"&&!f.querySelectorAll('[name="types"]:checked').length)errs.types="Pick at least one shoot type."}
   else if(!d.password)errs.password="Enter your password.";
   const first=Object.keys(errs)[0];if(first){for(const k in errs)setErr(k,errs[k]);f.elements[first]?.focus?.();return}
   const body={email:d.email,password:d.password};if(m==="register"){Object.assign(body,{name:d.name,role:d.role,phone:d.phone,agree:true});if(d.role==="creator"){body.state=d.state;body.area=d.area;body.types=[...f.querySelectorAll('[name="types"]:checked')].map(x=>x.value)}}
   const go=q("#go"),label=go.textContent;go.disabled=true;go.textContent=m==="register"?"Creating…":"Signing in…";
   try{const r=await api[m](body);q("#vf").classList.add("open");onDone(r.user)}catch(er){go.disabled=false;go.textContent=label;setErr(er.field&&q(`[data-for="${er.field}"]`)?er.field:null,er.message||"Something went wrong. Try again.")}})}
 draw()}

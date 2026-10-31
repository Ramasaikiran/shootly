import {AREAS,TYPES,SLOTS,stateOf,normPhone,passwordIssues,validEmail} from "../public/policy.js";
import {hashPassword,verifyPassword,DUMMY_HASH,newToken,sha,encrypt,decrypt} from "./security.js";
import {memoryUploads,decodeUpload} from "./uploads.js";
import {scryptSync} from "node:crypto";
export class HttpError extends Error{constructor(status,message,field){super(message);this.status=status;this.field=field}}
const E=(s,m,f)=>new HttpError(s,m,f);
const LIVE=["Requested","Accepted","Confirmed","In progress"],HELD=["Confirmed","In progress"],FEE=0.12,SESSION_MS=7*864e5,DISPUTE_MS=7*864e5;
const UPI=/^[\w.\-]{2,64}@[A-Za-z]{2,32}$/,IFSC=/^[A-Z]{4}0[A-Z0-9]{6}$/,DAY=/^\d{4}-\d{2}-\d{2}$/;
const clean=(s,max)=>String(s??"").replace(/[\u0000-\u001f\u007f<>]/g,"").trim().slice(0,max);
export function createService({store,gateway,now=()=>new Date(),demo=false,mailer=null,uploads=null,publicUrl="",encKey=null}){
const D=store.d,IST=19800000;D.tokens||={};D.audit||=[];
const mail=mailer||{send:async()=>{}},up=uploads||memoryUploads(),KEY=encKey||scryptSync("shootly-test-key","shootly",32);
const today=()=>new Date(now().getTime()+IST).toISOString().slice(0,10);
const addDays=(ymd,n)=>new Date(Date.parse(ymd+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const bk=id=>D.bookings.find(b=>b.id===id),cr=id=>D.creators.find(c=>c.id===id),creatorOf=u=>D.creators.find(c=>c.userId===u.id);
const held=(b,o)=>o!==b&&o.creatorId===b.creatorId&&o.date===b.date&&o.slot===b.slot&&HELD.includes(o.status);
const clash=b=>D.bookings.some(o=>held(b,o));
const blockedOn=(cid,date)=>!!cr(cid)?.blocked?.includes(date);
const slotTaken=(cid,date,slot)=>blockedOn(cid,date)||D.bookings.some(o=>o.creatorId===cid&&o.date===date&&o.slot===slot&&HELD.includes(o.status));
const setSt=(b,s,n)=>{b.status=s;b.log.push(s+(n?` (${n})`:""))};
const payOf=id=>D.payments.find(p=>p.bookingId===id&&["created","paid","refunded","refund_failed"].includes(p.status));
const uview=u=>({id:u.id,name:u.name,email:u.email,phone:u.phone||"",role:u.role,emailVerified:!!u.emailVerified});
const ensureIds=c=>{for(const p of c.pk)if(!p.id)p.id=store.id("k")};
function audit(user,action,target="",detail=""){D.audit.push({id:store.id("a"),at:now().toISOString(),actor:user?.id||"system",actorName:user?.name||"system",action,target:String(target),detail:String(detail).slice(0,300)});if(D.audit.length>5000)D.audit.splice(0,D.audit.length-5000)}
const upErr=fn=>{try{return fn()}catch(e){if(e instanceof HttpError)throw e;throw E(400,e.message,"file")}};
const needCreator=user=>{const c=creatorOf(user);if(!c)throw E(403,"Creators only.");return c};
const needAdmin=u=>{if(u.role!=="admin")throw E(403,"Admins only.")};
// ---- accounts
function register({name,email,password,role,area,types,state,phone}){
 name=clean(name,60);email=String(email||"").trim().toLowerCase();
 if(name.length<2)throw E(400,"Enter your name.","name");
 if(!validEmail(email))throw E(400,"Enter a valid email.","email");
 if(!["customer","creator"].includes(role))throw E(400,"Choose customer or creator.","role");
 phone=normPhone(phone);if(!phone)throw E(400,"Enter a valid 10-digit Indian mobile number.","phone");
 const issues=passwordIssues(password,email);if(issues.length)throw E(400,issues[0],"password");
 if(role==="creator"){if(!AREAS.includes(area))throw E(400,"Pick your main area.","area");if(state&&stateOf(area)!==state)throw E(400,"That area is not in the selected state.","area");
  if(!Array.isArray(types)||!types.length||!types.every(t=>TYPES.includes(t)))throw E(400,"Pick at least one shoot type.","types")}
 if(D.users.some(u=>u.email===email))throw E(409,"An account with this email already exists.","email");
 const u={id:store.id("u"),name,email,role,phone,passHash:hashPassword(password),emailVerified:false,createdAt:now().toISOString()};D.users.push(u);sendVerification(u).catch(e=>console.error("verification email failed:",e.message));
 if(role==="creator")D.creators.push({id:store.id("c"),userId:u.id,name,country:"India",state:stateOf(area),area,types:[...new Set(types)],exp:"New on the platform",ver:"pending",pk:[]});
 return uview(u)}
function recordConsent(id){const u=D.users.find(x=>x.id===id);if(u)u.consent={at:now().toISOString(),docs:["terms","privacy","refunds"],v:"2026-10-26"}}
function createAdmin(email,password){const u={id:store.id("u"),name:"Admin",email:email.toLowerCase(),role:"admin",passHash:hashPassword(password),emailVerified:true,createdAt:now().toISOString()};D.users.push(u);return u}
function login({email,password}){email=String(email||"").trim().toLowerCase();const u=D.users.find(x=>x.email===email);
 const ok=verifyPassword(String(password||""),u?u.passHash:DUMMY_HASH);if(!u||!ok)throw E(401,"Email or password is wrong.");if(u.disabled)throw E(403,"This account is disabled. Contact support.");
 const t0=now().getTime();for(const k of Object.keys(D.sessions))if(D.sessions[k].exp<t0)delete D.sessions[k];
 const token=newToken();D.sessions[sha(token)]={userId:u.id,exp:now().getTime()+SESSION_MS};return{user:uview(u),token}}
function authenticate(token){if(!token)return null;const k=sha(token),s=D.sessions[k];if(!s)return null;if(s.exp<now().getTime()){delete D.sessions[k];return null}
 const u=D.users.find(x=>x.id===s.userId);return u&&!u.disabled?uview(u):null}
const logout=token=>{if(token)delete D.sessions[sha(token)]};
// ---- creators
function listCreators({area,type,date,budget,state}={},){let l=D.creators.filter(c=>c.ver==="verified"&&c.pk.length);
 if(state&&!area)l=l.filter(c=>stateOf(c.area)===state);
 if(area&&AREAS.includes(area))l=l.filter(c=>c.area===area);if(type&&TYPES.includes(type))l=l.filter(c=>c.types.includes(type));
 if(budget&&+budget>0)l=l.filter(c=>c.pk.some(p=>p.p<=+budget));
 return l.map(c=>{ensureIds(c);return c}).map(c=>({id:c.id,name:c.name,area:c.area,state:stateOf(c.area),types:c.types,exp:c.exp,bio:c.bio||"",rating:ratingOf(c),cover:portView(c)[0]?.url||null,pk:c.pk,free:date&&validDate(date)?SLOTS.filter(s=>!slotTaken(c.id,date,s)):SLOTS})).filter(c=>c.free.length)}
function checkPackage(b){const n=clean(b.n,40),d=clean(b.d,200),h=+b.h,days=+b.days,p=+b.p;
 if(n.length<2)throw E(400,"Name the package.","n");if(!Number.isInteger(h)||h<1||h>12)throw E(400,"Hours must be 1 to 12.","h");
 if(d.length<5)throw E(400,"Describe what is delivered.","d");if(!Number.isInteger(days)||days<1||days>60)throw E(400,"Delivery days must be 1 to 60.","days");
 if(!Number.isInteger(p)||p<500||p>200000)throw E(400,"Price must be ₹500 to ₹2,00,000.","p");return{n,h,d,days,p}}
function addPackage(user,b){const c=needCreator(user);ensureIds(c);const v=checkPackage(b);if(c.pk.length>=6)throw E(400,"Six packages is the limit.");c.pk.push({id:store.id("k"),...v});return c}
function editPackage(user,id,b){const c=needCreator(user);ensureIds(c);const p=c.pk.find(x=>x.id===id);if(!p)throw E(404,"Package not found.");Object.assign(p,checkPackage(b));return c}
function deletePackage(user,id){const c=needCreator(user);ensureIds(c);const i=c.pk.findIndex(x=>x.id===id);if(i<0)throw E(404,"Package not found.");
 if(D.bookings.some(b=>b.creatorId===c.id&&b.pkgId===id&&LIVE.includes(b.status)))throw E(409,"This package has open bookings. Finish or cancel them first.");c.pk.splice(i,1);return c}
function setCreatorStatus(user,id,ver){needAdmin(user);const c=cr(id);if(!c)throw E(404,"Creator not found.");
 if(ver==="verified"){if(!c.idDoc)throw E(409,"This creator has not uploaded an ID yet.");if(!D.users.find(x=>x.id===c.userId)?.emailVerified)throw E(409,"This creator has not verified their email yet.")}
 c.ver=ver;audit(user,ver==="verified"?"creator.approve":"creator.suspend",c.id,c.name);return c}
// ---- bookings
function makeBooking(user,{creatorId,pk,date,slot,type,area,address,landmark,lat,lng,phone}){
 if(user.role!=="customer")throw E(403,"Only customers can book.");
 if(!user.emailVerified)throw E(403,"Verify your email before booking. We sent you a link.");
 const c=cr(creatorId);if(!c||c.ver!=="verified")throw E(404,"Creator not found.");ensureIds(c);
 const p=c.pk[pk];if(!Number.isInteger(pk)||!p)throw E(400,"Pick a package.","pk");
 if(!validDate(date))throw E(400,"Pick a valid date.","date");if(date<today())throw E(400,"Pick a date from today onwards.","date");if(date>addDays(today(),365))throw E(400,"Pick a date within a year.","date");
 if(!SLOTS.includes(slot))throw E(400,"Pick a time slot.","slot");if(!c.types.includes(type))throw E(400,"This creator does not offer that shoot type.","type");
 if(!AREAS.includes(area))throw E(400,"Pick the area where the shoot will happen.","area");
 if(stateOf(area)!==stateOf(c.area))throw E(409,`This creator works in ${stateOf(c.area)}. Pick an area in ${stateOf(c.area)}.`,"area");
 address=clean(address,300);if(address.length<10)throw E(400,"Enter the full address where the creator should come.","address");landmark=clean(landmark,80);
 const ph=normPhone(phone||user.phone);if(!ph)throw E(400,"Enter a mobile number the creator can reach on shoot day.","phone");
 const la=lat===""||lat==null?NaN:+lat,lo=lng===""||lng==null?NaN:+lng,pin=la>=6&&la<=38&&lo>=68&&lo<=98?{lat:Math.round(la*1e5)/1e5,lng:Math.round(lo*1e5)/1e5}:null;
 if(blockedOn(c.id,date))throw E(409,"This creator is not available on that date.","date");if(slotTaken(c.id,date,slot))throw E(409,"That slot is taken. Pick another time.","slot");
 if(D.bookings.some(o=>o.customerId===user.id&&o.creatorId===c.id&&o.date===date&&o.slot===slot&&LIVE.includes(o.status)))throw E(409,"You already have a request for this slot.");
 const au=D.users.find(x=>x.id===user.id);if(au&&!au.phone)au.phone=ph;
 const b={id:store.id("B"),customerId:user.id,creatorId:c.id,loc:{country:"India",state:stateOf(area),area,address,landmark,...(pin||{})},phone:ph,pkgIdx:pk,pkgId:p.id,pkg:{n:p.n,h:p.h,d:p.d,days:p.days,p:p.p},price:p.p,date,slot,type,status:"Requested",log:["Requested"],delivery:null,review:null,reason:null,offers:null,createdAt:now().toISOString()};D.bookings.push(b);return b}
function replacements(b){return D.creators.filter(c=>c.ver==="verified"&&c.id!==b.creatorId&&(!b.loc||stateOf(c.area)===b.loc.state)&&c.types.includes(b.type)&&!slotTaken(c.id,b.date,b.slot))
 .map(c=>({c,i:c.pk.findIndex(p=>p.p<=b.price)})).filter(x=>x.i>=0).map(x=>({creatorId:x.c.id,pk:x.i}))}
// true = refunded, false = provider failed (payment stays refund_failed, retryable), null = nothing to refund
async function refundPayment(p){if(!p||!["paid","refund_failed"].includes(p.status))return null;
 try{const done=await gateway.findRefund?.(p.paymentId,p.amount),r=done||await gateway.refund(p.paymentId,p.amount);p.status="refunded";p.refundId=r.id;delete p.refundError;return true}
 catch(e){p.status="refund_failed";p.refundError=String(e.message||"Refund failed").slice(0,200);p.refundTries=(p.refundTries||0)+1;audit(null,"refund.failed",p.bookingId,p.refundError);return false}}
const settle=(b,ok,note)=>ok===false?setSt(b,"Refund pending",note+"; payment provider failed, admin notified"):setSt(b,"Refunded",note);
const payoutDueAt=b=>Date.parse(b.delivery.at)+DISPUTE_MS;
const payoutState=b=>!(b.status==="Completed"&&b.delivery?.sent)?null:b.payoutPaid?"paid":now().getTime()>=payoutDueAt(b)?"due":"holding";
const payoutAmt=b=>Math.round(b.price*(1-FEE));
function view(b,user){const c=cr(b.creatorId),cu=D.users.find(u=>u.id===b.customerId),p=payOf(b.id);
 const v={id:b.id,status:b.status,date:b.date,slot:b.slot,type:b.type,pkg:b.pkg,price:b.price,creatorName:c?.name,loc:b.loc||null,log:b.log,delivery:b.delivery,review:b.review,reason:b.reason,payment:p?.status||null,
 offers:b.offers?b.offers.map(o=>({creatorId:o.creatorId,pk:o.pk,name:cr(o.creatorId)?.name,pkgName:cr(o.creatorId)?.pk[o.pk]?.n,price:cr(o.creatorId)?.pk[o.pk]?.p})):null};
 if(user.role!=="customer"){v.customerName=cu?.name;if(user.role==="admin"||["Confirmed","In progress","Completed"].includes(b.status))v.customerPhone=b.phone||cu?.phone||null;v.payout=payoutAmt(b);v.payoutState=payoutState(b);v.payoutRef=b.payoutPaid?.ref||null}return v}
function listBookings(user){let l=D.bookings;if(user.role==="customer")l=l.filter(b=>b.customerId===user.id);else if(user.role==="creator"){const c=creatorOf(user);l=c?l.filter(b=>b.creatorId===c.id):[]}
 return l.slice().reverse().map(b=>view(b,user))}
async function act(user,id,action,body={}){const b=bk(id);if(!b)throw E(404,"Booking not found.");
 const cp=creatorOf(user),isC=user.role==="customer"&&b.customerId===user.id,isP=user.role==="creator"&&!!cp&&b.creatorId===cp.id,isA=user.role==="admin";
 if(!isC&&!isP&&!isA)throw E(404,"Booking not found.");
 const need=ok=>{if(!ok)throw E(403,"You can’t do that on this booking.")},from=(...s)=>{if(!s.includes(b.status))throw E(409,`This can’t be done while the booking is ${b.status}.`)};
 switch(action){
 case"accept":need(isP);from("Requested");if(cr(b.creatorId).ver!=="verified")throw E(403,"Your account is not verified.");if(blockedOn(b.creatorId,b.date))throw E(409,"You marked this date as unavailable.");if(clash(b))throw E(409,"This clashes with a confirmed shoot.");setSt(b,"Accepted");break;
 case"decline":need(isP);from("Requested","Accepted");setSt(b,"Declined");break;
 case"cancel":need(isC);from("Requested","Accepted","Confirmed");if(b.status==="Confirmed"){settle(b,await refundPayment(payOf(b.id)),"cancelled by customer")}else setSt(b,"Cancelled","by customer");break;
 case"withdraw":need(isP);from("Accepted","Confirmed");setSt(b,"Cancelled","by creator");b.offers=replacements(b);break;
 case"refund":need(isC||isA);from("Cancelled");settle(b,await refundPayment(payOf(b.id)),"full refund");if(isA)audit(user,"booking.refund",b.id);break;
 case"retry-refund":{need(isA);from("Refund pending");const ok=await refundPayment(payOf(b.id));audit(user,"refund.retry",b.id,ok?"ok":"failed");if(ok===false){const e=E(502,"The payment provider refused again: "+(payOf(b.id)?.refundError||"unknown error"));e.persist=true;throw e}setSt(b,"Refunded","refund retried by admin");break}
 case"offers":need(isA);from("Cancelled");b.offers=replacements(b);audit(user,"booking.offers",b.id);break;
 case"swap":{need(isC);from("Cancelled");const offered=(b.offers||[]).find(x=>x.creatorId===body.creatorId),o=offered&&replacements(b).find(x=>x.creatorId===offered.creatorId);if(!o)throw E(409,"That replacement is no longer available.");
  const nb=makeBooking(user,{creatorId:o.creatorId,pk:o.pk,date:b.date,slot:b.slot,type:b.type,...(b.loc||{}),phone:b.phone});settle(b,await refundPayment(payOf(b.id)),"moved to replacement");return view(nb,user)}
 case"start":need(isP);from("Confirmed");if(!demo&&today()<b.date)throw E(409,"A shoot can start on its shoot date.");setSt(b,"In progress");break;
 case"complete":need(isP);from("In progress");setSt(b,"Completed");b.delivery={due:addDays(today(),b.pkg.days),sent:false};break;
 case"deliver":{need(isP);from("Completed");let u;try{u=new URL(String(body.url))}catch{throw E(400,"Enter a valid https link.","url")}if(u.protocol!=="https:"||String(body.url).length>500)throw E(400,"Enter a valid https link.","url");
  b.delivery={...b.delivery,sent:true,url:u.href,at:now().toISOString()};b.log.push("Delivered");break}
 case"review":{need(isC);from("Completed");if(!b.delivery?.sent)throw E(409,"Review after files are delivered.");if(b.review)throw E(409,"You already reviewed this booking.");const r=+body.rating;if(!Number.isInteger(r)||r<1||r>5)throw E(400,"Rate from 1 to 5.","rating");b.review={rating:r,comment:clean(body.comment,500),at:now().toISOString()};b.log.push("Reviewed");break}
 case"issue":{need(isC);from("Completed");if(b.delivery?.sent){if(now().getTime()-Date.parse(b.delivery.at)>7*864e5)throw E(409,"The 7-day window to report an issue has passed.")}else if(!(b.delivery&&today()>b.delivery.due))throw E(409,"You can report missing files after the delivery date.");const r=clean(body.reason,500);if(r.length<5)throw E(400,"Describe the problem.","reason");b.reason=r;setSt(b,"Disputed","issue reported");break}
 case"resolve":need(isA);from("Disputed");if(body.decision==="refund"){settle(b,await refundPayment(payOf(b.id)),"dispute resolved")}else if(body.decision==="reject")setSt(b,"Completed","dispute rejected");else throw E(400,"Choose refund or reject.");audit(user,"dispute."+body.decision,b.id);break;
 default:throw E(400,"Unknown action.")}
 return view(b,user)}
// ---- payments
async function createOrder(user,bookingId){const b=bk(bookingId);if(!b||b.customerId!==user.id)throw E(404,"Booking not found.");if(b.status!=="Accepted")throw E(409,"Pay after the creator accepts.");
 if(slotTaken(b.creatorId,b.date,b.slot))throw E(409,"That slot was just taken.");
 let p=D.payments.find(x=>x.bookingId===b.id&&x.status==="created");
 if(!p){const o=await gateway.createOrder({amount:b.price*100,receipt:b.id});p={id:store.id("p"),bookingId:b.id,orderId:o.id,amount:b.price*100,paymentId:null,status:"created"};D.payments.push(p)}
 return{orderId:p.orderId,amount:p.amount,currency:"INR",keyId:gateway.keyId,mock:!!gateway.mock}}
async function finalize(p,paymentId){const b=bk(p.bookingId);if(p.status==="paid"||p.status==="refunded"||p.status==="refund_failed")return{booking:b,duplicate:true};
 p.paymentId=paymentId;p.status="paid";p.paidAt=now().toISOString();
 if(b.status!=="Accepted"||clash(b)){if(b.status==="Accepted"){setSt(b,"Cancelled","slot taken");b.offers=replacements(b)}await refundPayment(p);audit(null,"payment.auto_refund",b.id,"slot taken or booking changed");return{booking:b,refunded:true}}
 setSt(b,"Confirmed","payment verified");return{booking:b}}
async function verifyPayment(user,{bookingId,orderId,paymentId,signature}){const b=bk(bookingId);if(!b||b.customerId!==user.id)throw E(404,"Booking not found.");
 const p=D.payments.find(x=>x.bookingId===b.id&&x.orderId===orderId);if(!p)throw E(404,"Order not found.");
 if(!gateway.verifyPayment(orderId,String(paymentId),String(signature)))throw E(400,"Payment could not be verified.");
 const r=await finalize(p,paymentId);return{booking:view(r.booking,user),refunded:!!r.refunded}}
async function webhook(raw,sig,eventId){if(!gateway.verifyWebhook(raw,sig))throw E(400,"Bad signature.");
 if(eventId&&D.events[eventId])return{duplicate:true};
 let ev;try{ev=JSON.parse(raw)}catch{throw E(400,"Bad payload.")}
 const e=ev?.payload?.payment?.entity,p=e&&D.payments.find(x=>x.orderId===e.order_id);
 if(p){if(ev.event==="payment.captured"){if(e.amount!==p.amount)throw E(400,"Amount mismatch.");await finalize(p,e.id)}
  else if(ev.event==="payment.failed"&&p.status==="created")p.status="failed"}
 const rf=ev?.payload?.refund?.entity,rp=rf&&D.payments.find(x=>x.paymentId&&x.paymentId===rf.payment_id);
 if(rp){if(ev.event==="refund.processed"){rp.status="refunded";rp.refundId=rf.id;delete rp.refundError;const rb=bk(rp.bookingId);if(rb?.status==="Refund pending")setSt(rb,"Refunded","refund processed")}else if(ev.event==="refund.failed"){rp.status="refund_failed";rp.refundError="Provider reported the refund failed";audit(null,"refund.failed",rp.bookingId,rp.refundError)}}
 if(eventId){const t=now().getTime();for(const k of Object.keys(D.events))if(t-D.events[k]>7*864e5)delete D.events[k];D.events[eventId]=t}
 return{ok:true}}
// ---- email verification, password reset, account
function issueToken(u,kind,ttlMs){const t0=now().getTime();for(const k of Object.keys(D.tokens))if(D.tokens[k].exp<t0)delete D.tokens[k];const t=newToken();D.tokens[sha(t)]={userId:u.id,kind,exp:t0+ttlMs};return t}
function takeToken(t,kind){const k=sha(String(t||"")),r=D.tokens[k];if(!r||r.kind!==kind||r.exp<now().getTime())throw E(400,"This link is invalid or has expired.");const u=D.users.find(x=>x.id===r.userId);if(!u)throw E(400,"This link is invalid or has expired.");return{k,u}}
async function sendVerification(u){const t=issueToken(u,"verify",48*36e5);await mail.send({to:u.email,subject:"Verify your Shootly email",text:`Hi ${u.name},\n\nConfirm your email address to start booking or get listed:\n${publicUrl}/verify.html#t=${t}\n\nThis link works for 48 hours. If you did not create a Shootly account, ignore this email.`})}
function resendVerification(user){const u=D.users.find(x=>x.id===user.id);if(u.emailVerified)throw E(409,"Your email is already verified.");sendVerification(u).catch(e=>console.error("verification email failed:",e.message));return{ok:true}}
function verifyEmail(token){const{k,u}=takeToken(token,"verify");u.emailVerified=true;delete D.tokens[k];return uview(u)}
async function forgot(email){const u=D.users.find(x=>x.email===String(email||"").trim().toLowerCase());if(!u||u.disabled)return;const t=issueToken(u,"reset",36e5);
 await mail.send({to:u.email,subject:"Reset your Shootly password",text:`Hi ${u.name},\n\nReset your password:\n${publicUrl}/reset.html#t=${t}\n\nThis link works for 1 hour. If you did not ask for this, ignore this email. Your password stays the same.`})}
const dropSessions=(uid,except)=>{for(const k of Object.keys(D.sessions))if(D.sessions[k].userId===uid&&k!==except)delete D.sessions[k]};
function setPassword(u,password){const issues=passwordIssues(password,u.email);if(issues.length)throw E(400,issues[0],"password");u.passHash=hashPassword(password)}
function resetPassword({token,password}){const{k,u}=takeToken(token,"reset");setPassword(u,password);u.emailVerified=true;delete D.tokens[k];for(const x of Object.keys(D.tokens))if(D.tokens[x].userId===u.id&&D.tokens[x].kind==="reset")delete D.tokens[x];dropSessions(u.id);return{ok:true}}
function updateName(user,name,phone){const u=D.users.find(x=>x.id===user.id);name=clean(name,60);if(name.length<2)throw E(400,"Enter your name.","name");if(phone!==undefined){const ph=normPhone(phone);if(!ph)throw E(400,"Enter a valid 10-digit Indian mobile number.","phone");u.phone=ph}u.name=name;const c=creatorOf(u);if(c)c.name=name;return uview(u)}
function changePassword(user,{current,password},token){const u=D.users.find(x=>x.id===user.id);if(!verifyPassword(String(current||""),u.passHash))throw E(400,"Your current password is wrong.","current");setPassword(u,password);dropSessions(u.id,token?sha(token):null);return{ok:true}}
const logoutAll=user=>{dropSessions(user.id);return{ok:true}};
function resetPasswordFor(email,password){const u=D.users.find(x=>x.email===String(email).trim().toLowerCase());if(!u)throw new Error("No user with that email.");setPassword(u,password);u.emailVerified=true;u.disabled=false;dropSessions(u.id);return uview(u)}
// ---- creator profile, availability, files, payout details
const firstName=n=>String(n||"").split(" ")[0];
const portView=c=>(c.portfolio||[]).map(x=>({id:x.id,url:"/uploads/"+x.file,caption:x.caption||""}));
const ratingOf=c=>{const r=D.bookings.filter(b=>b.creatorId===c.id&&b.review).map(b=>b.review.rating);return r.length?{avg:Math.round(r.reduce((a,b)=>a+b,0)/r.length*10)/10,count:r.length}:{avg:0,count:0}};
function getCreator(id){const c=cr(id);if(!c||c.ver!=="verified"||!c.pk.length)throw E(404,"Creator not found.");ensureIds(c);
 const reviews=D.bookings.filter(b=>b.creatorId===c.id&&b.review).slice(-10).reverse().map(b=>({rating:b.review.rating,comment:b.review.comment||"",date:(b.review.at||b.createdAt||"").slice(0,10),by:firstName(D.users.find(u=>u.id===b.customerId)?.name)}));
 return{id:c.id,name:c.name,area:c.area,state:stateOf(c.area),types:c.types,exp:c.exp,bio:c.bio||"",pk:c.pk,portfolio:portView(c),rating:ratingOf(c),reviews}}
function updateProfile(user,{area,types,bio,exp}){const c=needCreator(user);
 if(!AREAS.includes(area))throw E(400,"Pick your main area.","area");if(!Array.isArray(types)||!types.length||!types.every(t=>TYPES.includes(t)))throw E(400,"Pick at least one shoot type.","types");
 c.area=area;c.state=stateOf(area);c.country="India";c.types=[...new Set(types)];c.bio=clean(bio,600);const e=clean(exp,60);if(e)c.exp=e;return c}
function setBlocked(user,{date,blocked}){const c=needCreator(user);if(!DAY.test(String(date))||!validDate(date))throw E(400,"Pick a valid date.","date");if(date<today())throw E(400,"Pick a date from today onwards.","date");if(date>addDays(today(),365))throw E(400,"Pick a date within a year.","date");
 c.blocked||=[];if(blocked===false){c.blocked=c.blocked.filter(x=>x!==date);return c}
 if(D.bookings.some(b=>b.creatorId===c.id&&b.date===date&&HELD.includes(b.status)))throw E(409,"You have a confirmed shoot on that date.","date");
 if(c.blocked.length>=180)throw E(400,"You can block up to 180 dates.","date");if(!c.blocked.includes(date))c.blocked.push(date);c.blocked.sort();return c}
function addPortfolio(user,{data,caption}){const c=needCreator(user);c.portfolio||=[];if(c.portfolio.length>=12)throw E(400,"Twelve photos is the limit. Remove one first.","file");
 const{buf,ext}=upErr(()=>decodeUpload(data,{max:2*1048576,allow:["jpg","png","webp"]}));c.portfolio.push({id:store.id("f"),file:up.putPublic(buf,ext),caption:clean(caption,80),at:now().toISOString()});return c}
function removePortfolio(user,id){const c=needCreator(user),i=(c.portfolio||[]).findIndex(x=>x.id===id);if(i<0)throw E(404,"Photo not found.");up.remove("public",c.portfolio[i].file);c.portfolio.splice(i,1);return c}
function setIdDoc(user,{data}){const c=needCreator(user);const{buf,ext}=upErr(()=>decodeUpload(data,{max:3*1048576,allow:["jpg","png","pdf"]}));
 if(c.idDoc)up.remove("private",c.idDoc.file);c.idDoc={file:up.putPrivate(buf,ext),ext,at:now().toISOString()};audit(user,"creator.id_uploaded",c.id,c.name);return c}
function readIdDoc(admin,creatorId){needAdmin(admin);const c=cr(creatorId);if(!c?.idDoc)throw E(404,"No ID uploaded.");const f=up.readPrivate(c.idDoc.file);if(!f)throw E(404,"ID file is missing. Ask the creator to upload it again.");audit(admin,"creator.id_viewed",c.id,c.name);return f}
function setPayout(user,{holder,upi,account,ifsc}){const c=needCreator(user);holder=clean(holder,60);if(holder.length<2)throw E(400,"Enter the account holder name.","holder");
 if(upi){upi=String(upi).trim();if(!UPI.test(upi))throw E(400,"Enter a valid UPI ID, like name@bank.","upi");const[n,h]=upi.split("@");c.payout={holder,kind:"upi",mask:n.slice(0,2)+"***@"+h,cipher:encrypt(KEY,JSON.stringify({upi})),at:now().toISOString()};return c}
 account=String(account||"").replace(/\s/g,"");ifsc=String(ifsc||"").trim().toUpperCase();if(!/^\d{9,18}$/.test(account))throw E(400,"Account number must be 9 to 18 digits.","account");if(!IFSC.test(ifsc))throw E(400,"Enter a valid IFSC code.","ifsc");
 c.payout={holder,kind:"bank",mask:"••••"+account.slice(-4)+" · "+ifsc,cipher:encrypt(KEY,JSON.stringify({account,ifsc})),at:now().toISOString()};return c}
// ---- admin: payouts, payments, users, audit
function payouts(admin){needAdmin(admin);const rows=D.bookings.filter(b=>payoutState(b)).map(b=>{const c=cr(b.creatorId),state=payoutState(b);let dest=null;
  if(state==="due"&&c?.payout){try{dest={holder:c.payout.holder,kind:c.payout.kind,...JSON.parse(decrypt(KEY,c.payout.cipher))}}catch{dest={holder:c.payout.holder,error:"Could not decrypt. Ask the creator to re-enter details."}}}
  return{bookingId:b.id,creatorId:b.creatorId,creatorName:c?.name,amount:payoutAmt(b),state,dueAt:new Date(payoutDueAt(b)).toISOString().slice(0,10),hasPayout:!!c?.payout,destination:dest,ref:b.payoutPaid?.ref||null,paidAt:b.payoutPaid?.at||null}});
 const order={due:0,holding:1,paid:2};return rows.sort((a,b)=>order[a.state]-order[b.state]||a.dueAt.localeCompare(b.dueAt))}
function markPayoutPaid(admin,bookingId,ref){needAdmin(admin);const b=bk(bookingId);if(!b)throw E(404,"Booking not found.");const st=payoutState(b);if(st==="paid")throw E(409,"Already marked paid.");if(st!=="due")throw E(409,"Not due yet. Payouts are held for 7 days after delivery.");
 ref=clean(ref,60);if(ref.length<4)throw E(400,"Enter the UPI or bank reference.","ref");b.payoutPaid={ref,at:now().toISOString(),by:admin.id};b.log.push("Payout paid");audit(admin,"payout.paid",b.id,ref);return{ok:true}}
const payRow=p=>{const b=bk(p.bookingId),c=b&&cr(b.creatorId),cu=b&&D.users.find(u=>u.id===b.customerId);return{id:p.id,bookingId:p.bookingId,amount:p.amount/100,status:p.status,paymentId:p.paymentId,paidAt:p.paidAt||null,error:p.refundError||null,tries:p.refundTries||0,bookingStatus:b?.status,creatorName:c?.name,customerName:cu?.name,date:b?.date,pkgName:b?.pkg?.n,receipt:["paid","refunded","refund_failed"].includes(p.status)}};
function adminPayments(admin){needAdmin(admin);return D.payments.slice().reverse().map(payRow)}
function listPayments(user){if(user.role==="admin")return adminPayments(user);if(user.role!=="customer")return[];return D.payments.filter(p=>bk(p.bookingId)?.customerId===user.id&&p.status!=="created"&&p.status!=="failed").reverse().map(p=>{const r=payRow(p);delete r.customerName;delete r.error;delete r.tries;return r})}
async function retryRefund(admin,id){needAdmin(admin);const p=D.payments.find(x=>x.id===id);if(!p)throw E(404,"Payment not found.");if(p.status!=="refund_failed")throw E(409,"Nothing to retry on this payment.");
 const ok=await refundPayment(p),b=bk(p.bookingId);audit(admin,"refund.retry",p.bookingId,ok?"ok":p.refundError);
 if(ok&&b?.status==="Refund pending")setSt(b,"Refunded","refund retried by admin");if(!ok){const e=E(502,"The payment provider refused again: "+p.refundError);e.persist=true;throw e}return{ok:true}}
function receipt(user,bookingId){const b=bk(bookingId);if(!b||(user.role==="customer"?b.customerId!==user.id:user.role!=="admin"))throw E(404,"Receipt not found.");
 const p=D.payments.find(x=>x.bookingId===b.id&&["paid","refunded","refund_failed"].includes(x.status));if(!p)throw E(404,"No payment was made for this booking.");
 const cu=D.users.find(u=>u.id===b.customerId),c=cr(b.creatorId);return{receiptNo:`SH-${b.id}-${p.id}`,bookingId:b.id,customerName:cu?.name,customerEmail:cu?.email,creatorName:c?.name,pkg:b.pkg,date:b.date,slot:b.slot,type:b.type,amount:p.amount/100,paymentId:p.paymentId,orderId:p.orderId,paidAt:p.paidAt||null,paymentStatus:p.status,note:"This is a payment receipt, not a GST tax invoice."}}
function adminUsers(admin){needAdmin(admin);return D.users.map(u=>({id:u.id,name:u.name,email:u.email,role:u.role,emailVerified:!!u.emailVerified,disabled:!!u.disabled,createdAt:u.createdAt,bookings:D.bookings.filter(b=>b.customerId===u.id||(creatorOf(u)&&b.creatorId===creatorOf(u).id)).length})).reverse()}
function setUserDisabled(admin,id,disabled){needAdmin(admin);const u=D.users.find(x=>x.id===id);if(!u)throw E(404,"User not found.");if(u.role==="admin")throw E(403,"Admin accounts cannot be disabled here.");
 u.disabled=!!disabled;if(disabled){dropSessions(u.id);const c=creatorOf(u);if(c)c.ver="suspended"}audit(admin,disabled?"user.disable":"user.enable",u.id,u.email);return{ok:true}}
function listAudit(admin,{limit=100,action}={}){needAdmin(admin);let l=D.audit;if(action)l=l.filter(a=>a.action.startsWith(String(action)));return l.slice(-Math.min(Math.max(+limit||100,1),500)).reverse()}
function stats(u){needAdmin(u);const n=s=>D.bookings.filter(b=>b.status===s).length,sum=f=>D.payments.filter(f).reduce((a,p)=>a+p.amount,0)/100;
 const done=D.bookings.filter(b=>b.status==="Completed"&&b.delivery?.sent),rows=D.bookings.filter(b=>payoutState(b));
 return{bookings:D.bookings.length,completed:n("Completed"),cancelled:n("Cancelled"),disputed:n("Disputed"),refundPending:n("Refund pending"),failedRefunds:D.payments.filter(p=>p.status==="refund_failed").length,
  collected:sum(p=>p.status==="paid"),refunded:sum(p=>p.status==="refunded"),stuck:sum(p=>p.status==="refund_failed"),feeEarned:done.reduce((a,b)=>a+b.price-payoutAmt(b),0),
  payoutsDue:rows.filter(b=>payoutState(b)==="due").reduce((a,b)=>a+payoutAmt(b),0),payoutsHolding:rows.filter(b=>payoutState(b)==="holding").reduce((a,b)=>a+payoutAmt(b),0),payoutsPaid:rows.filter(b=>payoutState(b)==="paid").reduce((a,b)=>a+payoutAmt(b),0)}}
return{register,recordConsent,createAdmin,login,authenticate,logout,logoutAll,listCreators,getCreator,addPackage,editPackage,deletePackage,setCreatorStatus,makeBooking:(u,b)=>view(makeBooking(u,b),u),listBookings,act,createOrder,verifyPayment,webhook,
 verifyEmail,resendVerification,forgot,resetPassword,resetPasswordFor,updateName,changePassword,
 updateProfile,setBlocked,addPortfolio,removePortfolio,setIdDoc,readIdDoc,setPayout,
 payouts,markPayoutPaid,adminPayments,listPayments,retryRefund,receipt,adminUsers,setUserDisabled,listAudit,stats,uploads:up,
 adminCreators:u=>{needAdmin(u);return D.creators.map(c=>({id:c.id,name:c.name,area:c.area,ver:c.ver,packages:c.pk.length,hasId:!!c.idDoc,idAt:c.idDoc?.at||null,emailVerified:!!D.users.find(x=>x.id===c.userId)?.emailVerified,hasPayout:!!c.payout}))},
 myCreator:u=>{const c=creatorOf(u);if(!c)return null;ensureIds(c);return{id:c.id,name:c.name,area:c.area,state:stateOf(c.area),country:"India",ver:c.ver,types:c.types,exp:c.exp,bio:c.bio||"",pk:c.pk,blocked:c.blocked||[],portfolio:portView(c),hasId:!!c.idDoc,idAt:c.idDoc?.at||null,idKind:c.idDoc?.ext||null,payout:c.payout?{holder:c.payout.holder,kind:c.payout.kind,mask:c.payout.mask}:null}},
 _today:today}}

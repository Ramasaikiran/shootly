import {AREAS,TYPES,SLOTS,passwordIssues,validEmail} from "../public/policy.js";
import {hashPassword,verifyPassword,DUMMY_HASH,newToken,sha} from "./security.js";
export class HttpError extends Error{constructor(status,message,field){super(message);this.status=status;this.field=field}}
const E=(s,m,f)=>new HttpError(s,m,f);
const LIVE=["Requested","Accepted","Confirmed","In progress"],HELD=["Confirmed","In progress"],FEE=0.12,SESSION_MS=7*864e5;
const clean=(s,max)=>String(s??"").replace(/[\u0000-\u001f\u007f<>]/g,"").trim().slice(0,max);
export function createService({store,gateway,now=()=>new Date(),demo=false}){
const D=store.d,IST=19800000;
const today=()=>new Date(now().getTime()+IST).toISOString().slice(0,10);
const addDays=(ymd,n)=>new Date(Date.parse(ymd+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
const validDate=s=>/^\d{4}-\d{2}-\d{2}$/.test(s)&&new Date(s+"T00:00:00Z").toISOString().slice(0,10)===s;
const bk=id=>D.bookings.find(b=>b.id===id),cr=id=>D.creators.find(c=>c.id===id),creatorOf=u=>D.creators.find(c=>c.userId===u.id);
const held=(b,o)=>o!==b&&o.creatorId===b.creatorId&&o.date===b.date&&o.slot===b.slot&&HELD.includes(o.status);
const clash=b=>D.bookings.some(o=>held(b,o));
const slotTaken=(cid,date,slot)=>D.bookings.some(o=>o.creatorId===cid&&o.date===date&&o.slot===slot&&HELD.includes(o.status));
const setSt=(b,s,n)=>{b.status=s;b.log.push(s+(n?` (${n})`:""))};
const payOf=id=>D.payments.find(p=>p.bookingId===id&&["created","paid","refunded","refund_failed"].includes(p.status));
const uview=u=>({id:u.id,name:u.name,email:u.email,role:u.role});
// ---- accounts
function register({name,email,password,role,area,types}){
 name=clean(name,60);email=String(email||"").trim().toLowerCase();
 if(name.length<2)throw E(400,"Enter your name.","name");
 if(!validEmail(email))throw E(400,"Enter a valid email.","email");
 if(!["customer","creator"].includes(role))throw E(400,"Choose customer or creator.","role");
 const issues=passwordIssues(password,email);if(issues.length)throw E(400,issues[0],"password");
 if(role==="creator"){if(!AREAS.includes(area))throw E(400,"Pick your main area.","area");
  if(!Array.isArray(types)||!types.length||!types.every(t=>TYPES.includes(t)))throw E(400,"Pick at least one shoot type.","types")}
 if(D.users.some(u=>u.email===email))throw E(409,"An account with this email already exists.","email");
 const u={id:store.id("u"),name,email,role,passHash:hashPassword(password),createdAt:now().toISOString()};D.users.push(u);
 if(role==="creator")D.creators.push({id:store.id("c"),userId:u.id,name,area,types:[...new Set(types)],exp:"New on the platform",ver:"pending",pk:[]});
 return uview(u)}
function recordConsent(id){const u=D.users.find(x=>x.id===id);if(u)u.consent={at:now().toISOString(),docs:["terms","privacy","refunds"],v:"2026-10-26"}}
function createAdmin(email,password){const u={id:store.id("u"),name:"Admin",email:email.toLowerCase(),role:"admin",passHash:hashPassword(password),createdAt:now().toISOString()};D.users.push(u);return u}
function login({email,password}){email=String(email||"").trim().toLowerCase();const u=D.users.find(x=>x.email===email);
 const ok=verifyPassword(String(password||""),u?u.passHash:DUMMY_HASH);if(!u||!ok)throw E(401,"Email or password is wrong.");
 const t0=now().getTime();for(const k of Object.keys(D.sessions))if(D.sessions[k].exp<t0)delete D.sessions[k];
 const token=newToken();D.sessions[sha(token)]={userId:u.id,exp:now().getTime()+SESSION_MS};return{user:uview(u),token}}
function authenticate(token){if(!token)return null;const k=sha(token),s=D.sessions[k];if(!s)return null;if(s.exp<now().getTime()){delete D.sessions[k];return null}
 const u=D.users.find(x=>x.id===s.userId);return u?uview(u):null}
const logout=token=>{if(token)delete D.sessions[sha(token)]};
// ---- creators
function listCreators({area,type,date,budget}={},){let l=D.creators.filter(c=>c.ver==="verified"&&c.pk.length);
 if(area&&AREAS.includes(area))l=l.filter(c=>c.area===area);if(type&&TYPES.includes(type))l=l.filter(c=>c.types.includes(type));
 if(budget&&+budget>0)l=l.filter(c=>c.pk.some(p=>p.p<=+budget));
 return l.map(c=>({id:c.id,name:c.name,area:c.area,types:c.types,exp:c.exp,pk:c.pk,free:date&&validDate(date)?SLOTS.filter(s=>!slotTaken(c.id,date,s)):SLOTS})).filter(c=>c.free.length)}
function addPackage(user,b){const c=creatorOf(user);if(!c)throw E(403,"Creators only.");
 const n=clean(b.n,40),d=clean(b.d,200),h=+b.h,days=+b.days,p=+b.p;
 if(n.length<2)throw E(400,"Name the package.","n");if(!Number.isInteger(h)||h<1||h>12)throw E(400,"Hours must be 1 to 12.","h");
 if(d.length<5)throw E(400,"Describe what is delivered.","d");if(!Number.isInteger(days)||days<1||days>60)throw E(400,"Delivery days must be 1 to 60.","days");
 if(!Number.isInteger(p)||p<500||p>200000)throw E(400,"Price must be ₹500 to ₹2,00,000.","p");if(c.pk.length>=6)throw E(400,"Six packages is the limit.");
 c.pk.push({n,h,d,days,p});return c}
function setCreatorStatus(user,id,ver){if(user.role!=="admin")throw E(403,"Admins only.");const c=cr(id);if(!c)throw E(404,"Creator not found.");c.ver=ver;return c}
// ---- bookings
function makeBooking(user,{creatorId,pk,date,slot,type}){
 if(user.role!=="customer")throw E(403,"Only customers can book.");
 const c=cr(creatorId);if(!c||c.ver!=="verified")throw E(404,"Creator not found.");
 const p=c.pk[pk];if(!Number.isInteger(pk)||!p)throw E(400,"Pick a package.","pk");
 if(!validDate(date))throw E(400,"Pick a valid date.","date");if(date<today())throw E(400,"Pick a date from today onwards.","date");if(date>addDays(today(),365))throw E(400,"Pick a date within a year.","date");
 if(!SLOTS.includes(slot))throw E(400,"Pick a time slot.","slot");if(!c.types.includes(type))throw E(400,"This creator does not offer that shoot type.","type");
 if(slotTaken(c.id,date,slot))throw E(409,"That slot is taken. Pick another time.","slot");
 if(D.bookings.some(o=>o.customerId===user.id&&o.creatorId===c.id&&o.date===date&&o.slot===slot&&LIVE.includes(o.status)))throw E(409,"You already have a request for this slot.");
 const b={id:store.id("B"),customerId:user.id,creatorId:c.id,pkgIdx:pk,pkg:{...p},price:p.p,date,slot,type,status:"Requested",log:["Requested"],delivery:null,review:null,reason:null,offers:null,createdAt:now().toISOString()};D.bookings.push(b);return b}
function replacements(b){return D.creators.filter(c=>c.ver==="verified"&&c.id!==b.creatorId&&c.types.includes(b.type)&&!slotTaken(c.id,b.date,b.slot))
 .map(c=>({c,i:c.pk.findIndex(p=>p.p<=b.price)})).filter(x=>x.i>=0).map(x=>({creatorId:x.c.id,pk:x.i}))}
async function refundPayment(p){if(!p||p.status!=="paid")return;try{await gateway.refund(p.paymentId,p.amount);p.status="refunded"}catch{p.status="refund_failed"}}
function view(b,user){const c=cr(b.creatorId),cu=D.users.find(u=>u.id===b.customerId),p=payOf(b.id);
 const v={id:b.id,status:b.status,date:b.date,slot:b.slot,type:b.type,pkg:b.pkg,price:b.price,creatorName:c?.name,log:b.log,delivery:b.delivery,review:b.review,reason:b.reason,payment:p?.status||null,
 offers:b.offers?b.offers.map(o=>({creatorId:o.creatorId,pk:o.pk,name:cr(o.creatorId)?.name,pkgName:cr(o.creatorId)?.pk[o.pk]?.n,price:cr(o.creatorId)?.pk[o.pk]?.p})):null};
 if(user.role!=="customer"){v.customerName=cu?.name;v.payout=Math.round(b.price*(1-FEE))}return v}
function listBookings(user){let l=D.bookings;if(user.role==="customer")l=l.filter(b=>b.customerId===user.id);else if(user.role==="creator"){const c=creatorOf(user);l=c?l.filter(b=>b.creatorId===c.id):[]}
 return l.slice().reverse().map(b=>view(b,user))}
async function act(user,id,action,body={}){const b=bk(id);if(!b)throw E(404,"Booking not found.");
 const cp=creatorOf(user),isC=user.role==="customer"&&b.customerId===user.id,isP=user.role==="creator"&&!!cp&&b.creatorId===cp.id,isA=user.role==="admin";
 if(!isC&&!isP&&!isA)throw E(404,"Booking not found.");
 const need=ok=>{if(!ok)throw E(403,"You can’t do that on this booking.")},from=(...s)=>{if(!s.includes(b.status))throw E(409,`This can’t be done while the booking is ${b.status}.`)};
 switch(action){
 case"accept":need(isP);from("Requested");if(cr(b.creatorId).ver!=="verified")throw E(403,"Your account is not verified.");if(clash(b))throw E(409,"This clashes with a confirmed shoot.");setSt(b,"Accepted");break;
 case"decline":need(isP);from("Requested","Accepted");setSt(b,"Declined");break;
 case"cancel":need(isC);from("Requested","Accepted","Confirmed");if(b.status==="Confirmed"){await refundPayment(payOf(b.id));setSt(b,"Refunded","cancelled by customer")}else setSt(b,"Cancelled","by customer");break;
 case"withdraw":need(isP);from("Accepted","Confirmed");setSt(b,"Cancelled","by creator");b.offers=replacements(b);break;
 case"refund":need(isC||isA);from("Cancelled");await refundPayment(payOf(b.id));setSt(b,"Refunded","full refund");break;
 case"offers":need(isA);from("Cancelled");b.offers=replacements(b);break;
 case"swap":{need(isC);from("Cancelled");const o=(b.offers||[]).find(x=>x.creatorId===body.creatorId);if(!o||!replacements(b).some(x=>x.creatorId===o.creatorId))throw E(409,"That replacement is no longer available.");
  const nb=makeBooking(user,{creatorId:o.creatorId,pk:o.pk,date:b.date,slot:b.slot,type:b.type});await refundPayment(payOf(b.id));setSt(b,"Refunded","moved to replacement");return view(nb,user)}
 case"start":need(isP);from("Confirmed");if(!demo&&today()<b.date)throw E(409,"A shoot can start on its shoot date.");setSt(b,"In progress");break;
 case"complete":need(isP);from("In progress");setSt(b,"Completed");b.delivery={due:addDays(today(),b.pkg.days),sent:false};break;
 case"deliver":{need(isP);from("Completed");let u;try{u=new URL(String(body.url))}catch{throw E(400,"Enter a valid https link.","url")}if(u.protocol!=="https:"||String(body.url).length>500)throw E(400,"Enter a valid https link.","url");
  b.delivery={...b.delivery,sent:true,url:u.href,at:now().toISOString()};b.log.push("Delivered");break}
 case"review":{need(isC);from("Completed");if(!b.delivery?.sent)throw E(409,"Review after files are delivered.");if(b.review)throw E(409,"You already reviewed this booking.");const r=+body.rating;if(!Number.isInteger(r)||r<1||r>5)throw E(400,"Rate from 1 to 5.","rating");b.review={rating:r,comment:clean(body.comment,500)};b.log.push("Reviewed");break}
 case"issue":{need(isC);from("Completed");if(b.delivery?.sent){if(now().getTime()-Date.parse(b.delivery.at)>7*864e5)throw E(409,"The 7-day window to report an issue has passed.")}else if(!(b.delivery&&today()>b.delivery.due))throw E(409,"You can report missing files after the delivery date.");const r=clean(body.reason,500);if(r.length<5)throw E(400,"Describe the problem.","reason");b.reason=r;setSt(b,"Disputed","issue reported");break}
 case"resolve":need(isA);from("Disputed");if(body.decision==="refund"){await refundPayment(payOf(b.id));setSt(b,"Refunded","dispute resolved")}else if(body.decision==="reject")setSt(b,"Completed","dispute rejected");else throw E(400,"Choose refund or reject.");break;
 default:throw E(400,"Unknown action.")}
 return view(b,user)}
// ---- payments
async function createOrder(user,bookingId){const b=bk(bookingId);if(!b||b.customerId!==user.id)throw E(404,"Booking not found.");if(b.status!=="Accepted")throw E(409,"Pay after the creator accepts.");
 if(slotTaken(b.creatorId,b.date,b.slot))throw E(409,"That slot was just taken.");
 let p=D.payments.find(x=>x.bookingId===b.id&&x.status==="created");
 if(!p){const o=await gateway.createOrder({amount:b.price*100,receipt:b.id});p={id:store.id("p"),bookingId:b.id,orderId:o.id,amount:b.price*100,paymentId:null,status:"created"};D.payments.push(p)}
 return{orderId:p.orderId,amount:p.amount,currency:"INR",keyId:gateway.keyId,mock:!!gateway.mock}}
async function finalize(p,paymentId){const b=bk(p.bookingId);if(p.status==="paid"||p.status==="refunded"||p.status==="refund_failed")return{booking:b,duplicate:true};
 p.paymentId=paymentId;p.status="paid";
 if(b.status!=="Accepted"||clash(b)){if(b.status==="Accepted"){setSt(b,"Cancelled","slot taken");b.offers=replacements(b)}await refundPayment(p);return{booking:b,refunded:true}}
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
 if(eventId){const t=now().getTime();for(const k of Object.keys(D.events))if(t-D.events[k]>7*864e5)delete D.events[k];D.events[eventId]=t}
 return{ok:true}}
return{register,recordConsent,createAdmin,login,authenticate,logout,listCreators,addPackage,setCreatorStatus,makeBooking:(u,b)=>view(makeBooking(u,b),u),listBookings,act,createOrder,verifyPayment,webhook,
 adminCreators:u=>{if(u.role!=="admin")throw E(403,"Admins only.");return D.creators.map(c=>({id:c.id,name:c.name,area:c.area,ver:c.ver,packages:c.pk.length}))},
 myCreator:u=>{const c=creatorOf(u);return c?{id:c.id,name:c.name,area:c.area,ver:c.ver,types:c.types,pk:c.pk}:null},
 stats:u=>{if(u.role!=="admin")throw E(403,"Admins only.");const n=s=>D.bookings.filter(b=>b.status===s).length;return{bookings:D.bookings.length,completed:n("Completed"),cancelled:n("Cancelled"),disputed:n("Disputed")}},
 _today:today}}

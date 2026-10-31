import test from "node:test";import assert from "node:assert/strict";import fs from "node:fs";import path from "node:path";import {fileURLToPath,pathToFileURL} from "node:url";import {JSDOM} from "jsdom";
import {makeWorld,seedBasics,startServer,PW} from "./helpers.js";
const PUB=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","public"),realFetch=globalThis.fetch,realSI=globalThis.setInterval;let n=0;
globalThis.setInterval=(f,ms)=>{const t=realSI(f,ms);t.unref?.();return t};
async function env(){const w=makeWorld(),o=seedBasics(w),srv=await startServer(w);const logins={};
 async function as(email){const c=srv.client();const r=await c.post("/api/auth/login",{email,password:PW});assert.equal(r.status,200);return c.sid}
 async function open(file,{sid="",search=""}={}){const dom=new JSDOM(fs.readFileSync(path.join(PUB,file),"utf8"),{url:srv.base+"/"+file+search,pretendToBeVisual:true}),win=dom.window;
  win.HTMLDialogElement.prototype.showModal=function(){this.setAttribute("open","")};win.HTMLDialogElement.prototype.close=function(){this.removeAttribute("open");this.dispatchEvent(new win.Event("close"))};
  const redirects=[];Object.assign(globalThis,{document:win.document,FormData:win.FormData,window:win,location:{replace:u=>redirects.push(u),assign:u=>redirects.push(u),search,pathname:"/"+file,href:""}});
  globalThis.fetch=(u,o={})=>String(u).startsWith("/")?realFetch(srv.base+u,{...o,headers:{...(o.headers||{}),...(sid?{Cookie:"sid="+sid}:{})}}):realFetch(u,o);
  let err=null;try{await import(pathToFileURL(path.join(PUB,file.replace(".html",".js"))).href+"?v="+(++n))}catch(e){err=e}
  const q=s=>win.document.querySelector(s),qa=s=>[...win.document.querySelectorAll(s)];
  const until=async(f,ms=2500)=>{const t=Date.now();while(Date.now()-t<ms){try{const v=f();if(v)return v}catch{}await new Promise(r=>setTimeout(r,10))}throw new Error("timeout waiting: "+f)};
  const click=el=>el.dispatchEvent(new win.MouseEvent("click",{bubbles:true})),set=(el,v)=>{el.value=v;el.dispatchEvent(new win.Event("change",{bubbles:true}));el.dispatchEvent(new win.Event("input",{bubbles:true}))};
  return{win,q,qa,until,click,set,redirects,err}}
 return{w,o,srv,as,open,close:()=>srv.close()}}
const tabText=(p,id)=>p.q(`#tab-${id}`).textContent;
const confirmYes=async p=>{const d=await p.until(()=>p.q('dialog.cf[open] [data-v="1"]'));p.click(d)};
const submit=(p,el)=>el.dispatchEvent(new p.win.Event("submit",{bubbles:true,cancelable:true}));
async function paidBooking(e){const c=e.srv.client();await c.post("/api/auth/login",{email:"cathy@t.test",password:PW});const a=e.srv.client();await a.post("/api/auth/login",{email:"aarav@t.test",password:PW});
 const b=(await c.post("/api/bookings",{creatorId:e.o.a.c.id,pk:0,date:"2026-11-02",slot:"10:00",type:"Birthday",area:"Madhapur",address:"Flat 402, Lotus Residency, Madhapur"})).json.booking;await a.post(`/api/bookings/${b.id}/accept`);
 const ord=(await c.post("/api/payments/order",{bookingId:b.id})).json;const ck=(await c.post("/api/payments/mock-checkout",{orderId:ord.orderId})).json;await c.post("/api/payments/verify",{bookingId:b.id,...ck});return{b,c,a}}

test("customer panel: payments and receipt link, account name change, verify banner",async()=>{const e=await env();await paidBooking(e);
 e.w.store.d.users.find(u=>u.email==="cathy@t.test").emailVerified=false;
 const p=await e.open("customer.html",{sid:await e.as("cathy@t.test")});await p.until(()=>p.q("#pl table"));
 assert.ok(p.q("#tab-payments")&&p.q("#tab-account"));assert.ok(p.q("#pl").textContent.includes("₹2,500"));assert.match(p.q("#pl a").getAttribute("href"),/^receipt\.html\?b=/);
 assert.ok(p.q(".banner").textContent.includes("verify your email"));
 const f=p.q("#ac-name");f.elements.name.value="Cathy Z";submit(p,f);await p.until(()=>p.q(".toast")&&p.q(".toast").textContent.includes("Saved"));assert.equal(e.w.store.d.users.find(u=>u.email==="cathy@t.test").name,"Cathy Z");
 const pw=p.q("#ac-pw");pw.elements.current.value=PW;pw.elements.password.value="weak";submit(p,pw);await p.until(()=>p.q('[data-e="pw"]').textContent);await e.close()});
test("customer panel: review form sends the comment",async()=>{const e=await env();const{c}=await paidBooking(e);Object.assign(e.w.store.d.bookings[0],{status:"Completed",delivery:{sent:true,url:"https://photos.example/g",at:new Date().toISOString(),due:"2026-11-10"}});
 const p=await e.open("customer.html",{sid:c.sid});await p.until(()=>p.q("[data-comment]"));p.q("[data-comment]").value="Loved it";p.click(p.q('[data-act="review"]'));
 await p.until(()=>e.w.store.d.bookings[0].review);assert.equal(e.w.store.d.bookings[0].review.comment,"Loved it");await e.close()});
test("creator panel: edit and delete a package, block a date, save payout details",async()=>{const e=await env(),p=await e.open("creator.html",{sid:await e.as("aarav@t.test")});await p.until(()=>p.qa("#pk .card").length===2);
 p.click(p.q("[data-pk-edit]"));const d=await p.until(()=>p.q("dialog.cf[open] form"));d.elements.p.value="3100";submit(p,d);await p.until(()=>p.q("#pk").textContent.includes("₹3,100"));
 p.click(p.qa("[data-pk-del]")[1]);await confirmYes(p);await p.until(()=>p.qa("#pk .card").length===1);
 const av=p.q("#avf");av.elements.date.value="2026-12-24";submit(p,av);await p.until(()=>p.q("#avl").textContent.includes("2026-12-24"));p.click(p.q("[data-av-rm]"));await p.until(()=>p.q("#avl").textContent.includes("No blocked dates"));
 const py=p.q("#pyf");py.elements.holder.value="Aarav Reddy";py.elements.upi.value="aarav@okhdfc";submit(p,py);await p.until(()=>p.q("#pyf").textContent.includes("aa***@okhdfc"));
 const pe=p.q("#pe");pe.elements.bio.value="Weddings and portraits";submit(p,pe);await p.until(()=>e.w.store.d.creators[0].bio==="Weddings and portraits");
 await p.until(()=>p.qa("#prof .check li.ok").length>=2);assert.ok(p.q("#prof .check").textContent.includes("Payout details added"));await e.close()});
test("admin panel: failed refund shows with retry; payments, payouts, users and audit tabs render",async()=>{const e=await env();const{b,c}=await paidBooking(e);e.w.gateway.failRefunds=1;await c.post(`/api/bookings/${b.id}/cancel`);
 const p=await e.open("admin.html",{sid:await e.as("admin@t.test")});await p.until(()=>p.q("#queue .card, #queue article"));assert.ok(p.q("#stats").textContent.includes("Failed refunds"));assert.ok(p.q("#pay").textContent.includes("Refund failed"));
 p.click(p.q("[data-retry]"));await p.until(()=>e.w.store.d.payments[0].status==="refunded");await p.until(()=>!p.q("[data-retry]"));assert.equal(e.w.store.d.bookings[0].status,"Refunded");
 await p.until(()=>p.q("#au").textContent.includes("refund.retry"));assert.ok(p.q("#us").textContent.includes("aarav@t.test"));assert.ok(p.q("#po").textContent.includes("No payouts yet"));
 p.click(p.q('[data-user]'));await confirmYes(p);await p.until(()=>e.w.store.d.users.some(u=>u.disabled));await e.close()});
test("admin panel: approve is disabled until the creator has an ID and a verified email",async()=>{const e=await env(),c=e.srv.client();await c.post("/api/auth/register",{agree:true,name:"Nia Rao",email:"nia@t.test",password:PW,role:"creator",phone:"9876543210",area:"Madhapur",types:["Reel"]});
 const p=await e.open("admin.html",{sid:await e.as("admin@t.test")});await p.until(()=>p.q("#cr table"));let row=p.qa("#cr tr").find(r=>r.textContent.includes("Nia"));assert.ok(row.textContent.includes("Waiting for ID"));assert.ok(!row.querySelector("[data-do=approve]"));
 const nu=e.w.store.d.users.find(u=>u.email==="nia@t.test"),cr=e.w.store.d.creators.find(x=>x.userId===nu.id);cr.idDoc={file:"x",ext:"jpg",at:"2026-01-01"};
 const p2=await e.open("admin.html",{sid:await e.as("admin@t.test")});await p2.until(()=>p2.q("#cr table"));row=p2.qa("#cr tr").find(r=>r.textContent.includes("Nia"));assert.ok(row.textContent.includes("Email not verified"));assert.ok(row.textContent.includes("View ID"));await e.close()});
test("static pages: reset, verify, profile, receipt",async()=>{const e=await env();
 let p=await e.open("reset.html");await p.until(()=>p.q("form"));assert.ok(p.q("h1").textContent.includes("Forgot"));
 p.q("form").elements.email.value="cathy@t.test";submit(p,p.q("form"));await p.until(()=>p.q("h1").textContent.includes("Check your inbox"));
 p=await e.open("profile.html",{search:"?c="+e.o.a.c.id});await p.until(()=>p.q("h1"));assert.ok(p.q("h1").textContent.includes("Aarav")||p.q("h1").textContent.length>2);assert.ok(p.qa("a.btn").some(a=>/customer\.html\?book=/.test(a.getAttribute("href"))));
 p=await e.open("profile.html",{search:"?c=zzz"});await p.until(()=>p.q("h1").textContent.includes("not found"));
 const{b,c}=await paidBooking(e);p=await e.open("receipt.html",{sid:c.sid,search:"?b="+b.id});await p.until(()=>p.q(".rcpt table"));assert.ok(p.q(".rcpt").textContent.includes("₹2,500"));assert.ok(p.q(".rcpt").textContent.includes("not a GST"));
 p=await e.open("receipt.html",{search:"?b="+b.id});await p.until(()=>p.q("h1").textContent.includes("not available"));await e.close()});

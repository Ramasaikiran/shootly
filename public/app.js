import {esc} from "./components.js";import {confirmDialog} from "./panel.js";
export async function api(method,url,body){const r=await fetch(url,{method,credentials:"same-origin",headers:body?{"Content-Type":"application/json"}:{},body:body?JSON.stringify(body):undefined});
 const j=await r.json().catch(()=>({}));if(!r.ok){const e=new Error(j.error||"Something went wrong. Try again.");e.status=r.status;e.field=j.field;throw e}return j}
export const get=u=>api("GET",u),post=(u,b={})=>api("POST",u,b);
export const home=r=>({customer:"customer.html",creator:"creator.html",admin:"admin.html"})[r]||"index.html";
export const safeNext=(n,role)=>{const m=/^\/?([a-z]+\.html)(\?[\w=&~.:%-]{0,120})?$/.exec(String(n||""));return m&&m[1]===home(role)?m[1]+(m[2]||""):home(role)};
export const todayIST=()=>new Date(Date.now()+19800000).toISOString().slice(0,10);
export function toast(m){const t=document.createElement("div");t.className="toast";t.setAttribute("role","status");t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),3000)}
export async function guard(role){try{const me=await get("/api/me");if(me.user.role!==role){location.replace(home(me.user.role));return null}
 document.querySelector("#hd").innerHTML=`<div class="wrap bar"><a class="logo" href="index.html">Shootly</a><div class="links"><span class="tag">${esc(role)} panel</span><span class="mute">${esc(me.user.name)}</span><button class="btn alt sm" id="out">Sign out</button></div></div>`;
 document.querySelector("#out").onclick=async()=>{await post("/api/auth/logout");location.href="auth.html"};return me}
 catch(e){if(e.status===401){location.replace("auth.html?next="+encodeURIComponent(location.pathname.replace(/^\//,"")));return null}throw e}}
const loadCheckout=()=>window.Razorpay?Promise.resolve():new Promise((ok,no)=>{const s=document.createElement("script");s.src="https://checkout.razorpay.com/v1/checkout.js";s.onload=ok;s.onerror=()=>no(new Error("Could not load the payment window."));document.head.append(s)});
export async function payBooking(b){const o=await post("/api/payments/order",{bookingId:b.id});
 if(o.mock){const c=await post("/api/payments/mock-checkout",{orderId:o.orderId});return post("/api/payments/verify",{bookingId:b.id,...c})}
 await loadCheckout();return new Promise((res,rej)=>new window.Razorpay({key:o.keyId,amount:o.amount,currency:o.currency,order_id:o.orderId,name:"Shootly",
  handler:r=>post("/api/payments/verify",{bookingId:b.id,orderId:r.razorpay_order_id,paymentId:r.razorpay_payment_id,signature:r.razorpay_signature}).then(res,rej),modal:{ondismiss:()=>rej(new Error("Payment cancelled."))}}).open())}
export async function doAction(act,id,card,extra={}){
 const v=s=>card?.querySelector(s)?.value;
 if(act==="pay")return payBooking({id});
 if(act==="review")return post(`/api/bookings/${id}/review`,{rating:+v("[data-rating]")});
 if(act==="issue")return post(`/api/bookings/${id}/issue`,{reason:v("[data-reason]")});
 if(act==="deliver")return post(`/api/bookings/${id}/deliver`,{url:v("[data-url]")});
 if(act==="resolve-refund")return post(`/api/bookings/${id}/resolve`,{decision:"refund"});
 if(act==="resolve-reject")return post(`/api/bookings/${id}/resolve`,{decision:"reject"});
 return post(`/api/bookings/${id}/${act}`,extra)}
export function wireActions(root,reload){root.addEventListener("click",async e=>{const t=e.target.closest("[data-act]");if(!t||t.dataset.act==="book")return;if(t.dataset.confirm&&!(await confirmDialog(t.dataset.confirm)))return;t.disabled=true;
 try{const r=await doAction(t.dataset.act,t.dataset.b,t.closest("article"),t.dataset.c?{creatorId:t.dataset.c}:{});toast(t.dataset.act==="pay"&&r.refunded?"Slot was taken. Your payment is being refunded.":"Done.")}catch(er){toast(er.message)}await reload()})}

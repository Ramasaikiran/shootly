import {post,toast,todayIST} from "./app.js";import {esc,inr} from "./components.js";import {SLOTS} from "./policy.js";
const opt=(l,v)=>l.map(a=>`<option ${a===v?"selected":""}>${esc(a)}</option>`).join("");
export function openBooking(dlg,c,pi,{date="",type="",onDone}={}){const p=c.pk[pi];
 dlg.innerHTML=`<h3>${esc(p.n)} with ${esc(c.name)}</h3><p class="mute">${inr(p.p)} all-in · ${esc(p.h)} hr · ${esc(p.d)} · files in ${esc(p.days)} days.</p><p><span class="tag ok">Free to request</span> You pay only after the creator accepts.</p>
 <form id="bf" style="display:grid;gap:12px"><label>Shoot date<input type="date" name="date" required min="${todayIST()}" value="${esc(date)}"></label><label>Time slot<select name="slot">${opt(SLOTS)}</select></label><label>Shoot type<select name="type">${opt(c.types,type)}</select></label>
 <p class="fe" id="derr" role="alert"></p><div class="row"><button class="btn alt" type="button" id="dx">Close</button><button class="btn" type="submit">Send request</button></div></form>`;
 dlg.showModal();dlg.querySelector("#dx").onclick=()=>dlg.close();
 dlg.querySelector("#bf").onsubmit=async ev=>{ev.preventDefault();const d=Object.fromEntries(new FormData(ev.target));try{await post("/api/bookings",{creatorId:c.id,pk:pi,...d});dlg.close();toast("Request sent. Not confirmed until the creator accepts.");onDone&&await onDone()}catch(er){dlg.querySelector("#derr").textContent=er.message}}}

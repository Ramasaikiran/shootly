import {get,toast,todayIST} from "./app.js";import {creatorCard,esc} from "./components.js";import {skeleton,empty} from "./panel.js";import {AREAS,TYPES} from "./policy.js";import {openBooking} from "./booking.js";
const app=document.querySelector("#app"),dlg=document.querySelector("#dlg"),QP=new URLSearchParams(location.search);
const F={type:TYPES.includes(QP.get("type"))?QP.get("type"):"",area:AREAS.includes(QP.get("area"))?QP.get("area"):"",date:/^\d{4}-\d{2}-\d{2}$/.test(QP.get("date")||"")?QP.get("date"):"",budget:""};
const opt=(l,v)=>l.map(a=>`<option ${a===v?"selected":""}>${esc(a)}</option>`).join("");
app.innerHTML=`<h1 class="h1">Find a photographer in Hyderabad</h1><p class="mute">Compare verified creators. Free to request. You pay only after the creator accepts.</p>
<form class="fbar" id="sf"><div class="pills" role="group" aria-label="Shoot type"><button type="button" class="pill" data-type="" aria-pressed="${!F.type}">All shoots</button>${TYPES.map(t=>`<button type="button" class="pill" data-type="${esc(t)}" aria-pressed="${F.type===t}">${esc(t)}</button>`).join("")}</div>
<div class="row2"><label>Area<select name="area"><option value="">Any area</option>${opt(AREAS,F.area)}</select></label><label>Shoot date<input type="date" name="date" min="${todayIST()}" value="${esc(F.date)}"></label><label>Max budget (₹)<input type="number" name="budget" min="0" step="500" placeholder="No limit"></label></div></form>
<p class="mute" id="count" aria-live="polite"></p><div class="grid" id="cl">${skeleton(3)}</div>`;
const sf=document.querySelector("#sf");
async function load(){const q=new URLSearchParams(Object.entries(F).filter(([,v])=>v));window.history.replaceState(null,"",q.toString()?"?"+q:location.pathname);
 const{creators}=await get("/api/creators?"+q);document.querySelector("#count").textContent=`${creators.length} verified creator${creators.length===1?"":"s"}${F.date?" free on "+F.date:""}`;
 document.querySelector("#cl").innerHTML=creators.length?creators.map((c,i)=>creatorCard(c,i,!!F.date)).join(""):`<div style="grid-column:1/-1">${empty({icon:"search",title:"No creators match",text:"Try a different area, date or budget, or pick All shoots.",cta:"Clear filters",act:"clear"})}</div>`}
sf.addEventListener("submit",e=>e.preventDefault());
sf.addEventListener("change",()=>{F.area=sf.elements.area.value;F.date=sf.elements.date.value;F.budget=sf.elements.budget.value;load()});
sf.addEventListener("click",e=>{const p=e.target.closest(".pill");if(!p)return;F.type=p.dataset.type;sf.querySelectorAll(".pill").forEach(x=>x.setAttribute("aria-pressed",String(x===p)));load()});
app.addEventListener("click",e=>{if(e.target.closest('[data-goto="clear"]')){Object.assign(F,{type:"",area:"",date:"",budget:""});sf.reset();sf.querySelectorAll(".pill").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.type==="")));load()}});
document.querySelector("#cl").addEventListener("click",async e=>{const t=e.target.closest('[data-act="book"]');if(!t)return;let me=null;try{me=(await get("/api/me")).user}catch{}
 const next=`customer.html?book=${t.dataset.c}~${t.dataset.p}${F.date?"&date="+F.date:""}${F.type?"&type="+encodeURIComponent(F.type):""}`;
 if(!me)return location.assign("auth.html?mode=register&next="+encodeURIComponent(next));
 if(me.role!=="customer")return toast("Sign in with a customer account to book.");
 const{creators}=await get("/api/creators"),c=creators.find(x=>x.id===t.dataset.c);if(c)openBooking(dlg,c,+t.dataset.p,{date:F.date,type:F.type,onDone:()=>location.assign("customer.html")})});
await load();

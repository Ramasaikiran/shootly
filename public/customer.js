import {get,post,guard,toast,wireActions,todayIST} from "./app.js";import {creatorCard,bookingCard,esc,inr} from "./components.js";import {tabsUI,stat,skeleton,empty,section,groupCustomer} from "./panel.js";import {AREAS,TYPES} from "./policy.js";import {openBooking} from "./booking.js";
const me=await guard("customer");if(!me)throw new Error("redirecting");
const app=document.querySelector("#app"),dlg=document.querySelector("#dlg"),opt=(l,v)=>l.map(a=>`<option ${a===v?"selected":""}>${esc(a)}</option>`).join("");
const F={type:"",area:"",date:"",budget:""},QP=new URLSearchParams(location.search);{const t=QP.get("type"),d=QP.get("date");if(TYPES.includes(t))F.type=t;if(/^\d{4}-\d{2}-\d{2}$/.test(d||""))F.date=d}
app.innerHTML=`<div class="phead"><div><h1 class="h1">Hi ${esc(me.user.name.split(" ")[0])}</h1><p class="mute">Find a creator, then track every booking here.</p></div></div><div id="tabs"></div>
<section role="tabpanel" id="pn-find" aria-labelledby="tab-find"><form class="fbar" id="sf"><div class="pills" role="group" aria-label="Shoot type"><button type="button" class="pill" data-type="" aria-pressed="${!F.type}">All shoots</button>${TYPES.map(t=>`<button type="button" class="pill" data-type="${esc(t)}" aria-pressed="${F.type===t}">${esc(t)}</button>`).join("")}</div>
<div class="row2"><label>Area<select name="area"><option value="">Any area</option>${opt(AREAS)}</select></label><label>Shoot date<input type="date" name="date" min="${todayIST()}"></label><label>Max budget (₹)<input type="number" name="budget" min="0" step="500" placeholder="No limit"></label></div></form>
<p class="mute" id="count" aria-live="polite"></p><div class="grid" id="cl">${skeleton(3)}</div></section>
<section role="tabpanel" id="pn-bookings" aria-labelledby="tab-bookings" hidden><div id="bl">${skeleton(2)}</div></section>`;
const tabs=tabsUI(document.querySelector("#tabs"),[{id:"find",label:"Find a creator"},{id:"bookings",label:"My bookings"}]);
const sf=document.querySelector("#sf");sf.elements.date.value=F.date;
async function loadCreators(){const q=new URLSearchParams(Object.entries(F).filter(([,v])=>v));const{creators}=await get("/api/creators?"+q);
 document.querySelector("#count").textContent=`${creators.length} verified creator${creators.length===1?"":"s"}${F.date?" free on "+F.date:""}`;
 document.querySelector("#cl").innerHTML=creators.length?creators.map((c,i)=>creatorCard(c,i,!!F.date)).join(""):`<div style="grid-column:1/-1">${empty({icon:"search",title:"No creators match",text:"Try a different area, date or budget, or pick All shoots.",cta:"Clear filters",act:"clear"})}</div>`}
async function loadBookings(){const{bookings}=await get("/api/bookings"),g=groupCustomer(bookings);
 document.querySelector("#bl").innerHTML=bookings.length?section("Needs your attention",g.attention,b=>bookingCard(b,"customer"),"wait")+section("Upcoming",g.upcoming,b=>bookingCard(b,"customer"))+section("Past",g.past,b=>bookingCard(b,"customer")):empty({icon:"cal",title:"No bookings yet",text:"Pick a package and send a request. You pay only after the creator accepts.",cta:"Find a creator",act:"find"});
 tabs.counts({bookings:g.attention.length+g.upcoming.length},["bookings"])}
const reload=()=>Promise.all([loadCreators(),loadBookings()]);
sf.addEventListener("submit",e=>e.preventDefault());
sf.addEventListener("change",()=>{F.area=sf.elements.area.value;F.date=sf.elements.date.value;F.budget=sf.elements.budget.value;loadCreators()});
sf.addEventListener("click",e=>{const p=e.target.closest(".pill");if(!p)return;F.type=p.dataset.type;sf.querySelectorAll(".pill").forEach(x=>x.setAttribute("aria-pressed",String(x===p)));loadCreators()});
app.addEventListener("click",e=>{const g=e.target.closest("[data-goto]");if(!g)return;if(g.dataset.goto==="clear"){Object.assign(F,{type:"",area:"",date:"",budget:""});sf.reset();sf.querySelectorAll(".pill").forEach(x=>x.setAttribute("aria-pressed",String(x.dataset.type==="")));loadCreators()}else tabs.select(g.dataset.goto)});
wireActions(app,reload);
document.querySelector("#cl").addEventListener("click",async e=>{const t=e.target.closest('[data-act="book"]');if(!t)return;const{creators}=await get("/api/creators"),c=creators.find(x=>x.id===t.dataset.c);if(c)openBooking(dlg,c,+t.dataset.p,{date:F.date,type:F.type,onDone:async()=>{await loadBookings();tabs.select("bookings")}})});
await reload();{const bk=(QP.get("book")||"").split("~");if(bk.length===2){const{creators}=await get("/api/creators"),c=creators.find(x=>x.id===bk[0]);if(c&&c.pk[+bk[1]])openBooking(dlg,c,+bk[1],{date:F.date,type:F.type,onDone:async()=>{await loadBookings();tabs.select("bookings")}})}}setInterval(()=>{if(!dlg.open&&!app.contains(document.activeElement))loadBookings().catch(()=>{})},20000);

const d=document.querySelector("#fdate");if(d)d.min=new Date(Date.now()+19800000).toISOString().slice(0,10);
const st=document.querySelector(".finder [name=state]"),ar=document.querySelector(".finder [name=area]");if(st&&ar){const all=[...ar.options].slice(1);st.addEventListener("change",()=>{ar.innerHTML="";ar.append(new Option("Any area",""));all.forEach(o=>{if(!st.value||o.dataset.s===st.value)ar.append(o)});ar.value=""})}
const sk=document.querySelector(".sticky"),tg=document.querySelector(".finder")||document.querySelector(".hcopy .btn");if(sk){if(tg&&"IntersectionObserver"in window)new IntersectionObserver(e=>sk.classList.toggle("on",!e[0].isIntersecting)).observe(tg);else sk.classList.add("on")}
const fm=document.querySelector(".finder");if(fm){const ls=[...document.querySelectorAll('a[href="browse.html"]')],sy=()=>{const q=new URLSearchParams();new FormData(fm).forEach((v,k)=>{if(v)q.set(k,v)});const h="browse.html"+(q.toString()?"?"+q:"");ls.forEach(a=>a.href=h)};fm.addEventListener("change",sy);addEventListener("pageshow",sy);sy()}

// Live proof from real creators. Shows nothing when there is not enough real data.
(async()=>{const box=document.querySelector("#proof");if(!box)return;let list;try{const r=await fetch("/api/creators");if(!r.ok)return;list=(await r.json()).creators||[]}catch{return}
 const inr=n=>"₹"+Number(n).toLocaleString("en-IN"),prices=list.flatMap(c=>c.pk.map(p=>p.p)),low=prices.length?Math.min(...prices):0,fl=document.querySelector("#fromline");
 if(fl&&low){fl.textContent=" Shoots from "+inr(low)+".";fl.hidden=false}
 const shown=list.filter(c=>c.cover).slice(0,6);if(shown.length<3)return;
 const grid=box.querySelector("#proofgrid");
 for(const c of shown){const a=document.createElement("a");a.className="card proof";a.href="profile.html?c="+encodeURIComponent(c.id);a.dataset.cta="proof-creator";
  const im=document.createElement("img");im.src=c.cover;im.alt="Work by "+c.name;im.loading="lazy";im.width=400;im.height=300;
  const t=document.createElement("b");t.textContent=c.name;const m=document.createElement("span");m.className="mute";
  const from=Math.min(...c.pk.map(p=>p.p));m.textContent=[c.area,c.rating?.count?"★ "+c.rating.avg:"","from "+inr(from)].filter(Boolean).join(" · ");
  a.append(im,t,m);grid.append(a)}
 box.querySelector("#proofsub").textContent=list.length>=5?list.length+" ID-verified creators are listed on Shootly.":"";
 box.hidden=false})();

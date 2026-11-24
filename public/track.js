// Counts page views and button clicks on this site. No cookies, IP addresses or personal data. Skipped when Do Not Track is on.
const g=globalThis,clean=s=>String(s).toLowerCase().replace(/[^a-z0-9-]/g,"-").slice(0,40);
function send(e){try{if(g.navigator?.doNotTrack==="1")return;const body=JSON.stringify({e});
 if(!(g.navigator?.sendBeacon&&g.navigator.sendBeacon("/api/track",new Blob([body],{type:"application/json"}))))g.fetch?.("/api/track",{method:"POST",headers:{"Content-Type":"application/json"},body,keepalive:true}).catch(()=>{})}catch{}}
if(g.location&&g.addEventListener){send("view:"+clean((g.location.pathname.split("/").pop()||"index").replace(/\.html$/,"")||"index"));
 g.addEventListener("click",ev=>{const a=ev.target?.closest?.("[data-cta]");if(a)send("cta:"+clean(a.dataset.cta))},true)}

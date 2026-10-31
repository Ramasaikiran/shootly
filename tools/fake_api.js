const today="2026-10-26",ROLE=(h=>["customer","creator","admin"].includes(h)?h:"customer")(window.location.hash.slice(1));
const USERS={customer:{id:"u1",name:"Priya Sharma",email:"priya@demo.test",role:"customer",phone:"9876543210"},creator:{id:"u2",name:"Aarav Reddy",email:"aarav@demo.test",role:"creator",phone:"9876543210"},admin:{id:"u0",name:"Admin",email:"admin@demo.test",role:"admin"}};
const C=[{id:"c1",userId:"u2",name:"Aarav Reddy",area:"Madhapur",types:["Birthday","Family","Graduation"],exp:"6 yrs, Sony A7 IV",ver:"verified",pk:[{n:"Mini shoot",h:1,d:"25 edited photos, online gallery",days:3,p:2500},{n:"Event coverage",h:3,d:"80 edited photos, 1 highlight reel",days:5,p:7500}]},
{id:"c2",name:"Meera Iyer",area:"Banjara Hills",types:["Reel","Restaurant","Product"],exp:"4 yrs, DJI + FX3",ver:"verified",pk:[{n:"Reel pack",h:2,d:"3 edited reels, 30 to 45 sec",days:2,p:6000}]},
{id:"c3",name:"Rohan Das",area:"Gachibowli",types:["Product","Reel","Graduation","Birthday"],exp:"5 yrs, studio lights",ver:"verified",pk:[{n:"Product 20",h:2,d:"20 retouched photos",days:3,p:4800},{n:"Birthday lite",h:1,d:"20 edited photos",days:3,p:2000}]},
{id:"c4",name:"Kabir Nair",area:"Madhapur",types:["Reel","Birthday"],exp:"2 yrs, Sony ZV-E1",ver:"pending",pk:[{n:"Quick reel",h:1,d:"1 edited reel",days:2,p:2200}]}];
const mkB=(id,cid,who,whoId,pk,date,slot,type,st,x={})=>({id,cid,who,whoId,pkg:{...C.find(c=>c.id===cid).pk[pk]},price:C.find(c=>c.id===cid).pk[pk].p,date,slot,type,status:st,log:["Requested",...(st==="Requested"?[]:[st])],delivery:null,review:null,reason:null,offers:null,pay:null,...x});
let B=[mkB("B1","c1","Priya Sharma","u1",0,"2026-11-02","10:00","Birthday","Accepted"),mkB("B2","c2","Priya Sharma","u1",0,"2026-11-05","16:00","Reel","Requested"),
mkB("B3","c1","Priya Sharma","u1",0,"2026-10-20","10:00","Family","Completed",{delivery:{due:"2026-10-23",sent:true,url:"https://example.com/gallery",at:"2026-10-23T08:00:00Z"},pay:"paid"}),
mkB("B4","c1","Rahul Mehta","u9",1,"2026-11-08","10:00","Graduation","Requested"),mkB("B5","c1","Rahul Mehta","u9",0,"2026-10-24","16:00","Birthday","Completed",{delivery:{due:"2026-10-27",sent:false},pay:"paid"}),
mkB("B6","c3","Sana Khan","u8",0,"2026-10-18","10:00","Product","Disputed",{delivery:{due:"2026-10-21",sent:true,url:"https://example.com/x",at:"2026-10-21T08:00:00Z"},reason:"Only 8 of the 20 photos were delivered.",pay:"paid"}),
mkB("B7","c1","Sana Khan","u8",0,"2026-11-12","16:00","Birthday","Cancelled",{pay:"paid",offers:[{creatorId:"c3",pk:1}]})];
B[2].log=["Requested","Accepted","Confirmed","In progress","Completed","Delivered"];let seq=100;
const E=(s,m,f)=>({ok:false,status:s,json:async()=>({error:m,field:f})}),O=o=>({ok:true,status:200,json:async()=>o});
const me=USERS[ROLE],cr=id=>C.find(c=>c.id===id),myC=()=>C.find(c=>c.userId===me.id);
const held=(cid,d,s)=>B.some(b=>b.cid===cid&&b.date===d&&b.slot===s&&["Confirmed","In progress"].includes(b.status));
const repl=b=>C.filter(c=>c.ver==="verified"&&c.id!==b.cid&&c.types.includes(b.type)&&!held(c.id,b.date,b.slot)).map(c=>({c,i:c.pk.findIndex(p=>p.p<=b.price)})).filter(x=>x.i>=0).map(x=>({creatorId:x.c.id,pk:x.i}));
const view=b=>{const v={id:b.id,status:b.status,date:b.date,slot:b.slot,type:b.type,pkg:b.pkg,price:b.price,creatorName:cr(b.cid).name,log:b.log,delivery:b.delivery,review:b.review,reason:b.reason,payment:b.pay,offers:b.offers&&b.offers.map(o=>({creatorId:o.creatorId,pk:o.pk,name:cr(o.creatorId).name,pkgName:cr(o.creatorId).pk[o.pk].n,price:cr(o.creatorId).pk[o.pk].p}))};if(ROLE!=="customer"){v.customerName=b.who;v.payout=Math.round(b.price*.88)}return v};
const st=(b,s,n)=>{b.status=s;b.log.push(s+(n?` (${n})`:""))};
const addDays=(d,n)=>new Date(Date.parse(d+"T00:00:00Z")+n*864e5).toISOString().slice(0,10);
async function fetch(url,o={}){await new Promise(r=>setTimeout(r,120));const u=new URL(url,"http://x"),p=u.pathname,m=(o.method||"GET").toUpperCase(),body=o.body?JSON.parse(o.body):{};let x;
 if(p==="/api/me")return O({user:me,creator:ROLE==="creator"?{id:"c1",name:myC().name,area:myC().area,ver:myC().ver,types:myC().types,pk:myC().pk}:null,config:{mock:true}});
 if(p==="/api/creators"){const q=u.searchParams;let l=C.filter(c=>c.ver==="verified"&&c.pk.length&&(!q.get("area")||c.area===q.get("area"))&&(!q.get("type")||c.types.includes(q.get("type")))&&(!q.get("budget")||c.pk.some(k=>k.p<=+q.get("budget"))));
  return O({creators:l.map(c=>({id:c.id,name:c.name,area:c.area,types:c.types,exp:c.exp,pk:c.pk,free:q.get("date")?["10:00","16:00"].filter(s=>!held(c.id,q.get("date"),s)):["10:00","16:00"]})).filter(c=>c.free.length)})}
 if(p==="/api/bookings"&&m==="GET")return O({bookings:B.filter(b=>ROLE==="admin"||(ROLE==="customer"?b.whoId==="u1":b.cid==="c1")).slice().reverse().map(view)});
 if(p==="/api/bookings"&&m==="POST"){const c=cr(body.creatorId),k=c.pk[body.pk];if(!body.date||body.date<today)return E(400,"Pick a date from today onwards.","date");if(held(c.id,body.date,body.slot))return E(409,"That slot is taken. Pick another time.","slot");
  const b=mkB("B"+ ++seq,c.id,"Priya Sharma","u1",body.pk,body.date,body.slot,body.type,"Requested");B.push(b);return O({booking:view(b)})}
 if(x=p.match(/^\/api\/bookings\/(\w+)\/(\w+)$/)){const b=B.find(z=>z.id===x[1]),a=x[2];if(!b)return E(404,"Booking not found.");
  if(a==="accept")st(b,"Accepted");else if(a==="decline")st(b,"Declined");else if(a==="cancel")st(b,b.status==="Confirmed"?"Refunded":"Cancelled",b.status==="Confirmed"?"cancelled by customer":"by customer");
  else if(a==="withdraw"){st(b,"Cancelled","by creator");b.offers=repl(b)}else if(a==="refund")st(b,"Refunded","full refund");else if(a==="offers")b.offers=repl(b);
  else if(a==="swap"){const o=(b.offers||[]).find(z=>z.creatorId===body.creatorId);if(!o)return E(409,"That replacement is no longer available.");const n=mkB("B"+ ++seq,o.creatorId,b.who,b.whoId,o.pk,b.date,b.slot,b.type,"Requested");B.push(n);st(b,"Refunded","moved to replacement");return O({booking:view(n)})}
  else if(a==="start")st(b,"In progress");else if(a==="complete"){st(b,"Completed");b.delivery={due:addDays(today,b.pkg.days),sent:false}}
  else if(a==="deliver"){if(!/^https:\/\//.test(body.url||""))return E(400,"Enter a valid https link.","url");b.delivery={...b.delivery,sent:true,url:body.url,at:new Date().toISOString()};b.log.push("Delivered")}
  else if(a==="review"){b.review={rating:+body.rating};b.log.push("Reviewed")}else if(a==="issue"){if(String(body.reason||"").length<5)return E(400,"Describe the problem.","reason");b.reason=body.reason;st(b,"Disputed","issue reported")}
  else if(a==="resolve")st(b,body.decision==="refund"?"Refunded":"Completed",body.decision==="refund"?"dispute resolved":"dispute rejected");return O({booking:view(b)})}
 if(p==="/api/payments/order"){const b=B.find(z=>z.id===body.bookingId);return O({orderId:"order_"+b.id,amount:b.price*100,currency:"INR",keyId:"mock",mock:true})}
 if(p==="/api/payments/mock-checkout")return O({orderId:body.orderId,paymentId:"pay_demo",signature:"demo"});
 if(p==="/api/payments/verify"){const b=B.find(z=>z.id===body.bookingId);b.pay="paid";st(b,"Confirmed","payment verified");return O({booking:view(b),refunded:false})}
 if(p==="/api/creator/packages"){const c=myC(),n=String(body.n||"").trim(),pr=+body.p;if(n.length<2)return E(400,"Name the package.","n");if(!(pr>=500&&pr<=200000))return E(400,"Price must be ₹500 to ₹2,00,000.","p");if(!(+body.h>=1&&+body.h<=12))return E(400,"Hours must be 1 to 12.","h");if(String(body.d||"").length<5)return E(400,"Describe what is delivered.","d");if(!(+body.days>=1))return E(400,"Delivery days must be 1 to 60.","days");c.pk.push({n,h:+body.h,d:body.d,days:+body.days,p:pr});return O({})}
 if(p==="/api/admin/overview"){const n=s=>B.filter(b=>b.status===s).length;return O({stats:{bookings:B.length,completed:n("Completed"),cancelled:n("Cancelled"),disputed:n("Disputed")},creators:C.map(c=>({id:c.id,name:c.name,area:c.area,ver:c.ver,packages:c.pk.length}))})}
 if(x=p.match(/^\/api\/admin\/creators\/(\w+)\/(approve|suspend)$/)){cr(x[1]).ver=x[2]==="approve"?"verified":"suspended";return O({ok:true})}
 if(p==="/api/auth/logout")return O({ok:true});return E(404,"Not found.")}

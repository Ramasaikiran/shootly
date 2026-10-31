import http from "node:http";import path from "node:path";import {fileURLToPath} from "node:url";
import {createStore} from "../server/store.js";import {createService} from "../server/service.js";import {createApp} from "../server/app.js";import {MockGateway} from "../server/payments.js";
export const PW="Strong-pass-2026";
export function makeWorld({date="2026-10-25T06:00:00Z",demo=false,config={}}={}){let t=new Date(date).getTime();const clock={now:()=>new Date(t),ms:()=>t,advance:ms=>{t+=ms}};
 const store=createStore(null),gateway=new MockGateway(),service=createService({store,gateway,now:clock.now,demo});return{store,gateway,service,clock,config}}
export function seedBasics(w){const s=w.service;const admin=s.createAdmin("admin@t.test",PW);
 const cust=s.register({name:"Cathy",email:"cathy@t.test",password:PW,role:"customer",phone:"9876543210"});const cust2=s.register({name:"Carl",email:"carl@t.test",password:PW,role:"customer",phone:"9876543210"});for(const u of w.store.d.users)u.emailVerified=true;cust.emailVerified=cust2.emailVerified=true;
 const mk=(n,e,area="Madhapur")=>{const u=s.register({name:n,email:e,password:PW,role:"creator",phone:"9876543210",area,types:["Birthday","Family"]});const c=w.store.d.creators.find(x=>x.userId===u.id);c.ver="verified";c.idDoc={file:"x.jpg",ext:"jpg",at:"2026-01-01"};w.store.d.users.find(x=>x.id===u.id).emailVerified=true;u.emailVerified=true;c.pk=[{n:"Mini",h:1,d:"25 edited photos",days:3,p:2500},{n:"Big",h:3,d:"80 photos and reel",days:5,p:7500}];return{u,c}};
 return{admin:{id:admin.id,role:"admin",name:"Admin"},cust,cust2,a:mk("Aarav","aarav@t.test"),b:mk("Bina","bina@t.test","Gachibowli")}}
export async function startServer(w,config={}){const root=path.join(path.dirname(fileURLToPath(import.meta.url)),"..","public");
 const handler=createApp({service:w.service,store:w.store,gateway:w.gateway,publicDir:root,config:{now:w.clock.ms,...config}});const srv=http.createServer(handler);await new Promise(r=>srv.listen(0,"127.0.0.1",r));
 const base="http://127.0.0.1:"+srv.address().port;
 const client=()=>{let sid="";return{async call(method,url,body,headers={}){const r=await fetch(base+url,{method,redirect:"manual",headers:{...(body!==undefined?{"Content-Type":"application/json"}:{}),...(sid?{Cookie:"sid="+sid}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined});
  const sc=r.headers.get("set-cookie");if(sc){const m=sc.match(/sid=([^;]*)/);if(m)sid=m[1]}let j=null;try{j=await r.json()}catch{}return{status:r.status,json:j,headers:r.headers}},
  get:function(u){return this.call("GET",u)},post:function(u,b={},h){return this.call("POST",u,b,h)},get sid(){return sid}}};
 return{base,client,close:()=>new Promise(r=>{srv.close(r);srv.closeAllConnections?.()})}}

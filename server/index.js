import http from "node:http";import path from "node:path";import {fileURLToPath} from "node:url";import {randomBytes} from "node:crypto";
import {createStore} from "./store.js";import {createService} from "./service.js";import {createApp} from "./app.js";import {gatewayFromEnv} from "./payments.js";
const env=process.env,root=path.dirname(fileURLToPath(import.meta.url));
const store=createStore(env.DATA_FILE||path.join(root,"..","data.json")),gateway=gatewayFromEnv(env),demo=env.DEMO==="1";
const service=createService({store,gateway,demo});
if(!store.d.users.some(u=>u.role==="admin")){const pw=env.ADMIN_PASSWORD||randomBytes(9).toString("base64url"),em=env.ADMIN_EMAIL||"admin@shootly.local";service.createAdmin(em,pw);console.log(`Admin created: ${em} / ${pw}`);store.save()}
if(demo&&!store.d.users.some(u=>u.email==="customer@demo.test")){const pw="Demo-pass-2026";
 service.register({name:"Demo Customer",email:"customer@demo.test",password:pw,role:"customer"});
 for(const [n,a,t,k] of [["Aarav Reddy","Madhapur",["Birthday","Family"],[["Mini shoot",1,"25 edited photos, online gallery",3,2500]]],["Meera Iyer","Banjara Hills",["Reel","Restaurant"],[["Reel pack",2,"3 edited reels, 30 to 45 sec",2,6000]]]]){
  const u=service.register({name:n,email:n.split(" ")[0].toLowerCase()+"@demo.test",password:pw,role:"creator",area:a,types:t});const c=store.d.creators.find(x=>x.userId===u.id);c.ver="verified";c.pk=k.map(([n,h,d,days,p])=>({n,h,d,days,p}))}
 console.log("Demo logins: customer@demo.test, aarav@demo.test, meera@demo.test / "+pw);store.save()}
const handler=createApp({service,store,gateway,publicDir:path.join(root,"..","public"),config:{secure:env.NODE_ENV==="production",trustProxy:env.TRUST_PROXY==="1"}});
http.createServer(handler).listen(+env.PORT||3000,()=>console.log("Shootly on http://localhost:"+(env.PORT||3000)+(gateway.mock?" (mock payments)":"")));

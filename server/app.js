import fs from "node:fs";import path from "node:path";import zlib from "node:zlib";import crypto from "node:crypto";
import {createLimiter} from "./security.js";import {HttpError} from "./service.js";
const MIME={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".txt":"text/plain; charset=utf-8",".xml":"application/xml; charset=utf-8",".svg":"image/svg+xml"};
const CSP="default-src 'self'; script-src 'self' https://checkout.razorpay.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self' https://lumberjack.razorpay.com; frame-src https://api.razorpay.com https://checkout.razorpay.com; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
export function createApp({service,store,gateway,publicDir,config={}}){
const now=config.now||Date.now,L=(w,m)=>createLimiter({windowMs:w,max:m,now});
const lim={global:L(6e4,config.globalMax??300),loginIp:L(6e5,config.loginIpMax??20),loginFail:L(9e5,config.loginFailMax??5),register:L(36e5,config.registerMax??5),pay:L(6e4,config.payMax??10),write:L(6e4,config.writeMax??60),mailIp:L(36e5,config.mailIpMax??8),mailKey:L(36e5,config.mailKeyMax??3),pw:L(9e5,config.pwMax??8)};
const sweeper=setInterval(()=>Object.values(lim).forEach(l=>l.sweep()),6e4);sweeper.unref?.();
const secure=!!config.secure,ip=r=>config.trustProxy?String(r.headers["x-forwarded-for"]||"").split(",")[0].trim()||r.socket.remoteAddress:r.socket.remoteAddress;
const cookie=(t,max)=>`sid=${t}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${max}${secure?"; Secure":""}`;
const E=(s,m,f)=>new HttpError(s,m,f);
const gate=(l,k)=>{const r=l.hit(k);if(!r.ok){const e=E(429,"Too many attempts. Try again in "+r.retryAfter+" seconds.");e.retryAfter=r.retryAfter;throw e}};
const U=c=>{if(!c.user)throw E(401,"Sign in to continue.");return c.user};
const R=(c,role)=>{if(U(c).role!==role)throw E(403,"Not allowed.");return c.user};
const mailKey=e=>String(e||"").trim().toLowerCase().slice(0,254);
const A=c=>R(c,"admin"),CR=c=>R(c,"creator"),meOut=c=>({user:service.authenticate(c.token),creator:c.user.role==="creator"?service.myCreator(c.user):null});
const routes=[
["GET","/api/health",()=>({ok:true})],
["POST","/api/auth/register",async c=>{gate(lim.register,c.ip);if(c.body.agree!==true)throw E(400,"Please accept the Terms and Privacy Policy.","agree");const u=service.register(c.body);service.recordConsent(u.id);const s=service.login({email:c.body.email,password:c.body.password});c.cookie=cookie(s.token,604800);return{user:u}}],
["POST","/api/auth/login",async c=>{gate(lim.loginIp,c.ip);const email=String(c.body.email||"").trim().toLowerCase().slice(0,254),k=c.ip+"|"+email,b=lim.loginFail.blocked(k);
 if(!b.ok){const e=E(429,"Too many wrong attempts. Try again in "+Math.ceil(b.retryAfter/60)+" min.");e.retryAfter=b.retryAfter;throw e}
 try{const s=service.login(c.body);lim.loginFail.reset(k);c.cookie=cookie(s.token,604800);return{user:s.user}}catch(e){if(e.status===401)lim.loginFail.hit(k);throw e}}],
["POST","/api/auth/logout",c=>{service.logout(c.token);c.cookie=cookie("",0);return{ok:true}}],
["POST","/api/auth/logout-all",c=>{service.logoutAll(U(c));c.cookie=cookie("",0);return{ok:true}}],
["POST","/api/auth/forgot",c=>{gate(lim.mailIp,c.ip);const e=mailKey(c.body.email);gate(lim.mailKey,e||c.ip);service.forgot(e).catch(x=>console.error("reset email failed:",x.message));return{ok:true}}],
["POST","/api/auth/reset",c=>{gate(lim.loginIp,c.ip);return service.resetPassword({token:String(c.body.token||""),password:c.body.password})}],
["POST","/api/auth/verify",c=>{gate(lim.loginIp,c.ip);return{user:service.verifyEmail(String(c.body.token||""))}}],
["POST","/api/auth/resend-verification",c=>{gate(lim.mailKey,U(c).id);return service.resendVerification(c.user)}],
["POST","/api/me/profile",c=>{gate(lim.write,U(c).id);service.updateName(c.user,c.body.name,c.body.phone);return meOut(c)}],
["POST","/api/me/password",c=>{gate(lim.pw,U(c).id);return service.changePassword(c.user,{current:c.body.current,password:c.body.password},c.token)}],
["GET","/api/me",c=>({user:U(c),creator:c.user.role==="creator"?service.myCreator(c.user):null,config:{mock:!!gateway.mock,keyId:gateway.keyId}})],
["GET",/^\/api\/creators\/(\w+)$/,c=>({creator:service.getCreator(c.m[1])})],
["GET","/api/creators",c=>({creators:service.listCreators(c.q)})],
["POST","/api/creator/packages",c=>{gate(lim.write,U(c).id);return{creator:service.myCreator(service.addPackage(R(c,"creator"),c.body)&&c.user)}}],
["POST","/api/creator/profile",c=>{gate(lim.write,CR(c).id);service.updateProfile(c.user,c.body);return meOut(c)}],
["POST",/^\/api\/creator\/packages\/(\w+)\/update$/,c=>{gate(lim.write,CR(c).id);service.editPackage(c.user,c.m[1],c.body);return meOut(c)}],
["POST",/^\/api\/creator\/packages\/(\w+)\/delete$/,c=>{gate(lim.write,CR(c).id);service.deletePackage(c.user,c.m[1]);return meOut(c)}],
["POST","/api/creator/availability",c=>{gate(lim.write,CR(c).id);service.setBlocked(c.user,c.body);return meOut(c)}],
["POST","/api/creator/portfolio",c=>{gate(lim.write,CR(c).id);service.addPortfolio(c.user,c.body);return meOut(c)},{big:true}],
["POST",/^\/api\/creator\/portfolio\/(\w+)\/delete$/,c=>{gate(lim.write,CR(c).id);service.removePortfolio(c.user,c.m[1]);return meOut(c)}],
["POST","/api/creator/id",c=>{gate(lim.write,CR(c).id);service.setIdDoc(c.user,c.body);return meOut(c)},{big:true}],
["POST","/api/creator/payout",c=>{gate(lim.write,CR(c).id);service.setPayout(c.user,c.body);return meOut(c)}],
["GET","/api/payments",c=>({payments:service.listPayments(U(c))})],
["GET",/^\/api\/bookings\/(\w+)\/receipt$/,c=>({receipt:service.receipt(U(c),c.m[1])})],
["GET","/api/bookings",c=>({bookings:service.listBookings(U(c))})],
["POST","/api/bookings",c=>{gate(lim.write,U(c).id);return{booking:service.makeBooking(U(c),c.body)}}],
["POST",/^\/api\/bookings\/([\w]+)\/(\w+)$/,async c=>{gate(lim.write,U(c).id);return{booking:await service.act(U(c),c.m[1],c.m[2],c.body)}}],
["POST","/api/payments/order",async c=>{gate(lim.pay,U(c).id);return await service.createOrder(R(c,"customer"),String(c.body.bookingId))}],
["POST","/api/payments/mock-checkout",c=>{R(c,"customer");if(!gateway.mock)throw E(404,"Not found.");const p=store.d.payments.find(x=>x.orderId===c.body.orderId),b=p&&store.d.bookings.find(x=>x.id===p.bookingId);
 if(!b||b.customerId!==c.user.id)throw E(404,"Order not found.");return gateway.mockCheckout(p.orderId)}],
["POST","/api/payments/verify",async c=>{gate(lim.pay,U(c).id);const b=c.body;return await service.verifyPayment(R(c,"customer"),{bookingId:String(b.bookingId),orderId:String(b.orderId),paymentId:String(b.paymentId),signature:String(b.signature)})}],
["POST","/api/payments/webhook",async c=>await service.webhook(c.raw,c.req.headers["x-razorpay-signature"],c.req.headers["x-razorpay-event-id"]),{raw:true}],
["GET","/api/admin/overview",c=>{const u=R(c,"admin");return{stats:service.stats(u),creators:service.adminCreators(u)}}],
["POST",/^\/api\/admin\/creators\/(\w+)\/(approve|suspend)$/,c=>{service.setCreatorStatus(A(c),c.m[1],c.m[2]==="approve"?"verified":"suspended");return{ok:true}}],
["GET",/^\/api\/admin\/creators\/(\w+)\/id$/,c=>{const f=service.readIdDoc(A(c),c.m[1]);return{__raw:{status:200,body:f.buf,headers:{"Content-Type":f.mime,"Content-Disposition":"inline","Cache-Control":"no-store","Content-Security-Policy":"sandbox; default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"}}}}],
["GET","/api/admin/payments",c=>({payments:service.adminPayments(A(c))})],
["POST",/^\/api\/admin\/payments\/(\w+)\/retry-refund$/,async c=>{gate(lim.write,A(c).id);return await service.retryRefund(c.user,c.m[1])}],
["GET","/api/admin/payouts",c=>({payouts:service.payouts(A(c))})],
["POST",/^\/api\/admin\/payouts\/(\w+)\/paid$/,c=>{gate(lim.write,A(c).id);return service.markPayoutPaid(c.user,c.m[1],c.body.ref)}],
["GET","/api/admin/users",c=>({users:service.adminUsers(A(c))})],
["POST",/^\/api\/admin\/users\/(\w+)\/(disable|enable)$/,c=>{gate(lim.write,A(c).id);return service.setUserDisabled(c.user,c.m[1],c.m[2]==="disable")}],
["GET","/api/admin/audit",c=>({audit:service.listAudit(A(c),{limit:c.q.limit,action:c.q.action})})]];
const send=(res,s,o,h={})=>{const b=JSON.stringify(o);res.writeHead(s,{"Content-Type":"application/json; charset=utf-8","Cache-Control":"no-store",...h});res.end(b)};
const readBody=(r,max)=>new Promise((ok,no)=>{let n=0;const a=[];r.on("data",d=>{n+=d.length;if(n>max){no(E(413,"Request too large."));r.destroy()}else a.push(d)});r.on("end",()=>ok(Buffer.concat(a).toString("utf8")));r.on("error",no)});
const cache=new Map();
function asset(f){const st=fs.statSync(f),k=f,c=cache.get(k);if(c&&c.m===st.mtimeMs)return c;const buf=fs.readFileSync(f),ext=path.extname(f),text=ext!==".svg"||true;
 const e={m:st.mtimeMs,buf,etag:'"'+crypto.createHash("sha1").update(buf).digest("base64url").slice(0,20)+'"',gz:zlib.gzipSync(buf,{level:9}),br:zlib.brotliCompressSync(buf,{params:{[zlib.constants.BROTLI_PARAM_QUALITY]:9}})};cache.set(k,e);return e}
function serve(req,res,p){if(p==="/")p="/index.html";let f;try{f=path.normalize(path.join(publicDir,decodeURIComponent(p)))}catch{res.writeHead(400);return res.end()}
 if(!f.startsWith(publicDir+path.sep)||!MIME[path.extname(f)]||!fs.existsSync(f)||!fs.statSync(f).isFile()){res.writeHead(404,{"Content-Type":"text/plain"});return res.end("Not found")}
 const a=asset(f),ae=String(req.headers["accept-encoding"]||""),enc=/\bbr\b/.test(ae)?"br":/\bgzip\b/.test(ae)?"gzip":"",body=enc==="br"?a.br:enc==="gzip"?a.gz:a.buf;
 const h={"Content-Type":MIME[path.extname(f)],"Cache-Control":"no-cache",ETag:a.etag,Vary:"Accept-Encoding"};if(enc)h["Content-Encoding"]=enc;
 if(req.headers["if-none-match"]===a.etag){res.writeHead(304,{ETag:a.etag,"Cache-Control":"no-cache"});return res.end()}
 h["Content-Length"]=body.length;res.writeHead(200,h);res.end(req.method==="HEAD"?undefined:body)}
return async function handler(req,res){
 res.setHeader("X-Content-Type-Options","nosniff");res.setHeader("Content-Security-Policy",CSP);res.setHeader("Referrer-Policy","strict-origin-when-cross-origin");res.setHeader("X-Frame-Options","DENY");if(secure)res.setHeader("Strict-Transport-Security","max-age=31536000");
 const url=new URL(req.url,"http://x"),a=ip(req);
 try{gate(lim.global,a);
  if(url.pathname.startsWith("/uploads/")){if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);return res.end()}const f=service.uploads.readPublic(url.pathname.slice(9));if(!f){res.writeHead(404,{"Content-Type":"text/plain"});return res.end("Not found")}
   res.writeHead(200,{"Content-Type":f.mime,"Cache-Control":"public, max-age=31536000, immutable","Content-Security-Policy":"default-src 'none'; sandbox"});return res.end(f.buf)}
  if(!url.pathname.startsWith("/api/")){if(req.method!=="GET"&&req.method!=="HEAD"){res.writeHead(405);return res.end()}return serve(req,res,url.pathname)}
  let route,m;for(const r of routes){if(r[0]!==req.method)continue;if(typeof r[1]==="string"){if(r[1]===url.pathname){route=r;break}}else if((m=url.pathname.match(r[1]))){route=r;break}}
  if(!route){const known=routes.some(r=>typeof r[1]==="string"?r[1]===url.pathname:r[1].test(url.pathname));throw E(known?405:404,known?"Method not allowed.":"Not found.")}
  const raw=route[3]?.raw,post=req.method==="POST";
  if(post&&!raw){const o=req.headers.origin;if(o){let h;try{h=new URL(o).host}catch{}if(h!==req.headers.host)throw E(403,"Cross-site request blocked.")}
   if(!String(req.headers["content-type"]||"").startsWith("application/json"))throw E(415,"Send JSON.")}
  const text=post?await readBody(req,route[3]?.big?4.2e6:1e5):"";let body={};
  if(post&&!raw&&text){try{body=JSON.parse(text);if(!body||typeof body!=="object"||Array.isArray(body))throw 0}catch{throw E(400,"Invalid JSON.")}}
  const token=(String(req.headers.cookie||"").match(/(?:^|;\s*)sid=([\w-]+)/)||[])[1];
  const ctx={req,res,ip:a,body,raw:text,token,user:service.authenticate(token),q:Object.fromEntries(url.searchParams),m,cookie:null};
  const out=await route[2](ctx);if(post)await store.save();
  if(out&&out.__raw){res.writeHead(out.__raw.status,out.__raw.headers);return res.end(out.__raw.body)}
  send(res,200,out,ctx.cookie?{"Set-Cookie":ctx.cookie}:{})}
 catch(e){if(e instanceof HttpError){if(e.persist)await Promise.resolve(store.save()).catch(x=>console.error(x));return send(res,e.status,{error:e.message,field:e.field},e.retryAfter?{"Retry-After":String(e.retryAfter)}:{})}
  console.error(e);send(res,500,{error:"Something went wrong. Try again."})}}}

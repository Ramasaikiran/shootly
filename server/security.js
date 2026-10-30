import {scryptSync,randomBytes,timingSafeEqual,createHash,createHmac,createCipheriv,createDecipheriv} from "node:crypto";
export const hashPassword=pw=>{const salt=randomBytes(16);return `s1$${salt.toString("base64")}$${scryptSync(pw,salt,64).toString("base64")}`};
export function verifyPassword(pw,stored){try{const[,s,h]=stored.split("$");const a=scryptSync(pw,Buffer.from(s,"base64"),64),b=Buffer.from(h,"base64");return a.length===b.length&&timingSafeEqual(a,b)}catch{return false}}
export const DUMMY_HASH=hashPassword("dummy-password-for-timing");
export const newToken=()=>randomBytes(32).toString("base64url");
export const sha=t=>createHash("sha256").update(t).digest("hex");
export const hmac=(secret,msg)=>createHmac("sha256",secret).update(msg).digest("hex");
export function safeEq(a,b){const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)}
export function createLimiter({windowMs,max,now=Date.now}){const m=new Map();
const live=k=>{const t=now(),a=(m.get(k)||[]).filter(x=>t-x<windowMs);a.length?m.set(k,a):m.delete(k);return a};
return{count:k=>live(k).length,
hit(k){const a=live(k),t=now();if(a.length>=max)return{ok:false,retryAfter:Math.max(1,Math.ceil((a[0]+windowMs-t)/1000))};a.push(t);m.set(k,a);return{ok:true,remaining:max-a.length}},
blocked(k){const a=live(k);return a.length>=max?{ok:false,retryAfter:Math.max(1,Math.ceil((a[0]+windowMs-now())/1000))}:{ok:true}},
reset:k=>m.delete(k),sweep(){for(const k of [...m.keys()])live(k)},size:()=>m.size}}

// AES-256-GCM for payout details (bank account or UPI id). Output: v1.iv.tag.data (base64url)
export function encrypt(key,text){const iv=randomBytes(12),c=createCipheriv("aes-256-gcm",key,iv),d=Buffer.concat([c.update(String(text),"utf8"),c.final()]);return["v1",iv.toString("base64url"),c.getAuthTag().toString("base64url"),d.toString("base64url")].join(".")}
export function decrypt(key,blob){const[v,iv,tag,d]=String(blob).split(".");if(v!=="v1")throw new Error("Unknown cipher format");const c=createDecipheriv("aes-256-gcm",key,Buffer.from(iv,"base64url"));c.setAuthTag(Buffer.from(tag,"base64url"));return Buffer.concat([c.update(Buffer.from(d,"base64url")),c.final()]).toString("utf8")}
export function encKeyFromEnv(env){const k=env.PAYOUT_ENC_KEY;if(k){const b=Buffer.from(k,"hex");if(b.length!==32||!/^[0-9a-fA-F]{64}$/.test(k))throw new Error("PAYOUT_ENC_KEY must be 64 hex characters. Generate one: openssl rand -hex 32");return b}
if(env.NODE_ENV==="production")throw new Error("Set PAYOUT_ENC_KEY in production. Generate one: openssl rand -hex 32");return scryptSync("shootly-dev-only-key","shootly",32)}

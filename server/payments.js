import {randomBytes} from "node:crypto";
import {hmac,safeEq} from "./security.js";
// Razorpay documented checks: HMAC_SHA256(order_id|payment_id, key_secret); webhook: HMAC_SHA256(rawBody, webhook_secret)
export const verifyCheckoutSignature=(secret,orderId,paymentId,sig)=>!!sig&&safeEq(hmac(secret,`${orderId}|${paymentId}`),sig);
export const verifyWebhookSignature=(secret,raw,sig)=>!!sig&&safeEq(hmac(secret,raw),sig);
export class RazorpayGateway{
constructor({keyId,keySecret,webhookSecret,fetchImpl=fetch}){Object.assign(this,{keyId,keySecret,webhookSecret,fetchImpl});this.mock=false}
async #call(path,body){const r=await this.fetchImpl("https://api.razorpay.com/v1"+path,{method:body?"POST":"GET",headers:{"Content-Type":"application/json",Authorization:"Basic "+Buffer.from(`${this.keyId}:${this.keySecret}`).toString("base64")},body:body?JSON.stringify(body):undefined});
const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j?.error?.description||"Payment provider error");return j}
createOrder({amount,receipt}){return this.#call("/orders",{amount,currency:"INR",receipt}).then(o=>({id:o.id}))}
refund(paymentId,amount){return this.#call(`/payments/${paymentId}/refund`,{amount}).then(r=>({id:r.id}))}
// Before a retry: did an earlier attempt actually succeed at Razorpay even though we never saw the reply?
async findRefund(paymentId,amount){const j=await this.#call(`/payments/${paymentId}/refunds`);const r=(j.items||[]).find(x=>x.amount>=amount&&x.status!=="failed");return r?{id:r.id}:null}
verifyPayment(o,p,s){return verifyCheckoutSignature(this.keySecret,o,p,s)}
verifyWebhook(raw,sig){return verifyWebhookSignature(this.webhookSecret,raw,sig)}}
// Dev and test gateway. Never use in production.
export class MockGateway{
constructor(){this.keyId="mock_key";this.secret="mock_secret";this.webhookSecret="mock_webhook";this.mock=true;this.refunds=[];this.failRefunds=0}
async createOrder({amount}){return{id:"order_"+randomBytes(8).toString("hex"),amount}}
findRefund(paymentId,amount){const r=this.refunds.find(x=>x.paymentId===paymentId&&x.amount>=amount);return Promise.resolve(r?{id:r.id}:null)}
async refund(paymentId,amount){if(this.failRefunds>0){this.failRefunds--;throw new Error("Mock provider is down")}const id="rfnd_"+randomBytes(6).toString("hex");this.refunds.push({paymentId,amount,id});return{id}}
verifyPayment(o,p,s){return verifyCheckoutSignature(this.secret,o,p,s)}
verifyWebhook(raw,sig){return verifyWebhookSignature(this.webhookSecret,raw,sig)}
mockCheckout(orderId){const paymentId="pay_"+randomBytes(8).toString("hex");return{orderId,paymentId,signature:hmac(this.secret,`${orderId}|${paymentId}`)}}}
export function gatewayFromEnv(env){if(env.RAZORPAY_KEY_ID&&env.RAZORPAY_KEY_SECRET)return new RazorpayGateway({keyId:env.RAZORPAY_KEY_ID,keySecret:env.RAZORPAY_KEY_SECRET,webhookSecret:env.RAZORPAY_WEBHOOK_SECRET||""});
if(env.NODE_ENV==="production")throw new Error("Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in production.");return new MockGateway()}

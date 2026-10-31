export const COUNTRIES=["India"];
export const LOCATIONS={"Telangana":["Madhapur","Banjara Hills","Gachibowli","Hitech City","Secunderabad","Uppal","LB Nagar"],"Andhra Pradesh":["Vizag","Vijayawada","Guntur","Kurnool"]};
export const STATES=Object.keys(LOCATIONS);
export const AREAS=STATES.flatMap(s=>LOCATIONS[s]);
export const stateOf=a=>STATES.find(s=>LOCATIONS[s].includes(a))||"";
export const normPhone=p=>{const d=String(p??"").replace(/[\s\-()]/g,"").replace(/^(\+91|91|0)(?=\d{10}$)/,"");return /^[6-9]\d{9}$/.test(d)?d:""};
export const validPhone=p=>!!normPhone(p);
export const TYPES=["Birthday","Family","Graduation","Reel","Product","Restaurant"];
export const SLOTS=["10:00","16:00"];
const COMMON=["password","12345678","123456789","qwertyuiop","iloveyou","letmein123","welcome123"];
export const validEmail=e=>typeof e==="string"&&e.length<=254&&/^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/.test(e);
export function passwordIssues(pw,email=""){const o=[];if(typeof pw!=="string")return["Enter a password."];
if(pw.length<10)o.push("Use at least 10 characters.");if(pw.length>128)o.push("Use 128 characters or fewer.");
if(!/[A-Za-z]/.test(pw)||!/\d/.test(pw))o.push("Mix letters and numbers.");
if(COMMON.some(c=>pw.toLowerCase().includes(c)))o.push("That password is too common.");
const u=String(email).split("@")[0].toLowerCase();if(u.length>=4&&pw.toLowerCase().includes(u))o.push("Do not use your email name.");return o}
export function passwordScore(pw){if(!pw)return 0;let s=0;if(pw.length>=10)s++;if(pw.length>=14)s++;if(/[a-z]/.test(pw)&&/[A-Z]/.test(pw))s++;if(/\d/.test(pw)&&/[^A-Za-z0-9]/.test(pw))s++;return Math.min(4,s)}

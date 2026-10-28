import {mountAuth} from "./components.js";import {post,home,safeNext} from "./app.js";
const p=new URLSearchParams(location.search);
{const c=document.querySelector("#ctx");if(c&&(p.get("next")||"").includes("book=")){c.hidden=false}}
mountAuth(document.querySelector("#auth"),{mode:p.get("mode")==="register"?"register":"login",api:{login:b=>post("/api/auth/login",b),register:b=>post("/api/auth/register",b)},
 onDone:u=>setTimeout(()=>location.replace(safeNext(p.get("next"),u.role)),matchMedia("(prefers-reduced-motion:reduce)").matches?0:650)});

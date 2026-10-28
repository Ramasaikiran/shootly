import fs from "node:fs";
export function createStore(file){let d={users:[],creators:[],bookings:[],payments:[],sessions:{},events:{},seq:1};
if(file&&fs.existsSync(file)){try{d={...d,...JSON.parse(fs.readFileSync(file,"utf8"))}}catch{}}
return{d,id:p=>p+(d.seq++),save(){if(!file)return;const t=file+".tmp";fs.writeFileSync(t,JSON.stringify(d));fs.renameSync(t,file)}}}

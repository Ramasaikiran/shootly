import re
P='public/'
def rd(f):return open(P+f).read()
def strip(s):
    s=re.sub(r'import\s*\{[^}]*\}\s*from\s*"[^"]*";?','',s)
    return re.sub(r'(^|\n)export ',r'\1',s)
mods="\n".join(strip(rd(f)) for f in ["policy.js","components.js","panel.js","app.js"])
pages={r:strip(rd(r+".js")) for r in ["customer","creator","admin"]}
fake=open('tools/fake_api.js').read()
css=rd("shared.css")
runs="\n".join(f'async function run_{r}(){{\n{c}\n}}' for r,c in pages.items())
html='''<!DOCTYPE html><html lang="en-IN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>Shootly panels preview</title>
<link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Schibsted+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet"><style>'''+css+'''
.pv{background:var(--ink);color:var(--bg);padding:8px 14px;display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:14px;padding-top:calc(8px + env(safe-area-inset-top,0px))}.pv b{margin-right:4px}.pv button{border:1px solid rgba(255,255,255,.35);background:none;color:inherit;border-radius:99px;padding:6px 14px;cursor:pointer;font-weight:600;min-height:36px}.pv button[aria-pressed=true]{background:var(--bg);color:var(--ink)}.pv span{opacity:.75;font-size:13px}
header.top{padding-top:0}</style></head><body>
<div class="pv"><b>Preview as</b><button data-r="customer">Customer</button><button data-r="creator">Creator</button><button data-r="admin">Admin</button><span>Sample data. Resets on reload.</span></div>
<header class="top" id="hd"><div class="wrap bar"><a class="logo" href="#">Shootly</a></div></header><main class="wrap" id="app"></main><dialog id="dlg"></dialog>
<script>
(async()=>{
'''+fake+'''
const location={replace:u=>toast("Preview: would go to "+u),search:"",pathname:"/"+ROLE+".html",set href(v){toast("Preview: signed out")},get href(){return ""}};
'''+mods+'''
'''+runs+'''
document.querySelectorAll(".pv [data-r]").forEach(b=>{b.setAttribute("aria-pressed",String(b.dataset.r===ROLE));b.onclick=()=>{window.location.hash=b.dataset.r;window.location.reload()}});
try{await ({customer:run_customer,creator:run_creator,admin:run_admin})[ROLE]()}catch(e){if(e.message!=="redirecting")console.error(e)}
})();
</script></body></html>'''
open('/mnt/user-data/outputs/panels-preview.html','w').write(html);print(len(html))

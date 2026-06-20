import { chromium } from "playwright";
const URL = process.argv[2];
const b = await chromium.launch({ headless:true, channel:"chrome", args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const p = await b.newPage({ viewport:{width:1280,height:800}});
const errs=[]; p.on("pageerror",e=>errs.push(e.message)); p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(URL,{waitUntil:"load",timeout:60000});
// poll for connection up to 50s
let conn=null;
for(let i=0;i<50;i++){ conn=await p.evaluate(()=>document.querySelector(".conn")?.textContent||""); if(/live/.test(conn))break; await p.waitForTimeout(1000);}
await p.evaluate(()=>{const x=Array.from(document.querySelectorAll(".presets button")).find(e=>e.textContent.includes("Bloom"));x&&x.click();});
await p.waitForTimeout(6000);
const frac=await p.evaluate(()=>document.querySelector(".op-readout span")?.textContent);
await p.screenshot({path:"/tmp/remote_tissue.png"});
const t0=Date.now();
await p.evaluate(()=>{Array.from(document.querySelectorAll(".scenes button")).find(b=>b.textContent.trim()==="map").click();});
let mapped=false; try{ await p.waitForSelector(".pm-canvas",{timeout:40000}); mapped=true;}catch{}
const sweepMs=Date.now()-t0; await p.waitForTimeout(600); await p.screenshot({path:"/tmp/remote_map.png"});
// cell scene
await p.evaluate(()=>{Array.from(document.querySelectorAll(".scenes button")).find(b=>b.textContent.trim()==="cell").click();});
await p.waitForTimeout(3000); await p.screenshot({path:"/tmp/remote_cell.png"});
console.log("CONN:",conn,"| BLOOM_FRAC:",frac,"| SWEEP_MAPPED:",mapped,"in",sweepMs,"ms");
console.log("ERRORS:",errs.filter(e=>!/favicon/.test(e)).length?JSON.stringify(errs.filter(e=>!/favicon/.test(e))):"none");
await b.close();

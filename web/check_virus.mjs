import { chromium } from "playwright";
const URL="https://believe-use-listprice-lending.trycloudflare.com";
const b=await chromium.launch({headless:true,channel:"chrome",args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:1280,height:800}});
const errs=[];p.on("pageerror",e=>errs.push(e.message));p.on("console",m=>{if(m.type()==="error")errs.push(m.text());});
await p.goto(URL,{waitUntil:"load",timeout:60000});
let conn=""; for(let i=0;i<50;i++){conn=await p.evaluate(()=>document.querySelector(".conn")?.textContent||"");if(/live/.test(conn))break;await p.waitForTimeout(1000);}
// reset clean tissue then release virus
await p.evaluate(()=>{const r=Array.from(document.querySelectorAll(".buttons button")).find(x=>x.textContent.trim()==="Reset");r&&r.click();});
await p.waitForTimeout(1500);
const has=await p.evaluate(()=>!!Array.from(document.querySelectorAll(".buttons button")).find(x=>x.textContent.includes("Release virus")));
await p.evaluate(()=>{const v=Array.from(document.querySelectorAll(".buttons button")).find(x=>x.textContent.includes("Release virus"));v&&v.click();});
await p.waitForTimeout(9000);
const stats=await p.evaluate(()=>{const s=useStore?.getState?.().stats; return null;});
await p.screenshot({path:"/tmp/virus_tissue.png"});
// read infected from chart label presence + sample store via window? fallback: just screenshot. Also pull last infected via DOM not available; use health-less approach.
console.log("CONN:",conn,"| Release button present:",has);
console.log("ERRORS:",errs.filter(e=>!/favicon/.test(e)).length?JSON.stringify(errs.filter(e=>!/favicon/.test(e))):"none");
await b.close();

import { chromium } from "playwright";
const URL="https://believe-use-listprice-lending.trycloudflare.com";
const b=await chromium.launch({headless:true,channel:"chrome",args:["--use-gl=angle","--use-angle=swiftshader","--ignore-gpu-blocklist"]});
const p=await b.newPage({viewport:{width:1280,height:800}});
await p.goto(URL,{waitUntil:"load",timeout:60000});
for(let i=0;i<40;i++){const c=await p.evaluate(()=>document.querySelector(".conn")?.textContent||"");if(/live/.test(c))break;await p.waitForTimeout(1000);}
const click=(t)=>p.evaluate((t)=>{const x=Array.from(document.querySelectorAll("button")).find(e=>e.textContent.trim()===t||e.textContent.includes(t));x&&x.click();},t);
await click("Homeostasis");          // calm tissue so virus is the star
await p.waitForTimeout(1500);
await click("Release virus");
await p.waitForTimeout(9000);
await click("Release virus");          // a second seeding for spread
await p.waitForTimeout(7000);
await p.screenshot({path:"/tmp/virus_live.png"});
console.log("done");
await b.close();

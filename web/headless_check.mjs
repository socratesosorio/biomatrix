import { chromium } from "playwright";

const url = "http://localhost:5173/";
const errors = [];
const logs = [];

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
page.on("console", (m) => {
  logs.push(`[${m.type()}] ${m.text()}`);
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(url, { waitUntil: "networkidle" });

// WebGL2 sanity
const glOk = await page.evaluate(() => {
  const c = document.querySelector("canvas.gl-canvas");
  if (!c) return "no-canvas";
  const gl = c.getContext("webgl2");
  return gl ? "webgl2-ok" : "no-webgl2";
});

// let frames stream + tumor grow
await page.waitForTimeout(2500);

// check connection badge + a frame arrived
const status = await page.evaluate(() => {
  const conn = document.querySelector(".conn")?.textContent || "?";
  return { conn };
});

// drive aggression slider up and grab the live tumor fraction readout
await page.evaluate(() => {
  const el = document.querySelector('.scenes button:nth-child(2)');
  el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
});
await page.waitForTimeout(500);
await page.screenshot({ path: "/tmp/tissue_tissue.png" });

// go to cell scene (attention overlay)
await page.evaluate(() => {
  document.querySelectorAll('.scenes button')[2].dispatchEvent(new MouseEvent('click',{bubbles:true}));
});
await page.waitForTimeout(2000);
await page.screenshot({ path: "/tmp/tissue_cell.png" });

// body scene
await page.evaluate(() => {
  document.querySelectorAll('.scenes button')[0].dispatchEvent(new MouseEvent('click',{bubbles:true}));
});
await page.waitForTimeout(1500);
await page.screenshot({ path: "/tmp/tissue_body.png" });

const readout = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('.op-readout span')).map(s=>s.textContent);
});

console.log("GL:", glOk);
console.log("CONN:", status.conn);
console.log("ORDER_PARAM_READOUT:", JSON.stringify(readout));
console.log("ERRORS:", errors.length ? JSON.stringify(errors, null, 2) : "none");
console.log("SAMPLE_LOGS:", JSON.stringify(logs.slice(0, 8), null, 2));

await browser.close();

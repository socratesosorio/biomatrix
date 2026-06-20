import { chromium } from "playwright";

const url = "http://localhost:5173/";
const browser = await chromium.launch({
  headless: true, channel: "chrome",
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForSelector(".conn.ok", { timeout: 10000 }); // wait for live WS

const readFrac = () => page.evaluate(() => {
  const s = document.querySelector(".op-readout span");
  return s ? parseFloat(s.textContent) : null;
});
const clickPreset = (label) => page.evaluate((l) => {
  const b = Array.from(document.querySelectorAll(".presets button")).find(x => x.textContent.includes(l));
  b && b.click();
}, label);

// --- f core: homeostasis should suppress, bloom should explode ---
await clickPreset("Homeostasis");
await page.waitForTimeout(9000);
const fracHomeo = await readFrac();

await clickPreset("Bloom");
await page.waitForTimeout(11000);
const fracBloom = await readFrac();

console.log("HOMEOSTASIS tumor_fraction:", fracHomeo, "%");
console.log("BLOOM tumor_fraction:", fracBloom, "%");
console.log("PHASE TRANSITION VISIBLE:", fracBloom - fracHomeo > 25 ? "YES" : "NO");

// --- phase map ---
await page.evaluate(() => {
  Array.from(document.querySelectorAll(".scenes button")).find(b=>b.textContent.trim()==="map").click();
});
console.log("sweep running… (batched forward passes)");
try {
  await page.waitForSelector(".pm-canvas", { timeout: 60000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: "/tmp/tissue_map.png" });
  console.log("PHASE MAP: rendered");
} catch (e) {
  await page.screenshot({ path: "/tmp/tissue_map.png" });
  console.log("PHASE MAP: TIMEOUT");
}

// --- split seeds ---
await page.evaluate(() => {
  Array.from(document.querySelectorAll(".scenes button")).find(b=>b.textContent.trim()==="tissue").click();
  const sp = Array.from(document.querySelectorAll(".buttons button")).find(x=>x.textContent.includes("Split"));
  sp && sp.click();
});
await page.waitForTimeout(6000);
await page.screenshot({ path: "/tmp/tissue_split.png" });
const splitReadout = await page.evaluate(() =>
  Array.from(document.querySelectorAll(".op-readout span")).map(s=>s.textContent));
console.log("SPLIT readout (two seeds):", JSON.stringify(splitReadout));

console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "none");
await browser.close();

/**
 * Coeur de metrique web, sur un telephone bride.
 *
 * Une capture d'ecran ne dit rien du poids : en local tout arrive en trente
 * millisecondes. La mesure se fait donc en 4G bridee (1,6 Mb/s, 150 ms de
 * latence) avec le processeur divise par quatre, ce qui est l'ordre de
 * grandeur d'un telephone de milieu de gamme. C'est la seule mesure qui
 * ressemble a ce que vit un lecteur.
 *
 *   LCP  le plus grand element de l'ecran, en millisecondes
 *   CLS  ce qui bouge apres coup, sans que le lecteur l'ait demande
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://127.0.0.1:4321";
const CIBLES = process.argv.slice(2).length ? process.argv.slice(2) : [
  ["accueil", "/"],
  ["fil", "/actualite-du-mma/"],
  ["rubrique", "/categorie/ufc/"],
  ["article", "/ufc-paris-2026-date-lieu-carte-enjeux/"],
  ["portrait", "/portrait-ufc-john-jones/"],
  ["clubs", "/clubs-mma-francais/"],
  ["carte", "/carte/ufc-paris-2026/"],
  ["organisation", "/organisation-mma-ksw/"],
].map((x) => (Array.isArray(x) ? x : [x, x]));

const nav = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
console.log("nom            LCP      CLS   octets  req  plus grand element");
for (const [nom, url] of CIBLES) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.addInitScript(() => {
    window.__lcp = 0; window.__cls = 0;
    window.__lcpQui = "";
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) {
        window.__lcp = e.startTime;
        const el = e.element;
        window.__lcpQui = e.url || (el ? el.tagName.toLowerCase() + (el.className ? "." + String(el.className).split(" ")[0] : "") : "?");
      }
    }).observe({ type: "largest-contentful-paint", buffered: true });
    new PerformanceObserver((l) => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; })
      .observe({ type: "layout-shift", buffered: true });
  });
  await page.goto(BASE + url, { waitUntil: "load", timeout: 90000 });
  await page.waitForTimeout(2500);
  const r = await page.evaluate(() => {
    const res = performance.getEntriesByType("resource");
    const octets = res.reduce((n, e) => n + (e.transferSize || 0), 0) +
      (performance.getEntriesByType("navigation")[0]?.transferSize || 0);
    return {
      lcp: Math.round(window.__lcp),
      cls: +window.__cls.toFixed(4),
      qui: String(window.__lcpQui).split("/").pop().slice(0, 30),
      ko: Math.round(octets / 1024),
      req: res.length + 1,
    };
  });
  console.log(
    `${nom.padEnd(14)} ${String(r.lcp).padStart(5)} ms ${String(r.cls).padStart(7)} ` +
      `${String(r.ko).padStart(6)} Ko ${String(r.req).padStart(4)}  ${r.qui}`
  );
  await ctx.close();
}
await nav.close();

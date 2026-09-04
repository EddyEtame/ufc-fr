/**
 * Le hachage au defilement.
 *
 * Le reproche etait precis : « c'est saccade, puis tres lent, puis ca file
 * jusqu'en bas ». On ne repond pas a ca par une impression. On defile la page
 * par crans de molette, on compte les trames longues — celles qui depassent
 * 50 ms, ou le doigt sent que l'ecran ne suit plus — et on releve combien de
 * pixels la page a reellement parcourus pour ce qu'on lui a demande.
 *
 * Processeur divise par quatre : un telephone de milieu de gamme.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://127.0.0.1:4321";
const CIBLES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/", "/actualite-du-mma/", "/categorie/ufc/", "/clubs-mma-francais/",
  "/carte/ufc-paris-2026/", "/ufc-paris-2026-date-lieu-carte-enjeux/",
];

const nav = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
console.log("page                                trames  longues  >50ms   demande  parcouru");
for (const url of CIBLES) {
  const ctx = await nav.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
  await page.goto(BASE + url, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  await page.evaluate(() => {
    window.__t = [];
    let d = performance.now();
    (function boucle(n) {
      const m = performance.now();
      window.__t.push(m - d);
      d = m;
      requestAnimationFrame(boucle);
    })();
  });

  // Vingt crans de molette de 120 px : 2 400 px demandes.
  const avant = await page.evaluate(() => window.scrollY);
  for (let i = 0; i < 20; i++) {
    await page.mouse.wheel(0, 120);
    await page.waitForTimeout(45);
  }
  await page.waitForTimeout(500);
  const r = await page.evaluate((a) => {
    const t = window.__t.slice(2);
    return {
      n: t.length,
      longues: t.filter((x) => x > 24).length,
      graves: t.filter((x) => x > 50).length,
      parcouru: Math.round(window.scrollY - a),
    };
  }, avant);
  console.log(
    `${url.padEnd(36)}${String(r.n).padStart(5)}${String(r.longues).padStart(8)}${String(r.graves).padStart(7)}` +
      `${String(2400).padStart(10)}${String(r.parcouru).padStart(10)}`
  );
  await ctx.close();
}
await nav.close();

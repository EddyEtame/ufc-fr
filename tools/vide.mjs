/**
 * Mesure du vide.
 *
 * Un reproche revient : « il y a beaucoup d'espace vide ». C'est verifiable.
 * Ce script rend une page, la parcourt ligne par ligne, et releve les bandes
 * horizontales ou aucun element visible ne peint quoi que ce soit. Il rend le
 * pourcentage de la hauteur totale et la liste des intervalles.
 */
import { chromium } from "playwright-core";

const BASE = process.env.BASE || "http://127.0.0.1:4321";
const CIBLES = process.argv.slice(2).length ? process.argv.slice(2) : [
  "/", "/actualite-du-mma/", "/clubs-mma-francais/", "/carte/ufc-paris-2026/",
  "/portrait-ufc-john-jones/", "/categorie/ufc/",
];

const b = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });

for (const [tag, vp] of [["bureau", { width: 1440, height: 900 }], ["tel", { width: 390, height: 844 }]]) {
  console.log(`\n=== ${tag} ${vp.width}x${vp.height} ===`);
  for (const url of CIBLES) {
    const ctx = await b.newContext({ viewport: vp });
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: "networkidle" });
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(400);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(200);
    const r = await page.evaluate(() => {
      const H = Math.ceil(document.documentElement.scrollHeight);
      const peint = new Uint8Array(H);
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.display === "none" || cs.visibility === "hidden" || +cs.opacity === 0) continue;
        const aDuFond = cs.backgroundImage !== "none" ||
          !/^rgba\(0, 0, 0, 0\)$|^transparent$/.test(cs.backgroundColor);
        const estMedia = /^(IMG|VIDEO|CANVAS|SVG|PICTURE|HR)$/.test(el.tagName);
        const aDuTexte = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        const aUneBordure = parseFloat(cs.borderTopWidth) > 0 || parseFloat(cs.borderBottomWidth) > 0;
        if (!aDuFond && !estMedia && !aDuTexte && !aUneBordure) continue;
        const q = el.getBoundingClientRect();
        if (q.width < 4 || q.height < 2) continue;
        // Un fond pose sur toute la page ne compte pas comme du contenu.
        if (aDuFond && !estMedia && !aDuTexte && q.height > innerHeight * 1.5) continue;
        const a = Math.max(0, Math.floor(q.top + scrollY));
        const z = Math.min(H, Math.ceil(q.bottom + scrollY));
        for (let y = a; y < z; y++) peint[y] = 1;
      }
      const trous = [];
      let d = -1;
      for (let y = 0; y < H; y++) {
        if (!peint[y]) { if (d < 0) d = y; }
        else if (d >= 0) { if (y - d >= 90) trous.push([d, y - d]); d = -1; }
      }
      if (d >= 0 && H - d >= 90) trous.push([d, H - d]);
      const vide = trous.reduce((s, t) => s + t[1], 0);
      return { H, vide, trous };
    });
    const pct = ((r.vide / r.H) * 100).toFixed(1);
    const liste = r.trous.map(([y, h]) => `${h}px@${y}`).join(" ");
    console.log(`${pct.padStart(5)}%  ${String(r.H).padStart(6)}px  ${url}${liste ? "\n         " + liste : ""}`);
    await ctx.close();
  }
}
await b.close();

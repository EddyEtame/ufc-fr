/**
 * Recadrer une photo.
 *
 * Aucun outil d'image n'est installe sur cette machine ; le navigateur en
 * est un. Ce script decoupe une region d'une image et la reduit a une
 * largeur donnee.
 *
 *   node tools/recadre.mjs <fichier> <x%> <y%> <l%> <h%> [largeur] [qualite]
 *
 * Les quatre pourcentages decrivent la region gardee, en fraction de
 * l'original. Le fichier est reecrit sur place — le depot est versionne,
 * `git show` rend l'original.
 *
 * Il existe parce qu'une photo mal cadree coute plus cher qu'une photo
 * absente : l'exterieur de l'Accor Arena ouvrait l'accueil sur six cents
 * pixels dont les deux tiers etaient du ciel gris.
 */
import { chromium } from "playwright-core";
import { readFileSync, writeFileSync } from "node:fs";
import { extname } from "node:path";

const MIME = { ".jpg": "jpeg", ".jpeg": "jpeg", ".png": "png", ".webp": "webp" };
const [f, X, Y, L, H, larg = "1800", q = "0.86"] = process.argv.slice(2);
if (!f) { console.error("usage: recadre.mjs <fichier> <x%> <y%> <l%> <h%> [largeur] [qualite]"); process.exit(1); }

const src = readFileSync(f);
const nav = await chromium.launch({ executablePath: process.env.CHROME || "/opt/pw-browsers/chromium" });
const page = await nav.newPage();
const sortieMime = extname(f).toLowerCase() === ".png" ? "png" : (extname(f).toLowerCase() === ".webp" ? "webp" : "jpeg");
const r = await page.evaluate(async (a) => {
  const img = new Image();
  img.src = `data:image/${a.mime};base64,${a.b64}`;
  await img.decode();
  const sx = img.naturalWidth * a.x, sy = img.naturalHeight * a.y;
  const sw = img.naturalWidth * a.l, sh = img.naturalHeight * a.h;
  const c = document.createElement("canvas");
  c.width = Math.min(a.larg, Math.round(sw));
  c.height = Math.round((sh / sw) * c.width);
  const ctx = c.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, c.width, c.height);
  return { url: c.toDataURL("image/" + a.out, a.q), w: c.width, h: c.height, ow: img.naturalWidth, oh: img.naturalHeight };
}, { b64: src.toString("base64"), mime: MIME[extname(f).toLowerCase()], out: sortieMime,
     x: +X / 100, y: +Y / 100, l: +L / 100, h: +H / 100, larg: +larg, q: +q });
const buf = Buffer.from(r.url.split(",")[1], "base64");
writeFileSync(f, buf);
console.log(`${f} : ${r.ow}x${r.oh} ${(src.length/1024).toFixed(0)} Ko -> ${r.w}x${r.h} ${(buf.length/1024).toFixed(0)} Ko`);
await nav.close();

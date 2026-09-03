/**
 * Typographie francaise, appliquee au site rendu.
 *
 * Le francais met une espace devant le deux-points, le point-virgule, le
 * point d'exclamation, le point d'interrogation et le pourcentage — et cette
 * espace doit etre INSECABLE. Sans cela la ligne peut se couper juste avant
 * le signe, qui se retrouve seul en tete de ligne suivante. Le controle en a
 * compte 1 262 sur le site, plus 129 guillemets ouvrants detaches de ce
 * qu'ils ouvrent et 155 nombres separes de leur unite : « 1 200 m² » pouvait
 * se briser en trois morceaux sur trois lignes.
 *
 * Deux especes d'espaces, selon l'usage de l'Imprimerie nationale :
 *   — insecable pleine (U+00A0) devant le deux-points, autour des guillemets
 *     et entre un nombre et son unite ;
 *   — insecable fine (U+202F) devant ; ! ? % et dans les milliers.
 * Les trois familles du site portent bien la fine — mesuree, pas supposee :
 * environ la moitie de la pleine.
 *
 * Ce fichier ne touche QUE le texte. Il saute les balises, les attributs, le
 * contenu des <script> et <style>, et les blocs de donnees structurees : une
 * espace insecable glissee dans une URL ou dans du JSON-LD casserait ce
 * qu'elle pretend embellir.
 */
import { readdirSync, statSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const SAUTE = new Set([".git", "node_modules", "data", "UFC", "tools", "mcp", ".registre", ".research", ".pages", "fonts"]);

const INSEC = " ";

/* L'usage de l'Imprimerie nationale demande une espace FINE insecable
 * (U+202F) devant ; ! ? % et dans les milliers. Elle a ete essayee, puis
 * retiree en regardant l'ecran : a 17 px de corps elle mesure 1,9 px, et
 * « 1 200 m² » se lisait « 1200 m² ». Un nombre mal lu coute plus cher qu'une
 * espace un peu large. La regle fine vaut pour le papier, ou la resolution
 * la rend visible ; ici c'est l'insecable pleine partout. */
const FINE = INSEC;

/** Le texte d'un noeud, mis aux regles francaises. */
export function typographie(t) {
  return (
    t
      /* Retro-assertion plutot que capture : « 50 % ! » comporte deux
         signes a traiter, et une capture consomme le « % », si bien que le
         « ! » n'etait vu qu'au passage suivant. La fonction doit rendre le
         meme resultat qu'on l'applique une fois ou dix — le build la rejoue
         a chaque construction. */
      // Deux-points : espace insecable pleine.
      .replace(/(?<=[^\s  ])[ ]+:(?=\s|$)/g, `${INSEC}:`)
      // Point-virgule, exclamation, interrogation, pourcentage : fine.
      .replace(/(?<=[^\s  ])[ ]+(?=[;!?%])/g, FINE)
      // Guillemets francais : ils enserrent leur citation sans s'en detacher.
      .replace(/«[ ]+/g, `«${INSEC}`)
      .replace(/[ ]+»/g, `${INSEC}»`)
      // Un nombre ne se separe pas de son unite.
      .replace(/(\d)[ ]+(m²|m2|km|kg|cm|mm|€|h\b|min\b|kg\b)/g, `$1${INSEC}$2`)
      // Les milliers restent ensemble : « 1 200 » ne se coupe pas en « 1 ».
      .replace(/(\d)[ ](\d{3})(?!\d)/g, `$1${FINE}$2`)
  );
}

/**
 * Applique la regle aux seuls noeuds de texte d'un document.
 *
 * On avance de balise en balise : ce qui est entre deux balises est du texte,
 * ce qui est dans une balise ne se touche pas. Les elements dont le contenu
 * n'est pas de la prose sont sautes entierement.
 */
export function appliquer(html) {
  const OPAQUES = /^(script|style|code|pre|textarea)\b/i;
  let out = "";
  let i = 0;
  while (i < html.length) {
    const lt = html.indexOf("<", i);
    if (lt < 0) { out += typographie(html.slice(i)); break; }
    out += typographie(html.slice(i, lt));
    const gt = html.indexOf(">", lt);
    if (gt < 0) { out += html.slice(lt); break; }
    const balise = html.slice(lt, gt + 1);
    out += balise;
    i = gt + 1;
    const nom = balise.slice(1).match(/^[a-z0-9]+/i)?.[0] || "";
    if (OPAQUES.test(nom) && balise[1] !== "/") {
      const fin = html.toLowerCase().indexOf(`</${nom.toLowerCase()}`, i);
      if (fin > 0) { out += html.slice(i, fin); i = fin; }
    }
  }
  return out;
}

/* ---------------------------------------------------------------- passage */

if (import.meta.url === `file://${process.argv[1]}`) {
  const fichiers = [];
  (function marche(d) {
    for (const n of readdirSync(d)) {
      if (SAUTE.has(n)) continue;
      const f = join(d, n);
      statSync(f).isDirectory() ? marche(f) : n.endsWith(".html") && fichiers.push(f);
    }
  })(ROOT);

  let touches = 0, signes = 0;
  for (const f of fichiers) {
    const avant = readFileSync(f, "utf8");
    const apres = appliquer(avant);
    if (apres !== avant) {
      writeFileSync(f, apres, "utf8");
      touches++;
      for (let k = 0; k < apres.length; k++)
        if ((apres[k] === INSEC || apres[k] === FINE) && avant[k] !== apres[k]) signes++;
    }
  }
  console.log(`[typographie] ${touches} pages, espaces insecables posees`);
}

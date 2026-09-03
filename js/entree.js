/**
 * L'entree sur le site.
 *
 * Ce qui se passe pendant l'attente est une decision de design, pas un vide.
 * Mais un ecran de chargement est aussi la facon la plus sure de cacher un
 * site a ses visiteurs, alors il est construit sous trois contraintes qui ne
 * se negocient pas :
 *
 * 1. Il est cree par ce script, jamais present dans le HTML. JavaScript
 *    coupe, erreur, navigateur ancien : il n'existe pas et la page s'affiche
 *    normalement. Un preloader ecrit dans le document est un pari sur le fait
 *    que le script arrivera.
 *
 * 2. Il ne dure jamais plus de 1,1 s, quoi qu'il arrive. Pas d'attente
 *    d'images, pas d'attente de polices : un delai decoratif qui retarde la
 *    lecture est un defaut, pas une intention.
 *
 * 3. Une seule fois par session. Revenir sur l'accueil apres avoir lu trois
 *    articles ne doit pas rejouer une ceremonie.
 *
 * Le contenu, lui : le compte a rebours jusqu'a Bercy. C'est la seule
 * information que quelqu'un qui arrive ici veut avant tout le reste, et elle
 * justifie a elle seule le demi-instant qu'on lui prend.
 */
(function () {
  "use strict";

  if (!document.querySelector(".hero-cage")) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  try {
    if (sessionStorage.getItem("ufc-entree")) return;
    sessionStorage.setItem("ufc-entree", "1");
  } catch (e) {
    // Navigation privee, stockage refuse : on joue l'entree, sans memoire.
  }

  var EVENEMENT = new Date("2026-09-05T21:00:00+02:00").getTime();

  /* La meme regle que le compte a rebours du heros, au mot pres : les deux
     s'affichaient a une seconde d'intervalle et se contredisaient — « J−1 »
     ici, « 46h00 » juste apres. Au-dela de deux jours on parle en jours ;
     en deca, en heures et minutes, parce que c'est ce qui devient utile. */
  function reste() {
    var d = EVENEMENT - Date.now();
    if (d <= 0) return "EN COURS";
    var h = Math.floor(d / 36e5);
    if (h >= 48) return "J−" + Math.floor(h / 24);
    return h + "h" + String(Math.floor((d % 36e5) / 6e4)).padStart(2, "0");
  }

  var voile = document.createElement("div");
  voile.className = "entree";
  voile.setAttribute("aria-hidden", "true");
  voile.innerHTML =
    '<div class="entree-corps">' +
    '<span class="entree-marque">UFC.FR</span>' +
    '<span class="entree-compte">' + reste() + "</span>" +
    '<span class="entree-lieu">Accor Arena · 5 septembre</span>' +
    '<span class="entree-barre"><i></i></span>' +
    "</div>";

  document.documentElement.classList.add("entree-active");
  document.body.appendChild(voile);

  function lever() {
    document.documentElement.classList.remove("entree-active");
    voile.classList.add("partie");
    // On retire l'element du document apres sa sortie : le laisser en place
    // intercepterait les clics sur toute la page.
    window.setTimeout(function () { voile.remove(); }, 800);
  }

  // Le plus tot des deux : la page prete, ou la limite dure. Jamais l'inverse.
  var leve = false;
  function unefois() { if (!leve) { leve = true; lever(); } }
  window.setTimeout(unefois, 1100);
  if (document.readyState === "complete") window.setTimeout(unefois, 420);
  else window.addEventListener("load", function () { window.setTimeout(unefois, 320); });
})();

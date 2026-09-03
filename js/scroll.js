/**
 * Defilement lisse.
 *
 * Le choix technique, et c'est le seul qui compte ici : on ne translate pas
 * la page. Les bibliotheques qui donnent le defilement le plus soyeux
 * deplacent un conteneur en `transform`, ce qui casse tout `position: sticky`
 * — et ce site en depend, l'octogone de la carte de combats comme l'en-tete.
 * On interpole donc la position reelle et on appelle `scrollTo` : le
 * navigateur garde la main sur le collage, on ne fait qu'adoucir la course.
 *
 * Le tactile n'est pas touche. Le defilement natif d'un telephone a une
 * inertie que le systeme calcule mieux que nous, et la detourner est hostile.
 */
(function () {
  "use strict";

  var reduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var tactile = window.matchMedia("(pointer: coarse)").matches;
  if (reduit || tactile) return;

  var cible = window.scrollY;
  var courant = window.scrollY;
  var anime = false;

  // 0.11 : assez bas pour qu'on sente la course, assez haut pour que la page
  // ne traine pas derriere la molette. Au-dela de 0.15 l'effet disparait,
  // en dessous de 0.08 la page semble en retard sur la main.
  var LISSAGE = 0.11;

  function maxScroll() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function boucle() {
    var reste = cible - courant;
    // Sous un demi-pixel, on cale exactement : laisser tourner la boucle pour
    // des fractions de pixel consomme de la batterie sans rien donner a voir.
    if (Math.abs(reste) < 0.5) {
      courant = cible;
      window.scrollTo(0, courant);
      anime = false;
      return;
    }
    courant += reste * LISSAGE;
    window.scrollTo(0, courant);
    requestAnimationFrame(boucle);
  }

  function lancer() {
    if (anime) return;
    anime = true;
    requestAnimationFrame(boucle);
  }

  window.addEventListener(
    "wheel",
    function (e) {
      // Le zoom au pavé tactile et les gestes horizontaux gardent leur
      // comportement natif.
      if (e.ctrlKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      e.preventDefault();
      // deltaMode 1 = lignes (Firefox), 2 = pages. On ramene tout en pixels,
      // sinon la molette de Firefox deplace la page de trois pixels.
      var pas = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
      cible = Math.min(maxScroll(), Math.max(0, cible + pas));
      lancer();
    },
    { passive: false }
  );

  // Toute autre facon de defiler — barre, clavier, ancre, retour arriere —
  // resynchronise la cible : sans ca, le prochain cran de molette ramenerait
  // brutalement la page a l'endroit d'avant.
  window.addEventListener(
    "scroll",
    function () {
      if (!anime) { cible = window.scrollY; courant = window.scrollY; }
    },
    { passive: true }
  );

  window.addEventListener("resize", function () { cible = window.scrollY; courant = window.scrollY; }, { passive: true });

  // Les ancres internes glissent au lieu de sauter.
  document.addEventListener("click", function (e) {
    var lien = e.target.closest && e.target.closest('a[href^="#"]');
    if (!lien) return;
    var id = lien.getAttribute("href").slice(1);
    if (!id) return;
    var el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    var haut = el.getBoundingClientRect().top + window.scrollY;
    var marge = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    cible = Math.min(maxScroll(), Math.max(0, haut - marge));
    lancer();
  });
})();

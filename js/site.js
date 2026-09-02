/**
 * Comportements du site. Volontairement minimal et sans dépendance : ce
 * fichier s'exécute avant tout le reste et ne doit jamais être la raison
 * pour laquelle une page reste blanche.
 *
 * Note importante : il n'y a plus de bascule « motion-ready » ici. L'ancien
 * mécanisme masquait l'en-tête et le héros jusqu'à ce que le JavaScript
 * passe — donc indéfiniment si le CDN GSAP tombait ou si le JS était coupé.
 * Le contenu est visible par défaut ; l'animation l'enrichit, elle ne le
 * conditionne pas.
 */
(function () {
  "use strict";

  var burger = document.querySelector("[data-menu]");
  var drawer = document.querySelector("[data-drawer]");
  if (!burger || !drawer) return;

  var closeBtn = drawer.querySelector("[data-close]");
  var lastFocus = null;

  function open() {
    lastFocus = document.activeElement;
    drawer.hidden = false;
    // Laisse un cadre au navigateur pour appliquer `hidden` avant la
    // transition, sinon l'ouverture se fait sans animation.
    requestAnimationFrame(function () { drawer.classList.add("open"); });
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fermer le menu");
    document.documentElement.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    drawer.classList.remove("open");
    drawer.hidden = true;
    burger.setAttribute("aria-expanded", "false");
    burger.setAttribute("aria-label", "Ouvrir le menu");
    document.documentElement.style.overflow = "";
    if (lastFocus) lastFocus.focus();
  }

  burger.addEventListener("click", function () {
    drawer.hidden ? open() : close();
  });

  if (closeBtn) closeBtn.addEventListener("click", close);

  // Échap ferme : attendu par tout utilisateur clavier, absent jusqu'ici.
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !drawer.hidden) close();
  });

  drawer.addEventListener("click", function (e) {
    if (e.target.tagName === "A") close();
  });
})();

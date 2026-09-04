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
    // Deux cadres, pas un : le premier applique `hidden=false`, le second
    // laisse le navigateur calculer l'etat de depart avant de le quitter.
    // Avec un seul cadre, Chrome saute la transition une fois sur trois.
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { drawer.classList.add("open"); });
    });
    burger.setAttribute("aria-expanded", "true");
    burger.setAttribute("aria-label", "Fermer le menu");
    document.documentElement.style.overflow = "hidden";
    if (closeBtn) closeBtn.focus();
  }

  function close() {
    drawer.classList.remove("open");
    // On attend la fin de la fermeture avant de retirer l'element du flux :
    // le masquer immediatement escamote l'animation de sortie.
    var fin = function () { if (!drawer.classList.contains("open")) drawer.hidden = true; };
    drawer.addEventListener("transitionend", fin, { once: true });
    window.setTimeout(fin, 480);
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

/**
 * L'en-tete compacte.
 *
 * Sur les pages a fond sombre, l'en-tete est transparente en haut de page —
 * elle se pose sur le heros sans le couper. Des qu'on defile, elle doit
 * redevenir opaque, sinon le logo et la navigation flottent au-dessus du
 * contenu et deviennent illisibles. La classe existait dans la feuille de
 * style ; plus rien ne la posait depuis le retrait de l'ancien script.
 */
(function () {
  "use strict";
  var entete = document.querySelector("body > header");
  if (!entete) return;

  var seuil = 40;
  var attente = false;

  function majuscule() {
    attente = false;
    entete.classList.toggle("is-compact", window.scrollY > seuil);
  }

  window.addEventListener("scroll", function () {
    if (attente) return;
    attente = true;
    window.requestAnimationFrame(majuscule);
  }, { passive: true });

  majuscule();
})();

/**
 * Le lissage des ancres, et lui seul.
 *
 * La feuille de style portait `scroll-behavior: smooth` sur la racine. Cette
 * declaration ne connait pas la difference entre un lien d'ancre et la barre
 * d'espace : elle anime aussi les fleches du clavier, page suivante, et le
 * clic dans la barre de defilement. Un lecteur au clavier recevait donc une
 * interpolation imposee la ou il attendait un saut d'ecran net.
 *
 * Le lissage est desormais pose au clic, sur l'element vise, et nulle part
 * ailleurs. Il se tait si le lecteur a demande moins de mouvement, et il
 * laisse l'adresse changer pour que le lien reste partageable.
 */
(function () {
  "use strict";
  var doux = window.matchMedia && window.matchMedia("(prefers-reduced-motion: no-preference)");

  document.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href").slice(1);
    if (!id) return;
    var cible = document.getElementById(id) || document.getElementsByName(id)[0];
    if (!cible) return;
    e.preventDefault();
    cible.scrollIntoView({ behavior: doux && doux.matches ? "smooth" : "auto", block: "start" });
    // L'adresse doit suivre : sans cela le lien d'ancre n'est plus copiable,
    // et le bouton « precedent » ne revient pas au point de depart.
    if (history.pushState) history.pushState(null, "", "#" + id);
    // `scrollIntoView` ne donne pas le focus : un lecteur au clavier
    // continuerait de tabuler depuis le lien, pas depuis la cible.
    if (!cible.hasAttribute("tabindex")) cible.setAttribute("tabindex", "-1");
    cible.focus({ preventScroll: true });
  });
})();

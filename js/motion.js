/**
 * Système de révélation au scroll.
 *
 * Trois règles, et elles expliquent tout le fichier :
 *
 * 1. Le contenu est visible par défaut. L'opacité de départ n'est appliquée
 *    que si ce script s'exécute — d'où la classe posée sur <html> à la
 *    première ligne. JavaScript coupé, CDN mort, erreur : la page reste
 *    lisible. C'est l'inverse exact du bug qu'on vient de retirer.
 *
 * 2. Le mouvement informe, il ne décore pas. Un bloc monte de 14 px parce
 *    que la lecture descend ; une image se dé-zoome parce qu'elle se pose.
 *    Rien ne bouge latéralement sans raison, rien ne rebondit.
 *
 * 3. Zéro dépendance. GSAP coûtait deux requêtes CDN sur chaque page pour
 *    ce qu'IntersectionObserver fait en 40 lignes — et une page d'actualité
 *    lue en 4G n'a pas les moyens de ce luxe.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Sans observateur (très vieux navigateur) ou en mouvement réduit, on ne
  // pose jamais l'état masqué : la page s'affiche telle quelle.
  if (reduce || !("IntersectionObserver" in window)) return;

  root.classList.add("motion");

  var targets = document.querySelectorAll("[data-reveal]");
  if (!targets.length) return;

  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;

        // Le décalage se calcule par rapport aux frères déjà visibles, pas
        // par un index figé : un article a un nombre de blocs variable, et
        // une cascade codée en dur produirait des attentes de 2 secondes en
        // bas de page.
        var group = el.parentElement ? el.parentElement.children : [];
        var rank = 0;
        for (var i = 0; i < group.length && group[i] !== el; i++) {
          if (group[i].hasAttribute && group[i].hasAttribute("data-reveal")) rank++;
        }
        el.style.transitionDelay = Math.min(rank, 4) * 70 + "ms";
        el.classList.add("shown");
        io.unobserve(el);
      });
    },
    // On déclenche avant l'entrée réelle : le bloc doit finir son mouvement
    // au moment où l'œil arrive dessus, pas commencer à ce moment-là.
    { rootMargin: "0px 0px -12% 0px", threshold: 0.01 }
  );

  targets.forEach(function (el) { io.observe(el); });

  // Filet de sécurité : si un bloc n'a jamais été observé (onglet en arrière-plan
  // au chargement, rendu différé), il redevient visible au bout de 3 secondes.
  // Une page qui garde du texte invisible est cassée, quelle qu'en soit la raison.
  window.setTimeout(function () {
    document.querySelectorAll("[data-reveal]:not(.shown)").forEach(function (el) {
      el.classList.add("shown");
    });
  }, 3000);
})();

/**
 * Le compte a rebours du heros.
 *
 * Il est pose apres coup et non dans le HTML genere pour une raison simple :
 * une valeur calculee au build serait fausse des la minute suivante, et une
 * page mise en cache par Vercel afficherait un delai perime. Le serveur donne
 * la date, le navigateur donne l'heure.
 */
(function () {
  "use strict";
  var el = document.querySelector("[data-countdown]");
  if (!el) return;

  var cible = new Date(el.getAttribute("data-countdown")).getTime();
  if (isNaN(cible)) return;

  function ecrire() {
    var reste = cible - Date.now();
    if (reste <= 0) { el.textContent = "En cours"; return true; }
    var h = Math.floor(reste / 36e5);
    var j = Math.floor(h / 24);
    // Au-dela de deux jours on parle en jours : afficher « 71h » avant un
    // evenement dans trois jours est exact et illisible.
    el.textContent = j >= 2 ? "J−" + j : h + "h" + String(Math.floor((reste % 36e5) / 6e4)).padStart(2, "0");
    return false;
  }

  if (!ecrire()) window.setInterval(ecrire, 30000);
})();

/**
 * Les sept organisations : leur rubrique, leur sigle, leur pays, leur annee.
 *
 * Ces tables vivaient dans tools/emit.mjs. La page d'index des organisations
 * en a besoin aussi, et importer emit.mjs pour les lire relancait le rendu
 * des cent soixante-trois pages a chaque appel : un module de donnees ne doit
 * rien faire en etant charge. Deux listes de sept organisations qui divergent,
 * ce serait deux listes fausses — d'ou un seul endroit.
 */
/** Quelle rubrique alimente la grille de chaque page organisation. */
const ORG_CATEGORY = {
  "organisation-mma-ultimate-fighting-championship": "ufc",
  "organisation-mma-professional-fighters-league": "pfl",
  "organisation-mma-one-championship": "one-championship",
  "organisation-mma-cage-warriors": "cage-warriors",
  "organisation-mma-ares-fighting-championship": "ares",
  "organisation-hexagone-mma": "hexagone-mma",
  "organisation-mma-ksw": "ksw",
};

/**
 * L'ouverture d'une page organisation.
 *
 * Les sept pages partageaient un montage de banque d'images ou les sept
 * logotypes etaient colles cote a cote : sur la page KSW, le lecteur voyait
 * d'abord les logos de l'UFC, de ONE et de la PFL. Une image qui met en
 * avant les concurrents du sujet ne l'illustre pas, elle le noie.
 *
 * On n'a pas de photographie propre a chaque organisation, et les visuels
 * d'evenement ne se reprennent pas comme la photo qu'un club publie de sa
 * salle. Alors on ne fait pas semblant : l'ouverture devient typographique.
 * Le sigle est ce que le lecteur reconnait, et les trois reperes en dessous
 * sont ce que le site sait reellement — pays, annee, et ce qu'on en publie.
 */
/* `nom` est le nom complet, pas celui de la navigation : sur l'index, quatre
 * cartes sur sept affichaient « UFC / UFC », « PFL / PFL ». Le sigle est ce
 * qu'on reconnait ; le nom complet est ce qu'on apprend. */
const ORG_FICHE = {
  "organisation-mma-ultimate-fighting-championship": { sigle: "UFC", nom: "Ultimate Fighting Championship", pays: "États-Unis", depuis: "1993" },
  "organisation-mma-professional-fighters-league": { sigle: "PFL", nom: "Professional Fighters League", pays: "États-Unis", depuis: "2018" },
  "organisation-mma-one-championship": { sigle: "ONE", nom: "ONE Championship", pays: "Singapour", depuis: "2011" },
  "organisation-mma-cage-warriors": { sigle: "CW", nom: "Cage Warriors", pays: "Royaume-Uni", depuis: "2001" },
  "organisation-mma-ares-fighting-championship": { sigle: "ARES", nom: "ARES Fighting Championship", pays: "France", depuis: "2019" },
  "organisation-hexagone-mma": { sigle: "HEXAGONE", nom: "Hexagone MMA", pays: "France", depuis: "2020" },
  "organisation-mma-ksw": { sigle: "KSW", nom: "Konfrontacja Sztuk Walki", pays: "Pologne", depuis: "2004" },
};

export { ORG_CATEGORY, ORG_FICHE };

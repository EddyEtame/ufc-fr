# FAUTES — UFC.FR

Append-only. Une ligne par faute : `date | où | ce qui a cloché | cause racine | la règle maintenant`

2026-09-02 | audit du dépôt (3 passes) | Trois rapports d'état livrés en jugeant le site recodé sur lui-même, sans jamais ouvrir www.ufc.fr en ligne. La régression (7 pages organisation réduites à 1, mentions légales supprimées, 4 rubriques perdues) est restée invisible pendant trois tours. | Le plancher a été supposé au lieu d'être mesuré ; « je n'ai pas vu le site en ligne » a été signalé comme angle mort au lieu d'être résolu par un fetch qui coûtait un tour. | Avant tout audit ou toute refonte d'un site existant : ouvrir la version en ligne et en dresser l'inventaire AVANT de juger la nouvelle. Un angle mort qu'on peut lever soi-même n'est pas un angle mort, c'est une étape sautée. (REGLES 1)

2026-09-02 | calibrage du pourcentage | Deux rapports notés sur l'échelle 100→45, périmée depuis juillet 2026. | `baffled-bar` n'était pas synchronisé et le palier a été pris de mémoire au lieu d'être vérifié. | Ne jamais citer un calibrage de mémoire. Si la source de vérité n'est pas chargée, le dire et demander le fichier avant de donner un chiffre.

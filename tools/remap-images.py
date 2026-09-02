# -*- coding: utf-8 -*-
"""Remap each page to a verified MMA-coherent photo."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]

# (file, alt, credit)
CAP = {
    "arena-exterieur.jpg": ("Accor Arena, Paris", "Wikimedia Commons · CC BY 3.0"),
    "arena-paris.jpg": ("Accor Arena, Paris", "Wikimedia Commons · CC BY 3.0"),
    "octagon.jpg": ("Octogone UFC dans une arène comble", "Wikimedia Commons · CC BY 2.0"),
    "fight.jpg": ("Combat MMA dans l’octogone, production UFC", "Wikimedia Commons · domaine public"),
    "victoire.jpg": ("Remise de trophée en cage, gala MMA", "Road FC / Wikimedia Commons · CC BY-SA 4.0"),
    "grappling.jpg": ("Deux combattants en grappling dans la cage", "Unsplash"),
    "clinch.jpg": ("Clinch contre la cage, combat MMA", "Unsplash"),
    "gym.jpg": ("Entraînement au sac, salle de sports de combat", "Unsplash"),
    "gym-paris.jpg": ("Sacs de frappe, club de combat à Paris", "Unsplash · Temple Noble Art"),
    "gants.jpg": ("Combattant MMA en garde, gants ouverts", "Unsplash"),
    "combattant.jpg": ("Combattant au repos entre les cordes", "Unsplash"),
    "pesee.jpg": ("Pesée officielle UFC, Chuck Liddell", "Wikimedia Commons · CC BY 3.0"),
    "arkea.jpg": ("Arkéa Arena, Floirac près de Bordeaux", "Wikimedia Commons · CC BY-SA 4.0"),
    "ceinture.jpg": ("Ceinture de champion UFC", "Wikimedia Commons · CC BY 2.0"),
    "ceinture-combat.jpg": ("Champion UFC avec ceinture", "Wikimedia Commons · CC BY 2.0"),
    "cage.jpg": ("Combat MMA dans l’octogone, production UFC", "Wikimedia Commons · domaine public"),
}

def fig(prefix, name):
    alt, cred = CAP[name]
    return (
        f'<figure class="figure">\n'
        f'        <img src="{prefix}img/{name}" alt="{alt}" />\n'
        f'        <figcaption class="caption">Photo : {cred}'
        f' · <a href="{prefix}credits.html">Tous les crédits</a></figcaption>\n'
        f'      </figure>'
    )

ARTICLES = {
    "articles/ufc-paris-2026-presentation.html": "arena-exterieur.jpg",
    "articles/ufc-paris-2026-carte.html": "octagon.jpg",
    "articles/ufc-paris-2026-combattants-francais.html": "grappling.jpg",
    "articles/ufc-paris-historique.html": "arena-exterieur.jpg",
    "articles/salahdine-parnasse-debuts-ufc.html": "gants.jpg",
    "articles/analyse-hooker-parnasse.html": "grappling.jpg",
    "articles/ares-42-zebo-conserve-titre.html": "victoire.jpg",
    "articles/mma-cest-quoi.html": "gants.jpg",
    "articles/mma-france-guide.html": "arena-exterieur.jpg",
    "articles/gane-retour-entrainement.html": "gym.jpg",
    "articles/wood-santos-forfait.html": "fight.jpg",
    "articles/hexagone-44-tandia.html": "arkea.jpg",
    "articles/fernand-lopez-mma-factory.html": "gym-paris.jpg",
    "articles/hooker-citations.html": "combattant.jpg",
    "articles/ufc-paris-2026-pesee.html": "pesee.jpg",
    "articles/ufc-paris-2026-resultats.html": "fight.jpg",
    "articles/ufc-paris-2026-bilan-francais.html": "octagon.jpg",
    "clubs/cage-fight-toulouse.html": "gym.jpg",
    "clubs/mma-factory-paris.html": "gym-paris.jpg",
}

FIG_RE = re.compile(r'<figure class="figure">[\s\S]*?</figure>')


def replace_src(html, old, new, alt=None):
    html = html.replace(f'img/{old}', f'img/{new}')
    if alt:
        html = re.sub(r'(src="[^"]*' + re.escape(new) + r'"\s+alt=")[^"]*"', r'\1' + alt + '"', html)
    return html


def patch_figure(path: Path, name: str, prefix: str):
    html = path.read_text(encoding="utf-8")
    if FIG_RE.search(html):
        html = FIG_RE.sub(fig(prefix, name), html, count=1)
    path.write_text(html, encoding="utf-8")
    print("fig", path.name, name)


def main():
    for rel, name in ARTICLES.items():
        path = ROOT / rel
        prefix = "../"
        patch_figure(path, name, prefix)

    # root pages with a single figure
    root_figs = {
        "interviews.html": "combattant.jpg",
        "forum.html": "clinch.jpg",
        "a-propos.html": "arena-exterieur.jpg",
        "ufc-paris-2026-live.html": "octagon.jpg",
        "audit.html": "octagon.jpg",
        "redaction.html": "octagon.jpg",
        "seo-suivi.html": "octagon.jpg",
        "calendrier-editorial.html": "octagon.jpg",
    }
    for rel, name in root_figs.items():
        patch_figure(ROOT / rel, name, "")

    # index hero + cards
    p = ROOT / "index.html"
    h = p.read_text(encoding="utf-8")
    h = h.replace('src="img/octagon.jpg" alt=""', 'src="img/gants.jpg" alt=""', 1)  # fighter a
    h = h.replace('src="img/arena-paris.jpg" alt=""', 'src="img/arena-exterieur.jpg" alt=""', 1)
    h = h.replace('src="img/arena-paris.jpg" alt="Accor Arena, Paris"', 'src="img/arena-exterieur.jpg" alt="Accor Arena, Paris"')
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/gants.jpg" alt="Combattant MMA en garde"', 1)  # parnasse card
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/victoire.jpg" alt="Victoire en cage, gala MMA"', 1)  # ares
    h = h.replace('src="img/gym.jpg" alt=""', 'src="img/gym.jpg" alt=""')  # split already gym
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/octagon.jpg" alt="Octogone UFC, arène comble"', 1)  # mosaic carte
    h = h.replace('src="img/arena-paris.jpg" alt="Accor Arena, Paris"', 'src="img/grappling.jpg" alt="Grappling dans la cage"')
    h = h.replace('src="img/arena-exterieur.jpg" alt="Accor Arena, extérieur"', 'src="img/arena-exterieur.jpg" alt="Accor Arena, Paris"')
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/fight.jpg" alt="Combat MMA dans l’octogone"', 1)
    h = h.replace('src="img/ceinture-combat.jpg" alt="Combattant et ceinture"', 'src="img/gants.jpg" alt="Combattant MMA"')
    p.write_text(h, encoding="utf-8")
    print("index")

    # actualites
    p = ROOT / "actualites.html"
    h = p.read_text(encoding="utf-8")
    h = h.replace('src="img/arena-paris.jpg" alt="Accor Arena, Paris"', 'src="img/arena-exterieur.jpg" alt="Accor Arena, Paris"')
    # three featured: presentation, carte, parnasse
    h = h.replace(
        'src="img/octagon.jpg" alt="Cage octogonale de MMA"',
        'src="img/octagon.jpg" alt="Octogone UFC, arène comble"',
        1,
    )
    h = h.replace(
        'src="img/octagon.jpg" alt="Cage octogonale de MMA"',
        'src="img/gants.jpg" alt="Combattant MMA en garde"',
        1,
    )
    thumbs = [
        ("cage.jpg", "Cage de MMA", "fight.jpg", "Combat MMA dans l’octogone"),
        ("gym.jpg", "Salle d’entraînement", "gym.jpg", "Entraînement au sac de frappe"),
        ("cage.jpg", "Cage de MMA", "arkea.jpg", "Arkéa Arena, Bordeaux"),
        ("octagon.jpg", "Cage octogonale", "grappling.jpg", "Grappling dans la cage"),
        ("paris.jpg", "Paris", "arena-exterieur.jpg", "Accor Arena, Paris"),
        ("octagon.jpg", "Cage octogonale", "gants.jpg", "Gants MMA"),
        ("arena-exterieur.jpg", "Accor Arena", "arena-exterieur.jpg", "Accor Arena, Paris"),
        ("cage.jpg", "Cage de MMA", "victoire.jpg", "Victoire en cage, gala MMA"),
    ]
    for old, oldalt, new, newalt in thumbs:
        h = h.replace(
            f'<div class="thumb"><img src="img/{old}" alt="{oldalt}" /></div>',
            f'<div class="thumb"><img src="img/{new}" alt="{newalt}" /></div>',
            1,
        )
    p.write_text(h, encoding="utf-8")
    print("actualites")

    # clubs
    p = ROOT / "clubs.html"
    h = p.read_text(encoding="utf-8")
    # first gym Toulouse, second Paris factory
    h = h.replace(
        'src="img/gym.jpg" alt="Salle d’arts martiaux, Paris"',
        'src="img/gym-paris.jpg" alt="Salle de combat, Paris"',
        1,
    )
    p.write_text(h, encoding="utf-8")
    print("clubs")

    # ufc-paris hub cards
    p = ROOT / "ufc-paris-2026.html"
    h = p.read_text(encoding="utf-8")
    h = h.replace('src="img/arena-paris.jpg" alt="Accor Arena, Paris"', 'src="img/arena-exterieur.jpg" alt="Accor Arena, Paris"')
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/octagon.jpg" alt="Octogone UFC, arène comble"', 1)
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/grappling.jpg" alt="Grappling dans la cage"', 1)
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/fight.jpg" alt="Combat MMA dans l’octogone"')
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale"', 'src="img/pesee.jpg" alt="Pesée officielle UFC"', 1)
    h = h.replace('src="img/arena-paris.jpg" alt="Accor Arena, Paris"', 'src="img/octagon.jpg" alt="Octogone UFC, arène comble"')
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale"', 'src="img/grappling.jpg" alt="Combattants français, grappling"')
    p.write_text(h, encoding="utf-8")
    print("hub")

    # combattants
    p = ROOT / "combattants.html"
    h = p.read_text(encoding="utf-8")
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/gants.jpg" alt="Combattant MMA en garde"', 1)
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale de MMA"', 'src="img/grappling.jpg" alt="Grappling dans la cage"', 1)
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/fight.jpg" alt="Combat MMA dans l’octogone"', 1)
    h = h.replace('src="img/octagon.jpg" alt="Cage octogonale"', 'src="img/clinch.jpg" alt="Clinch contre la cage"', 1)
    h = h.replace('src="img/ceinture-combat.jpg" alt="Ceinture de champion"', 'src="img/ceinture-combat.jpg" alt="Champion UFC avec ceinture"')
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/victoire.jpg" alt="Victoire en cage"')
    p.write_text(h, encoding="utf-8")
    print("combattants")

    # organisations
    p = ROOT / "organisations.html"
    h = p.read_text(encoding="utf-8")
    reps = [
        ("octagon.jpg", "Cage octogonale de MMA", "octagon.jpg", "Octogone UFC, arène comble"),
        ("cage.jpg", "Cage de MMA", "victoire.jpg", "Gala MMA, remise de titre"),
        ("ceinture.jpg", "Ceinture de champion", "ceinture.jpg", "Ceinture de champion UFC"),
        ("ceinture-combat.jpg", "Combattant et ceinture", "gants.jpg", "Combattant MMA"),
        ("cage.jpg", "Cage de MMA, galas français", "arkea.jpg", "Arkéa Arena, galas français"),
        ("octagon.jpg", "Cage octogonale de MMA", "fight.jpg", "Combat MMA dans l’octogone"),
    ]
    for old, oldalt, new, newalt in reps:
        h = h.replace(
            f'src="img/{old}" alt="{oldalt}"',
            f'src="img/{new}" alt="{newalt}"',
            1,
        )
    p.write_text(h, encoding="utf-8")
    print("organisations")

    # analyses thumb
    p = ROOT / "analyses.html"
    h = p.read_text(encoding="utf-8")
    h = h.replace('src="img/cage.jpg" alt="Cage de MMA"', 'src="img/grappling.jpg" alt="Grappling, analyse de styles"')
    p.write_text(h, encoding="utf-8")

    # leftover broken refs
    for path in ROOT.rglob("*.html"):
        t = path.read_text(encoding="utf-8")
        n = t
        n = n.replace("img/paris.jpg", "img/arena-exterieur.jpg")
        n = n.replace("img/micro.jpg", "img/combattant.jpg")
        n = n.replace("img/clavier.jpg", "img/octagon.jpg")
        n = n.replace("img/cage.jpg", "img/fight.jpg")
        if n != t:
            path.write_text(n, encoding="utf-8")
            print("sanitize", path.relative_to(ROOT))

    print("done")


if __name__ == "__main__":
    main()

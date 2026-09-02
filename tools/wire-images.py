# -*- coding: utf-8 -*-
"""Wire Commons photos into section heroes, cards, and article figures."""
from pathlib import Path
import re
import shutil

ROOT = Path(__file__).resolve().parents[1]
IMG = ROOT / "img"

CREDITS = {
    "arena-paris.jpg": ("Vilacor", "CC BY 4.0", "Intérieur de l’Accor Arena, Paris"),
    "arena-exterieur.jpg": ("Wikimedia Commons", "CC BY 3.0", "Accor Arena, vue extérieure, Paris"),
    "octagon.jpg": ("U.S. Marine Corps", "domaine public", "Cage octogonale de MMA"),
    "cage.jpg": ("Matthew Tosh", "CC BY-SA 2.0", "Cage de MMA"),
    "ceinture.jpg": ("Grant Gould", "CC BY 2.0", "Ceinture de champion MMA"),
    "ceinture-combat.jpg": ("Wikimedia Commons", "CC BY 2.0", "Combattant avec ceinture de champion"),
    "gym.jpg": ("Eric Jones / Geograph", "CC BY-SA 2.0", "Salle de boxe et d’arts martiaux"),
    "clavier.jpg": ("Wikimedia Commons", "licence libre", "Clavier d’ordinateur, rédaction"),
    "paris.jpg": ("Wikimedia Commons", "CC BY-SA", "Tour Eiffel, Paris"),
    "micro.jpg": ("Wikimedia Commons", "licence libre", "Microphone de scène"),
    "tapis.jpg": ("Wikimedia Commons", "licence libre", "Tapis de lutte"),
}

ARTICLE_FIG = {
    "articles/ufc-paris-2026-presentation.html": ("arena-paris.jpg", "Accor Arena (Bercy), lieu de l’UFC Paris"),
    "articles/ufc-paris-2026-carte.html": ("octagon.jpg", "Cage octogonale de MMA"),
    "articles/ufc-paris-2026-combattants-francais.html": ("octagon.jpg", "Cage octogonale de MMA"),
    "articles/ufc-paris-historique.html": ("arena-exterieur.jpg", "Accor Arena, Paris"),
    "articles/salahdine-parnasse-debuts-ufc.html": ("octagon.jpg", "Cage octogonale de MMA"),
    "articles/analyse-hooker-parnasse.html": ("cage.jpg", "Cage de MMA"),
    "articles/ares-42-zebo-conserve-titre.html": ("cage.jpg", "Cage de MMA, gala"),
    "articles/mma-cest-quoi.html": ("octagon.jpg", "Cage octogonale, illustration pédagogique"),
    "articles/mma-france-guide.html": ("paris.jpg", "Paris, Tour Eiffel"),
    "articles/gane-retour-entrainement.html": ("gym.jpg", "Salle d’entraînement"),
    "articles/wood-santos-forfait.html": ("cage.jpg", "Cage de MMA"),
    "articles/hexagone-44-tandia.html": ("cage.jpg", "Cage de MMA, gala français"),
    "articles/fernand-lopez-mma-factory.html": ("gym.jpg", "Salle de boxe, illustration club"),
    "articles/hooker-citations.html": ("micro.jpg", "Microphone de conférence de presse"),
    "articles/ufc-paris-2026-pesee.html": ("octagon.jpg", "Cage octogonale, illustration pesée"),
    "articles/ufc-paris-2026-resultats.html": ("cage.jpg", "Cage de MMA, illustration résultats"),
    "articles/ufc-paris-2026-bilan-francais.html": ("arena-paris.jpg", "Accor Arena, Paris"),
    "clubs/cage-fight-toulouse.html": ("gym.jpg", "Salle d’arts martiaux, illustration club"),
    "clubs/mma-factory-paris.html": ("gym.jpg", "Salle d’arts martiaux, illustration club"),
}

HEROES = {
    "actualites.html": "ph-octagon",
    "resultats.html": "ph-cage",
    "evenements.html": "ph-arena",
    "ufc-paris-2026.html": "ph-arena",
    "ufc-paris-2026-live.html": "ph-arena2",
    "combattants.html": "ph-octagon",
    "organisations.html": "ph-belt",
    "clubs.html": "ph-gym",
    "champions.html": "ph-belt",
    "analyses.html": "ph-cage",
    "interviews.html": "ph-micro",
    "forum.html": "ph-cage",
    "a-propos.html": "ph-paris",
    "audit.html": "ph-keys",
    "redaction.html": "ph-keys",
    "seo-suivi.html": "ph-keys",
    "calendrier-editorial.html": "ph-keys",
}

MEDIA_RE = re.compile(
    r'<div class="media"[^>]*>\s*(?:<(?:div|span)[^>]*></(?:div|span)>\s*)+</div>'
)
THUMB_RE = re.compile(
    r'<div class="thumb">\s*(?:<(?:div|span)[^>]*(?:style="[^"]*")?[^>]*></(?:div|span)>\s*)+</div>'
)


def figure(prefix, file, alt):
    author, lic, _ = CREDITS[file]
    return (
        f'<figure class="figure">\n'
        f'        <img src="{prefix}img/{file}" alt="{alt}" />\n'
        f'        <figcaption class="caption">Photo : {author} · Wikimedia Commons · {lic}'
        f' · <a href="{prefix}credits.html">Tous les crédits</a></figcaption>\n'
        f'      </figure>'
    )


def media(prefix, file, alt, extras=""):
    return f'<div class="media">{extras}<img src="{prefix}img/{file}" alt="{alt}" /></div>'


def thumb(prefix, file, alt):
    return f'<div class="thumb"><img src="{prefix}img/{file}" alt="{alt}" /></div>'


def compress():
    src_micro = IMG / "micro2.jpg"
    dst_micro = IMG / "micro.jpg"
    if src_micro.exists() and not dst_micro.exists():
        shutil.copyfile(src_micro, dst_micro)
    elif src_micro.exists():
        shutil.copyfile(src_micro, dst_micro)

    try:
        from PIL import Image
    except ImportError:
        print("PIL missing, skip compress")
        return

    for name in IMG.glob("*.jpg"):
        im = Image.open(name)
        im = im.convert("RGB")
        w, h = im.size
        if w > 1600:
            nh = int(h * 1600 / w)
            im = im.resize((1600, nh), Image.Resampling.LANCZOS)
        tmp = name.with_suffix(".tmp.jpg")
        im.save(tmp, "JPEG", quality=78, optimize=True, progressive=True)
        tmp.replace(name)
        print(f"compressed {name.name} {name.stat().st_size}")


def replace_nth(text, pattern, repls):
    i = {"n": 0}

    def _sub(m):
        n = i["n"]
        i["n"] += 1
        if n < len(repls):
            return repls[n]
        return m.group(0)

    return pattern.sub(_sub, text)


def patch_heroes():
    for rel, cls in HEROES.items():
        path = ROOT / rel
        html = path.read_text(encoding="utf-8")
        html = html.replace('<div class="page-hero">', f'<div class="page-hero has-photo {cls}">', 1)
        path.write_text(html, encoding="utf-8")
        print("hero", rel)


def patch_articles():
    for rel, (file, alt) in ARTICLE_FIG.items():
        path = ROOT / rel
        html = path.read_text(encoding="utf-8")
        prefix = "../"
        fig = figure(prefix, file, alt)
        new, n = MEDIA_RE.subn(fig, html, count=1)
        if n != 1:
            print("WARN article media", rel, n)
        else:
            html = new
        html = html.replace('<span>© 2026</span>', '<span>© 2026 · <a href="../credits.html">Photos</a></span>', 1)
        path.write_text(html, encoding="utf-8")
        print("article", rel)


def patch_index():
    path = ROOT / "index.html"
    html = path.read_text(encoding="utf-8")
    html = html.replace(
        """    <div class="fighter a">
      <div class="sil"></div>""",
        """    <div class="fighter a">
      <img class="hero-photo" src="img/octagon.jpg" alt="" />
      <div class="sil"></div>""",
    )
    html = html.replace(
        """    <div class="fighter b">
      <div class="sil"></div>""",
        """    <div class="fighter b">
      <img class="hero-photo" src="img/arena-paris.jpg" alt="" />
      <div class="sil"></div>""",
    )
    html = html.replace(
        """          <div class="media">
            <div class="tone t1"></div>
            <div class="slash-art"></div>
            <span class="octa-mark octa"></span>
          </div>""",
        media("", "arena-paris.jpg", "Accor Arena, Paris",
              '<div class="slash-art"></div><span class="octa-mark octa"></span>'),
    )
    html = html.replace(
        '<div class="media"><div class="tone t2"></div></div>',
        media("", "octagon.jpg", "Cage octogonale de MMA"),
        1,
    )
    html = html.replace(
        '<div class="media"><div class="tone t3"></div></div>',
        media("", "cage.jpg", "Cage de MMA"),
        1,
    )
    html = html.replace(
        '        <div class="split-dark">\n          <div>',
        '        <div class="split-dark">\n          <img class="split-photo" src="img/gym.jpg" alt="" />\n          <div>',
    )
    html = html.replace(
        """        <a class="tile wide" href="articles/ufc-paris-2026-carte.html">
          <div class="tone t5" style="position:absolute;inset:0"></div>""",
        """        <a class="tile wide" href="articles/ufc-paris-2026-carte.html">
          <img src="img/octagon.jpg" alt="Cage octogonale de MMA" />""",
    )
    html = html.replace(
        """        <a class="tile" href="articles/ufc-paris-2026-combattants-francais.html">
          <div class="tone t2" style="position:absolute;inset:0"></div>""",
        """        <a class="tile" href="articles/ufc-paris-2026-combattants-francais.html">
          <img src="img/arena-paris.jpg" alt="Accor Arena, Paris" />""",
    )
    html = html.replace(
        """        <a class="tile" href="articles/ufc-paris-historique.html">
          <div class="tone t4" style="position:absolute;inset:0"></div>""",
        """        <a class="tile" href="articles/ufc-paris-historique.html">
          <img src="img/arena-exterieur.jpg" alt="Accor Arena, extérieur" />""",
    )
    html = html.replace(
        """        <a class="tile" href="articles/analyse-hooker-parnasse.html">
          <div class="tone t3" style="position:absolute;inset:0"></div>""",
        """        <a class="tile" href="articles/analyse-hooker-parnasse.html">
          <img src="img/cage.jpg" alt="Cage de MMA" />""",
    )
    html = html.replace(
        """        <a class="tile" href="champions.html">
          <div class="tone t1" style="position:absolute;inset:0"></div>""",
        """        <a class="tile" href="champions.html">
          <img src="img/ceinture.jpg" alt="Ceinture de champion MMA" />""",
    )
    html = html.replace(
        """        <a class="card" href="champions.html">
          <div class="card-body">""",
        """        <a class="card" href="champions.html">
          <div class="media"><img src="img/ceinture.jpg" alt="Ceinture de champion MMA" /></div>
          <div class="card-body">""",
        1,
    )
    html = html.replace(
        """        <a class="card" href="evenements.html">
          <div class="card-body">""",
        """        <a class="card" href="evenements.html">
          <div class="media"><img src="img/arena-exterieur.jpg" alt="Accor Arena, Paris" /></div>
          <div class="card-body">""",
        1,
    )
    html = html.replace(
        """        <a class="card" href="organisations.html">
          <div class="card-body">""",
        """        <a class="card" href="organisations.html">
          <div class="media"><img src="img/ceinture-combat.jpg" alt="Combattant et ceinture" /></div>
          <div class="card-body">""",
        1,
    )
    html = html.replace(
        '<span>© 2026</span>',
        '<span>© 2026 · <a href="credits.html">Photos</a></span>',
        1,
    )
    path.write_text(html, encoding="utf-8")
    print("index")


def patch_actualites():
    path = ROOT / "actualites.html"
    html = path.read_text(encoding="utf-8")
    html = MEDIA_RE.subn(
        media("", "arena-paris.jpg", "Accor Arena, Paris",
              '<div class="slash-art"></div><span class="octa-mark octa"></span>'),
        html, count=1,
    )[0]
    html = html.replace(
        '<div class="media"><div class="tone t5"></div></div>',
        media("", "octagon.jpg", "Cage octogonale de MMA"),
        1,
    )
    html = html.replace(
        '<div class="media"><div class="tone t2"></div></div>',
        media("", "octagon.jpg", "Cage octogonale de MMA"),
        1,
    )
    thumbs = [
        thumb("", "cage.jpg", "Cage de MMA"),
        thumb("", "gym.jpg", "Salle d’entraînement"),
        thumb("", "cage.jpg", "Cage de MMA"),
        thumb("", "octagon.jpg", "Cage octogonale"),
        thumb("", "paris.jpg", "Paris"),
        thumb("", "octagon.jpg", "Cage octogonale"),
        thumb("", "arena-exterieur.jpg", "Accor Arena"),
        thumb("", "cage.jpg", "Cage de MMA"),
    ]
    html = replace_nth(html, THUMB_RE, thumbs)
    html = html.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    path.write_text(html, encoding="utf-8")
    print("actualites", THUMB_RE.findall(path.read_text(encoding="utf-8"))[:1], "thumbs left geometric?", "tone t" in path.read_text(encoding="utf-8"))


def patch_listings():
    # ufc-paris-2026 hub
    p = ROOT / "ufc-paris-2026.html"
    h = p.read_text(encoding="utf-8")
    files = [
        ("arena-paris.jpg", "Accor Arena, Paris", '<div class="slash-art"></div>'),
        ("octagon.jpg", "Cage octogonale de MMA", ""),
        ("octagon.jpg", "Cage octogonale de MMA", ""),
    ]
    i = {"n": 0}

    def sub_media(m):
        n = i["n"]
        i["n"] += 1
        if n < len(files):
            f, alt, extra = files[n]
            return media("", f, alt, extra)
        return m.group(0)

    h = MEDIA_RE.sub(sub_media, h)
    h = h.replace(
        """        <a class="card" href="articles/ufc-paris-historique.html">
          <div class="card-body">""",
        """        <a class="card" href="articles/ufc-paris-historique.html">
          <div class="media"><img src="img/arena-exterieur.jpg" alt="Accor Arena, Paris" /></div>
          <div class="card-body">""",
        1,
    )
    h = h.replace(
        """        <a class="card" href="articles/analyse-hooker-parnasse.html">
          <div class="card-body">""",
        """        <a class="card" href="articles/analyse-hooker-parnasse.html">
          <div class="media"><img src="img/cage.jpg" alt="Cage de MMA" /></div>
          <div class="card-body">""",
        1,
    )
    h = h.replace(
        """        <a class="card" href="articles/ufc-paris-2026-pesee.html">
          <div class="card-body">""",
        """        <a class="card" href="articles/ufc-paris-2026-pesee.html">
          <div class="media"><img src="img/octagon.jpg" alt="Cage octogonale" /></div>
          <div class="card-body">""",
        1,
    )
    h = h.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    p.write_text(h, encoding="utf-8")
    print("ufc-paris-2026")

    # clubs
    p = ROOT / "clubs.html"
    h = p.read_text(encoding="utf-8")
    club_media = [
        media("", "gym.jpg", "Salle d’arts martiaux", '<div class="slash-art"></div>'),
        media("", "gym.jpg", "Salle d’arts martiaux, Paris", '<div class="slash-art"></div>'),
    ]
    h = replace_nth(h, MEDIA_RE, club_media)
    h = h.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    p.write_text(h, encoding="utf-8")
    print("clubs")

    # combattants
    p = ROOT / "combattants.html"
    h = p.read_text(encoding="utf-8")
    cm = [
        media("", "octagon.jpg", "Cage octogonale de MMA", '<div class="slash-art"></div>'),
        media("", "octagon.jpg", "Cage octogonale de MMA"),
        media("", "cage.jpg", "Cage de MMA"),
    ]
    h = replace_nth(h, MEDIA_RE, cm)
    h = h.replace(
        """        <a class="card" href="articles/ufc-paris-2026-combattants-francais.html">
          <div class="card-body">""",
        """        <a class="card" href="articles/ufc-paris-2026-combattants-francais.html">
          <div class="media"><img src="img/octagon.jpg" alt="Cage octogonale" /></div>
          <div class="card-body">""",
        1,
    )
    h = h.replace(
        """        <a class="card" href="champions.html">
          <div class="card-body">""",
        """        <a class="card" href="champions.html">
          <div class="media"><img src="img/ceinture-combat.jpg" alt="Ceinture de champion" /></div>
          <div class="card-body">""",
        1,
    )
    h = replace_nth(h, THUMB_RE, [thumb("", "cage.jpg", "Cage de MMA")])
    h = h.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    p.write_text(h, encoding="utf-8")
    print("combattants")

    # analyses
    p = ROOT / "analyses.html"
    h = p.read_text(encoding="utf-8")
    h = replace_nth(h, THUMB_RE, [thumb("", "cage.jpg", "Cage de MMA")])
    h = h.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    p.write_text(h, encoding="utf-8")
    print("analyses")

    # organisations — add photos on first two cards via inserting after <div class="card">
    p = ROOT / "organisations.html"
    h = p.read_text(encoding="utf-8")
    inserts = [
        ('        <div class="card">\n          <div class="card-body">',
         '        <div class="card">\n          <div class="media"><img src="img/octagon.jpg" alt="Cage octogonale de MMA" /></div>\n          <div class="card-body">'),
        ('        <div class="card">\n          <div class="card-body">',
         '        <div class="card">\n          <div class="media"><img src="img/cage.jpg" alt="Cage de MMA" /></div>\n          <div class="card-body">'),
        ('        <div class="card">\n          <div class="card-body">',
         '        <div class="card">\n          <div class="media"><img src="img/ceinture.jpg" alt="Ceinture de champion" /></div>\n          <div class="card-body">'),
        ('        <div class="card">\n          <div class="card-body">',
         '        <div class="card">\n          <div class="media"><img src="img/ceinture-combat.jpg" alt="Combattant et ceinture" /></div>\n          <div class="card-body">'),
    ]
    for old, new in inserts:
        h = h.replace(old, new, 1)
    h = h.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
    p.write_text(h, encoding="utf-8")
    print("organisations")


def patch_legal_root():
    skip = {
        "index.html", "actualites.html", "ufc-paris-2026.html", "clubs.html",
        "combattants.html", "analyses.html", "organisations.html", "credits.html",
        "tools/template-article.html",
    }
    for path in ROOT.rglob("*.html"):
        rel = path.relative_to(ROOT).as_posix()
        if rel in skip or rel.startswith("articles/") or rel.startswith("clubs/"):
            continue
        html = path.read_text(encoding="utf-8")
        if "credits.html" in html and "© 2026 ·" in html:
            continue
        if '<span>© 2026</span>' in html:
            html = html.replace('<span>© 2026</span>', '<span>© 2026 · <a href="credits.html">Photos</a></span>', 1)
            path.write_text(html, encoding="utf-8")
            print("legal", rel)


def extra_figures():
    extras = {
        "interviews.html": ("micro.jpg", "Microphone de scène, illustration interviews"),
        "forum.html": ("cage.jpg", "Cage de MMA, illustration communauté"),
        "a-propos.html": ("paris.jpg", "Paris, Tour Eiffel"),
        "evenements.html": ("arena-exterieur.jpg", "Accor Arena, Paris"),
        "resultats.html": ("cage.jpg", "Cage de MMA"),
        "champions.html": ("ceinture.jpg", "Ceinture de champion MMA"),
        "ufc-paris-2026-live.html": ("arena-paris.jpg", "Accor Arena, Paris"),
        "audit.html": ("clavier.jpg", "Clavier, illustration rédaction"),
        "redaction.html": ("clavier.jpg", "Clavier, illustration rédaction"),
        "seo-suivi.html": ("clavier.jpg", "Clavier, illustration suivi éditorial"),
        "calendrier-editorial.html": ("clavier.jpg", "Clavier, illustration calendrier"),
    }
    for rel, (file, alt) in extras.items():
        path = ROOT / rel
        html = path.read_text(encoding="utf-8")
        fig = figure("", file, alt)
        marker = '<p class="crumbs">'
        if marker in html and 'class="figure"' not in html:
            html = html.replace(marker, fig + "\n      " + marker, 1)
        elif '<section class="block">' in html and 'class="figure"' not in html:
            html = html.replace(
                '<section class="block">',
                f'<section class="block">\n    <div class="wrap">{fig}</div>\n',
                1,
            )
        path.write_text(html, encoding="utf-8")
        print("figure", rel)


def main():
    compress()
    patch_heroes()
    patch_index()
    patch_actualites()
    patch_listings()
    patch_articles()
    extra_figures()
    patch_legal_root()
    print("done")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
import re
from pathlib import Path

DIR = Path(__file__).resolve().parent

ITEMS = [
    {
        "file": "01-ufc-paris-2026-presentation.html",
        "title": "UFC Paris 2026 : date, lieu, carte et enjeux a l Accor Arena",
        "slug": "ufc-paris-2026-date-lieu-carte-enjeux",
        "type": "post",
        "yoast_title": "UFC Paris 2026 : date, Accor Arena et carte des combats | UFC.FR",
        "yoast_desc": "UFC Fight Night Hooker vs Parnasse le 5 septembre 2026 a l Accor Arena. Date, lieu, carte, Francais au programme.",
        "cats": ["Actualite", "UFC", "UFC Paris 2026"],
    },
    {
        "file": "02-ufc-paris-2026-carte.html",
        "title": "UFC Paris 2026 : la carte complete Hooker vs Parnasse",
        "slug": "ufc-paris-2026-carte-complete-hooker-parnasse",
        "type": "post",
        "yoast_title": "Carte UFC Paris 2026 : Hooker vs Parnasse, ordre des combats | UFC.FR",
        "yoast_desc": "Carte complete de l UFC Paris 2026 a l Accor Arena : Hooker vs Parnasse, Ziam vs Sola, ordre des combats.",
        "cats": ["Actualite", "UFC", "UFC Paris 2026"],
    },
    {
        "file": "03-ufc-paris-combattants-francais.html",
        "title": "UFC Paris 2026 : les 8 combattants francais a suivre",
        "slug": "ufc-paris-2026-combattants-francais",
        "type": "post",
        "yoast_title": "Combattants francais UFC Paris 2026 : Parnasse, Ziam, Sola | UFC.FR",
        "yoast_desc": "Huit Francais a l UFC Paris 2026 : Parnasse, Ziam, Sola, Charriere, Sy, Cornolle, Duclos, Aljarouj, Benouaich.",
        "cats": ["Actualite", "UFC", "UFC Paris 2026"],
    },
    {
        "file": "04-cage-fight-toulouse.html",
        "title": "Cage Fight Toulouse : le club 100 pourcent MMA de reference en Occitanie",
        "slug": "cage-fight-toulouse-club-mma",
        "type": "post",
        "yoast_title": "Cage Fight Toulouse : club MMA, coachs, salles et galas | UFC.FR",
        "yoast_desc": "Portrait du club Cage Fight Toulouse : salles, cage FMMAF, coachs Jerome, Tancrede et Yannis.",
        "cats": ["Clubs de MMA francais", "Actualite"],
    },
    {
        "file": "05-page-champions-actuels.html",
        "title": "Champions MMA actuels : UFC, PFL, ONE, KSW, Hexagone, ARES",
        "slug": "champions-mma-actuels",
        "type": "page",
        "yoast_title": "Champions MMA actuels 2026 : UFC, PFL, ONE, KSW | UFC.FR",
        "yoast_desc": "Liste des champions MMA a jour au 31 aout 2026 : UFC, PFL, ONE, KSW, Hexagone MMA et ARES FC.",
        "cats": [],
    },
    {
        "file": "06-page-clubs-mma-francais.html",
        "title": "Les clubs de MMA francais",
        "slug": "clubs-mma-francais",
        "type": "page",
        "yoast_title": "Clubs de MMA francais : cartes, portraits, Toulouse | UFC.FR",
        "yoast_desc": "Rubrique clubs de MMA en France. Premier portrait : Cage Fight Toulouse.",
        "cats": [],
    },
]


def slugify(name: str) -> str:
    s = name.lower()
    for a, b in (("é", "e"), ("è", "e"), ("ê", "e"), ("à", "a"), ("ù", "u"), ("ç", "c")):
        s = s.replace(a, b)
    return re.sub(r"[^a-z0-9]+", "-", s).strip("-")


def strip_comments(html: str) -> str:
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


parts = [
    '<?xml version="1.0" encoding="UTF-8" ?>',
    '<rss version="2.0"',
    '  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"',
    '  xmlns:content="http://purl.org/rss/1.0/modules/content/"',
    '  xmlns:wfw="http://wellformedweb.org/CommentAPI/"',
    '  xmlns:dc="http://purl.org/dc/elements/1.1/"',
    '  xmlns:wp="http://wordpress.org/export/1.2/">',
    "<channel>",
    "<title>UFC.FR</title>",
    "<link>https://www.ufc.fr</link>",
    "<description>Import brouillons COM 31 aout 2026</description>",
    "<language>fr-FR</language>",
    "<wp:wxr_version>1.2</wp:wxr_version>",
    "<wp:base_site_url>https://www.ufc.fr</wp:base_site_url>",
    "<wp:base_blog_url>https://www.ufc.fr</wp:base_blog_url>",
]

pid = 90001
for it in ITEMS:
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    m = re.search(r"Titre:\s*(.+)", raw)
    if m:
        it["title"] = m.group(1).strip()
    html = strip_comments(raw)
    cats_xml = "".join(
        f'<category domain="category" nicename="{slugify(c)}"><![CDATA[{c}]]></category>\n'
        for c in it["cats"]
    )
    parts.append(
        f"""<item>
<title><![CDATA[{it["title"]}]]></title>
<link>https://www.ufc.fr/{it["slug"]}/</link>
<dc:creator><![CDATA[admin]]></dc:creator>
<guid isPermaLink="false">https://www.ufc.fr/?p={pid}</guid>
<description></description>
<content:encoded><![CDATA[{html}]]></content:encoded>
<excerpt:encoded><![CDATA[]]></excerpt:encoded>
<wp:post_id>{pid}</wp:post_id>
<wp:post_date>2026-08-31 14:00:00</wp:post_date>
<wp:post_date_gmt>2026-08-31 12:00:00</wp:post_date_gmt>
<wp:comment_status>open</wp:comment_status>
<wp:ping_status>closed</wp:ping_status>
<wp:post_name>{it["slug"]}</wp:post_name>
<wp:status>draft</wp:status>
<wp:post_parent>0</wp:post_parent>
<wp:menu_order>0</wp:menu_order>
<wp:post_type>{it["type"]}</wp:post_type>
<wp:post_password></wp:post_password>
<wp:is_sticky>0</wp:is_sticky>
{cats_xml}<wp:postmeta>
<wp:meta_key>_yoast_wpseo_title</wp:meta_key>
<wp:meta_value><![CDATA[{it["yoast_title"]}]]></wp:meta_value>
</wp:postmeta>
<wp:postmeta>
<wp:meta_key>_yoast_wpseo_metadesc</wp:meta_key>
<wp:meta_value><![CDATA[{it["yoast_desc"]}]]></wp:meta_value>
</wp:postmeta>
</item>"""
    )
    pid += 1

parts.append("</channel>")
parts.append("</rss>")

out = DIR / "ufc-fr-import-brouillons-2026-08-31.xml"
out.write_text("\n".join(parts), encoding="utf-8")
print(f"Wrote {out} ({out.stat().st_size} bytes)")

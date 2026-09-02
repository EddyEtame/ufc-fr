# -*- coding: utf-8 -*-
"""Portraits rewrite, new clubs, homepage bg, SEO/tech private pages, veille."""
import json
import os
import re
import ssl
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

USER = "bc.combat31@gmail.com"
PASS = os.environ["WP_APP_PASS"]
DIR = Path(r"c:\Users\PC\Desktop\UFC\contenus-a-publier")
REST = "https://www.ufc.fr/wp-json/wp/v2"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"
ACCOR, OCTAGON, PLMMA = 4852, 4853, 4854

PORTRAIT_PAIRS = {
    2295: [
        (
            "Polyvalent, controversé et génial, John Jones incarne la domination absolue en MMA, toutes générations confondues.",
            "Polyvalent, controversé et génial, John Jones a incarné une domination rare sur deux époques. En 2026, il n’est plus champion UFC des lourds (Tom Aspinall, intérim Ciryl Gane).",
        ),
        (
            "Jones règne sur la catégorie des mi-lourds pendant plus d’une décennie.",
            "Jones a régné sur la catégorie des mi-lourds pendant plus d’une décennie.",
        ),
        (
            "il soumet le Français et s’adjuge une nouvelle ceinture.",
            "il soumettait Ciryl Gane et s’adjugeait la ceinture des lourds. Ce titre n’est plus le sien en 2026.",
        ),
        (
            "John Jones est considéré par beaucoup comme le Greatest of All Time (GOAT) du MMA. Peu de combattants peuvent se targuer d’avoir dominé deux divisions majeures, sur deux époques différentes.",
            "John Jones est encore considéré par beaucoup comme le GOAT du MMA — palmarès et longévité, pas la ceinture 2026. Peu de combattants ont dominé deux divisions majeures, sur deux époques. Fiche historique, pas une page « champion en titre ».",
        ),
    ],
    3172: [
        ("Belal Muhammad, l’endurance et la constance au sommet des welters", "Belal Muhammad, ancien champion des welters UFC"),
        ("Un champion à la fois humble et exemplaire", "Un ancien champion, humble, désormais hors du trône"),
        (
            "Respecté pour sa rigueur et sa ténacité, Belal Muhammad a conquis l’UFC grâce à une montée patiente et méthodique.",
            "Respecté pour sa rigueur et sa ténacité, Belal Muhammad a été champion UFC des welters. En 2026, la ceinture est à Islam Makhachev. Cette fiche décrit le parcours, pas le titulaire actuel.",
        ),
    ],
    3144: [
        ("Ilia Topuria, invaincu et champion explosif des poids plumes", "Ilia Topuria, ex-champion des plumes, désormais chez les légers"),
        (
            "Phénomène du MMA européen, Ilia Topuria règne sur les poids plumes et vise désormais un second titre en lightweight.",
            "Phénomène du MMA européen, Ilia Topuria a été champion des plumes. Plus invaincu : défaite contre Justin Gaethje (juin 2026). Champion plumes actuel : Alexander Volkanovski. Topuria est n°1 Meta des légers (août 2026).",
        ),
        ("L’avenir du MMA européen", "Après Gaethje : le dossier légers, plus le roman de l’invincibilité"),
        (
            "Fort de son palmarès immaculé, Topuria vise désormais un nouveau défi : conquérir la catégorie lightweight pour devenir double champion.",
            "Le palmarès n’est plus immaculé. Le dossier 2026, c’est le haut du classement des légers, pas une ceinture plumes à défendre.",
        ),
    ],
    3386: [
        (
            "Alexandre Pantoja s’est imposé comme champion des poids mouches grâce à sa ténacité, son expérience et un jiu-jitsu redoutable.",
            "Alexandre Pantoja a été champion UFC des poids mouches. En 2026, la ceinture est à Joshua Van. Cette fiche reste un portrait de parcours, pas une page titre.",
        ),
    ],
    2275: [
        ("Dricus Du Plessis, champion UFC des poids moyens", "Dricus Du Plessis, ex-champion UFC des poids moyens"),
        (
            "Puissant, patriote et invaincu à l’UFC, Du Plessis incarne la nouvelle ère du MMA africain.",
            "Puissant et patriote, Du Plessis a été champion UFC des moyens. En 2026, Sean Strickland détient la ceinture ; Du Plessis est n°2 Meta. Plus une fiche « champion en titre ».",
        ),
        (
            "À l’issue des cinq rounds, c’est Du Plessis qui lève les bras, devenant le nouveau champion ",
            "À l’issue des cinq rounds, Du Plessis levait les bras et devenait champion — titre ensuite perdu. ",
        ),
    ],
    3092: [
        (
            "Calme, précis et discipliné, Ankalaev domine la catégorie mi-lourds avec une rigueur digne des plus grands du Daghestan.",
            "Calme et discipliné, Ankalaev a été champion UFC des mi-lourds. En 2026, Carlos Ulberg détient la ceinture ; Ankalaev est n°2 Meta.",
        ),
        (
            "devenant champion des mi-lourds de l’UFC.",
            "devenant champion des mi-lourds de l’UFC — ceinture qu’il n’a plus en août 2026.",
        ),
    ],
    3289: [
        (
            "Elle reste l’une des combattantes les p",
            "Elle n’est plus championne en 2026 (Kayla Harrison). Elle reste l’une des combattantes les p",
        ),
    ],
    3123: [
        ("Zhang Weili, reine des poids pailles à l’UFC", "Zhang Weili, ex-championne des poids pailles UFC"),
        (
            "Première championne chinoise de l’UFC, Zhang Weili incarne la puissance, la vitesse et l’ascension du MMA féminin en Asie.",
            "Première championne chinoise de l’UFC, Zhang Weili a régné sur les pailles. En 2026, Mackenzie Dern détient la ceinture. Portrait historique.",
        ),
        ("Une figure historique pour le MMA asiatique", "Une figure historique — plus la détentrice 2026"),
        (
            "puis défend sa ceinture avec autorité face à Amanda Lemos, Yan Xiaonan et Tatiana Suarez.",
            "puis a défendu sa ceinture face à Amanda Lemos, Yan Xiaonan et Tatiana Suarez — avant de la perdre (Dern championne en 2026).",
        ),
    ],
    3337: [
        (
            "Infatigable, Merab Dvalishvili a conquis la ceinture des poids coqs grâce à une pression constante et un cardio d’acier.",
            "Infatigable, Merab Dvalishvili a conquis puis perdu la ceinture des poids coqs. Champion 2026 : Petr Yan. Merab est n°1 Meta (août 2026).",
        ),
    ],
}

EXCERPTS = {
    2295: "Fiche historique : Jon Jones n’est plus champion UFC des lourds (Aspinall / intérim Gane). Parcours mi-lourds puis lourds.",
    3172: "Belal Muhammad n’est plus champion UFC des welters. Champion actuel : Islam Makhachev. Portrait de parcours.",
    3144: "Ilia Topuria n’est plus champion des plumes ni invaincu (défaite vs Gaethje). N°1 Meta des légers, août 2026.",
    3386: "Alexandre Pantoja n’est plus champion des mouches. Champion actuel : Joshua Van.",
    2275: "Dricus du Plessis n’est plus champion des moyens. Champion actuel : Sean Strickland. Du Plessis n°2 Meta.",
    3092: "Magomed Ankalaev n’est plus champion des mi-lourds. Champion actuel : Carlos Ulberg.",
    3289: "Julianna Peña n’est plus championne des coqs. Championne actuelle : Kayla Harrison.",
    3123: "Zhang Weili n’est plus championne des pailles. Championne actuelle : Mackenzie Dern.",
    3337: "Merab Dvalishvili n’est plus champion des coqs. Champion actuel : Petr Yan. Merab n°1 Meta.",
}


def token():
    import base64

    return base64.b64encode(f"{USER}:{PASS}".encode()).decode()


def headers():
    return {
        "Authorization": f"Basic {token()}",
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def req(method, url, data=None, timeout=90):
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=headers(), method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            if raw.lstrip()[:1] in "[{":
                return json.loads(raw)
            return raw
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {e.code}\n{err[:2500]}") from e


def strip_comments(html):
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


def meta_from_comment(html, key):
    m = re.search(rf"{re.escape(key)}:\s*(.+)", html)
    return m.group(1).strip() if m else ""


def find_by_slug(kind, slug):
    q = urllib.parse.urlencode({"slug": slug, "per_page": 5, "status": "any"})
    data = req("GET", f"{REST}/{kind}?{q}")
    return data[0] if data else None


def upsert(kind, payload, slug):
    existing = find_by_slug(kind, slug)
    if existing:
        out = req("POST", f"{REST}/{kind}/{existing['id']}", payload)
        print(f"updated {kind} {slug} {out.get('link')}")
        return out
    out = req("POST", f"{REST}/{kind}", payload)
    print(f"created {kind} {slug} {out.get('link')}")
    return out


def apply_pairs(obj, pairs):
    n = 0
    if isinstance(obj, list):
        for x in obj:
            n += apply_pairs(x, pairs)
    elif isinstance(obj, dict):
        s = obj.get("settings") or {}
        for k in ("editor", "title"):
            if isinstance(s.get(k), str):
                for old, new in pairs:
                    if old in s[k]:
                        s[k] = s[k].replace(old, new)
                        n += 1
        n += apply_pairs(obj.get("elements") or [], pairs)
    return n


def patch_portraits():
    for pid, pairs in PORTRAIT_PAIRS.items():
        p = req("GET", f"{REST}/posts/{pid}?context=edit")
        ed = (p.get("meta") or {}).get("_elementor_data")
        if not isinstance(ed, str) or not ed:
            print(f"skip {pid} no elementor")
            continue
        tree = json.loads(ed)
        n = apply_pairs(tree, pairs)
        payload = {
            "excerpt": EXCERPTS.get(pid, ""),
            "meta": {
                "_elementor_data": json.dumps(tree, ensure_ascii=False, separators=(",", ":")),
                "_elementor_edit_mode": "builder",
            },
        }
        yoast = (p.get("meta") or {}).get("_yoast_wpseo_title") or ""
        if "Champion" in yoast or "champion" in yoast:
            payload["meta"]["_yoast_wpseo_title"] = yoast.replace("Champion", "Portrait").replace("champion", "portrait")
        req("POST", f"{REST}/posts/{pid}", payload)
        print(f"portrait {pid} replacements={n}")


def patch_homepage_bg():
    page = req("GET", f"{REST}/pages/30?context=edit")
    data = (page.get("meta") or {}).get("_elementor_data")
    if not isinstance(data, str):
        print("homepage no elementor string")
        return
    old_url = "https:\\/\\/www.ufc.fr\\/wp-content\\/uploads\\/2025\\/04\\/ufc-fr-mma-en-direct-sans-filtre.webp"
    new_url = "https:\\/\\/www.ufc.fr\\/wp-content\\/uploads\\/2026\\/08\\/accor-arena-bercy-scaled.jpg"
    n1 = data.count("ufc-fr-mma-en-direct-sans-filtre")
    n2 = data.count('"id":1035')
    data2 = data.replace(old_url, new_url)
    data2 = data2.replace('"id":1035', '"id":4852')
    data2 = data2.replace('"id": 1035', '"id": 4852')
    if data2 == data:
        print("WARN homepage bg unchanged", "old_hits", n1, "id1035", n2)
        # try unescaped
        data2 = data.replace(
            "https://www.ufc.fr/wp-content/uploads/2025/04/ufc-fr-mma-en-direct-sans-filtre.webp",
            "https://www.ufc.fr/wp-content/uploads/2026/08/accor-arena-bercy-scaled.jpg",
        )
        data2 = data2.replace('"id":1035', '"id":4852')
    if data2 == data:
        print("homepage still unchanged")
        return
    req(
        "POST",
        f"{REST}/pages/30",
        {"meta": {"_elementor_data": data2, "_elementor_edit_mode": "builder"}},
    )
    print(f"homepage bg replaced hits_old={n1}")


def figure(media_id):
    urls = {
        ACCOR: (
            "https://www.ufc.fr/wp-content/uploads/2026/08/accor-arena-bercy-scaled.jpg",
            "Façade de l’Accor Arena, lieu de l’UFC Paris",
            "Accor Arena, Paris. Photo Vilacor, Wikimedia Commons, licence CC BY 4.0.",
        ),
        OCTAGON: (
            "https://www.ufc.fr/wp-content/uploads/2026/08/ufc-octagon-usmc-scaled.jpg",
            "Cage octogonale de MMA",
            "Cage octogonale de MMA. Photo U.S. Marine Corps, domaine public (Wikimedia Commons).",
        ),
        PLMMA: (
            "https://www.ufc.fr/wp-content/uploads/2026/08/plmma-cage-mma-scaled.jpg",
            "Cage MMA en salle",
            "Cage MMA en salle (PLMMA, Pologne). Photo Tyka17, Wikimedia Commons, licence CC BY-SA 4.0.",
        ),
    }
    src, alt, cap = urls[media_id]
    return f'<figure><img src="{src}" alt="{alt}" /><figcaption>{cap}</figcaption></figure>\n'


def publish_file(it, cats):
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    content = strip_comments(raw)
    feat = it.get("feat")
    if feat:
        content = figure(feat) + content
    payload = {
        "title": meta_from_comment(raw, "Titre"),
        "slug": meta_from_comment(raw, "Slug"),
        "status": it.get("status", "publish"),
        "content": content,
        "comment_status": "open",
    }
    if it.get("cats"):
        payload["categories"] = [cats[c] for c in it["cats"] if c in cats]
    if feat:
        payload["featured_media"] = feat
    yt, yd = meta_from_comment(raw, "Yoast title"), meta_from_comment(raw, "Yoast meta")
    if yt or yd:
        payload["meta"] = {}
        if yt:
            payload["meta"]["_yoast_wpseo_title"] = yt
        if yd:
            payload["meta"]["_yoast_wpseo_metadesc"] = yd
    return upsert(it["kind"], payload, payload["slug"])


def http_headers(url):
    r = urllib.request.Request(url, method="HEAD", headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=30) as resp:
            return dict(resp.headers), resp.status
    except urllib.error.HTTPError as e:
        return dict(e.headers), e.code


def build_private_pages():
    posts = req("GET", f"{REST}/posts?{urllib.parse.urlencode({'per_page': 100, 'status': 'publish', '_fields': 'id,slug,date,modified,link,title'})}")
    pages = req("GET", f"{REST}/pages?{urllib.parse.urlencode({'per_page': 50, 'status': 'publish', '_fields': 'id,slug,modified,link,title'})}")
    hdrs, status = http_headers("https://www.ufc.fr/")
    interesting = {
        k: hdrs.get(k)
        for k in hdrs
        if k.lower()
        in {
            "x-litespeed-cache",
            "x-litespeed-tag",
            "x-cache",
            "cache-control",
            "content-encoding",
            "server",
            "x-powered-by",
            "cf-cache-status",
            "age",
            "etag",
            "content-type",
        }
    }
    plugins = req("GET", f"{REST}/plugins")
    plug_names = [f"{p.get('name')} ({p.get('status')})" for p in plugins] if isinstance(plugins, list) else ["n/a"]

    # sitemap
    sm_status = "?"
    try:
        r = urllib.request.Request("https://www.ufc.fr/sitemap_index.xml", headers={"User-Agent": UA})
        with urllib.request.urlopen(r, context=CTX, timeout=30) as resp:
            sm_status = str(resp.status)
            sm_len = len(resp.read())
    except urllib.error.HTTPError as e:
        sm_status = str(e.code)
        sm_len = 0

    gsk = "Site Kit REST non exposée ou 404"
    try:
        g = req("GET", "https://www.ufc.fr/wp-json/google-site-kit/v1")
        gsk = str(g)[:800]
    except SystemExit as e:
        gsk = str(e)[:500]

    latest = "".join(
        f"<li>{p.get('date','')[:10]} — <a href=\"{p.get('link')}\">{(p.get('title') or {}).get('rendered','')}</a></li>"
        for p in (posts or [])[:20]
    )
    seo_html = f"""
<p><strong>Page interne.</strong> Chiffres WordPress / en-têtes serveur au {time.strftime('%Y-%m-%d %H:%M')}. 
Les clics Search Console se lisent dans Site Kit (wp-admin) : l’API publique ne renvoie pas les impressions ici.</p>
<ul>
<li>Articles publiés (100 max API) : <strong>{len(posts or [])}</strong></li>
<li>Pages publiées : <strong>{len(pages or [])}</strong></li>
<li>Sitemap index : HTTP {sm_status}, {sm_len} octets — <a href="https://www.ufc.fr/sitemap_index.xml">sitemap_index.xml</a></li>
<li>Accueil HTTP {status}</li>
<li>Cache / perf headers accueil : <code>{json.dumps(interesting, ensure_ascii=False)}</code></li>
<li>Site Kit : {gsk}</li>
</ul>
<p>URLs à surveiller dans Search Console (requêtes Paris 2026, Parnasse, clubs MMA) :</p>
<ul>
<li>https://www.ufc.fr/ufc-paris-2026-date-lieu-carte-enjeux/</li>
<li>https://www.ufc.fr/classements-ufc-aout-2026/</li>
<li>https://www.ufc.fr/champions-mma-actuels/</li>
<li>https://www.ufc.fr/clubs-mma-francais/</li>
</ul>
<h2>20 derniers articles</h2>
<ul>{latest}</ul>
<p>Cadence : relire Site Kit 28 jours vs 3 mois après le 5 septembre. Page publique méthode : <a href="/suivi-seo/">/suivi-seo/</a>.</p>
"""
    tech_html = f"""
<p><strong>Audit technique court</strong> — {time.strftime('%Y-%m-%d')}. Pas un Lighthouse complet (pas d’exécution Chrome ici).</p>
<h2>Stack</h2>
<ul>{''.join(f'<li>{x}</li>' for x in plug_names)}</ul>
<h2>Accueil — en-têtes</h2>
<pre>{json.dumps(interesting, ensure_ascii=False, indent=2)}</pre>
<h2>Constats</h2>
<ul>
<li>Thème Blocksy + Elementor + Royal Addons : lourd, mais déjà en production. Recoder avant le 5 septembre : non.</li>
<li>LiteSpeed Cache est actif. Purge Elementor déjà utilisée après les MAJ de templates.</li>
<li>Wordfence : ne pas brute-forcer wp-login (lockouts déjà vus).</li>
<li>Images : featured Wikimedia (Accor, cages) + hero accueil basculé sur Accor Arena.</li>
<li>À faire plus tard : CSS critique, lazy-load des grilles wpr-grid, WebP du hero, préconnexion fonts.</li>
</ul>
<p>Homepage touch + DELETE /elementor/v1/cache après chaque patch Elementor.</p>
"""
    veille_html = f"""
<p><strong>Veille opérationnelle</strong> — générée le {time.strftime('%Y-%m-%d %H:%M')}. 
Ce n’est pas un LLM autonome 24/7. C’est la file que l’équipe (ou le script <code>veille_mma.py</code>) met à jour.</p>
<h2>À ouvrir aujourd’hui / cette semaine</h2>
<ol>
<li>UFC.com / carte Paris — remplaçant Wood ?</li>
<li>Pesée officielle — 4 septembre seulement.</li>
<li>Brouillon résultats id 4827 — nuit du 5.</li>
<li>La Sueur / ActuMMA — nouvelles citations FR.</li>
<li>Hexagone Rouen carte officielle vs presse.</li>
<li>Ceintures KSW post-Parnasse — après Bercy.</li>
</ol>
<h2>Sources RSS / pages</h2>
<ul>
<li>https://www.ufc.com/rankings</li>
<li>https://en.wikipedia.org/wiki/UFC_rankings</li>
<li>https://www.actumma.com/</li>
<li>https://lasueur.com/</li>
<li>https://hexagonemma.fr/evenements/</li>
</ul>
<p>Règle : aucun résultat inventé, aucune interview exclusive inventée. Relire avant publish.</p>
"""
    for slug, title, html, status in [
        ("tableau-de-bord-seo", "Tableau de bord SEO (interne)", seo_html, "private"),
        ("audit-technique-litespeed", "Audit technique LiteSpeed / perf (interne)", tech_html, "private"),
        ("veille-mma-quotidienne", "Veille MMA — file opérationnelle (interne)", veille_html, "private"),
    ]:
        upsert(
            "pages",
            {"title": title, "slug": slug, "status": status, "content": html, "comment_status": "closed"},
            slug,
        )


def main():
    cats = {
        "actualite": 13,
        "ufc": 32,
        "ares": 36,
        "hexagone-mma": 37,
        "ufc-paris-2026": 55,
        "clubs-mma-francais": 56,
        "evenements": 58,
        "analyses": 59,
        "combattants": 60,
        "interviews": 61,
    }
    items = [
        {"file": "38-team-ezbiri-lyon.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite", "combattants"], "feat": PLMMA},
        {"file": "39-panthers-lille.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "40-parabellum-nantes.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "41-fightnfit-bordeaux.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "42-maccabi-nice.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "43-ziam-sola-citations.html", "kind": "posts", "cats": ["actualite", "interviews", "ufc", "ufc-paris-2026"], "feat": ACCOR},
        {"file": "44-ufc-paris-2027.html", "kind": "posts", "cats": ["actualite", "ufc", "analyses"], "feat": ACCOR},
        {"file": "06-page-clubs-mma-francais.html", "kind": "pages", "cats": [], "feat": PLMMA},
    ]
    for it in items:
        publish_file(it, cats)

    print("--- portraits ---")
    patch_portraits()
    print("--- homepage ---")
    patch_homepage_bg()
    print("--- private dashboards ---")
    build_private_pages()
    try:
        req("DELETE", "https://www.ufc.fr/wp-json/elementor/v1/cache")
        print("elementor cache ok")
    except SystemExit as e:
        print("cache", e)
    req("POST", f"{REST}/pages/30", {"excerpt": "UFC Paris 2026 — Accor Arena. Média MMA indépendant."})
    print("DONE")


if __name__ == "__main__":
    main()

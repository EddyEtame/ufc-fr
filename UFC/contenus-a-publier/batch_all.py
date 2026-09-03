# -*- coding: utf-8 -*-
"""Publish remaining CDC work: clubs, citations, drafts, org/portrait notices, home, cats."""
import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

# L'identifiant de publication ne vit pas dans le code. Il etait ecrit en
# dur dans huit fichiers d'un depot public : le mot de passe etait bien en
# variable d'environnement, mais un identifiant admin valide, indexe, est
# la moitie du travail donnee a qui veut entrer. Les deux se lisent
# desormais dans l'environnement.
USER = os.environ["WP_USER"]
PASS = os.environ["WP_APP_PASS"]
DIR = Path(r"c:\Users\PC\Desktop\UFC\contenus-a-publier")
REST = "https://www.ufc.fr/wp-json/wp/v2"
EL_CACHE = "https://www.ufc.fr/wp-json/elementor/v1/cache"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"

ACCOR, OCTAGON, PLMMA = 4852, 4853, 4854

ALREADY_NOTICED = {
    2295, 3172, 3144, 3386, 2275, 3092, 3289, 3123, 3337, 4341, 3810, 4165, 4154, 1210
}

# Generic fallback; more precise sentences keyed by slug substring
SLUG_NOTICES = {
    "nemkov": "Vadim Nemkov est champion PFL des lourds (déc. 2025). Vérifier le statut sur la page Champions.",
    "cyborg": "Cris Cyborg est championne PFL des plumes féminins (déc. 2025). Fiche historique, pas forcément à jour round par round.",
    "eblen": "Johnny Eblen est intérim PFL des moyens (juil. 2026). Champion : Costello van Steenis.",
    "nurmagomedov": "Usman Nurmagomedov est champion PFL des légers (oct. 2025) — distinct d’Umar, KO à Shanghai le 29 août 2026.",
    "malykhin": "Anatoly Malykhin détient des ceintures ONE (mi-lourds / moyens selon ESPN août 2026). Vérifier sur Champions.",
    "christian-lee": "Christian Lee est listé champion ONE welters et légers (août 2026). Vérifier sur Champions.",
    "kane": "Oumar Kane est listé champion ONE des lourds (août 2026, ESPN).",
    "parnasse": "Salahdine Parnasse boxe le main event UFC Paris le 5 septembre. Ceintures KSW à confirmer après Bercy.",
    "sola": "Axel Sola boxe Farès Ziam à l’UFC Paris le 5 septembre 2026. Plus une simple fiche ARES.",
    "duclos": "Matthieu Duclos (Letho Duclos) est annoncé en début UFC à Paris le 5 septembre.",
}

ORG_PAGES = {
    1305: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous (ne pas lire cette fiche comme un état des titres).",
    1416: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1431: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1437: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1446: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1455: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1467: "Page organisation. Ceintures et calendrier 2026 : voir les liens ci-dessous.",
    1132: "Fil actualité. Dossier UFC Paris 2026, clubs français et citations sont en ligne — liens ci-dessous.",
}

CAT_DESCS = {
    13: "Actualité MMA en français : UFC, organisations européennes, clubs. UFC.FR, média indépendant — pas le site officiel de l’UFC.",
    32: "Actualité UFC : cartes, résultats, classements Meta, combattants. Couverture indépendante, sources nommées.",
    33: "PFL (Professional Fighters League) : ceintures, saisons, combattants. Titres à jour sur la page Champions MMA actuels.",
    34: "ONE Championship : MMA et règles spécifiques ONE. Titres à jour sur Champions MMA actuels.",
    35: "Cage Warriors : circuit européen, passerelle vers l’UFC. Titres à jour sur Champions MMA actuels.",
    36: "ARES Fighting Championship : cartes, ceintures, combattants français. Calendrier 2026 et page Champions.",
    37: "Hexagone MMA : galas France (Toulouse, Rouen…), ceintures, clubs. Calendrier automne 2026.",
    38: "KSW : organisation polonaise. Salahdine Parnasse (légers/plumes) boxe à l’UFC Paris le 5 septembre 2026.",
    55: "UFC Paris 2026 : samedi 5 septembre, Accor Arena. Hooker vs Parnasse, Ziam vs Sola, huit Français. Dossier, carte, citations.",
    56: "Clubs de MMA français : portraits sourcés (adresse, coachs, tarifs publics). Toulouse, Paris, Lyon, Lille, Nantes, Bordeaux, Nice, Montpellier, Strasbourg, Rennes.",
    57: "Résultats MMA officiels uniquement. Pas de score inventé : on attend l’annonce UFC / orga.",
    58: "Événements MMA : UFC Paris, Hexagone, ARES, calendrier France. Dates sourcées.",
    59: "Analyses : lectures de cartes et de hiérarchies, après les faits. Pas de pronostics déguisés en résultats.",
    60: "Combattants : portraits, débuts UFC, Français sur les cartes. Fiches 2025 : vérifier la page Champions.",
    61: "Interviews et citations sourcées (presse, podcasts). UFC.FR n’invente pas d’exclusives.",
}

FIGS = {
    ACCOR: (
        "Façade de l’Accor Arena, lieu de l’UFC Paris",
        "Accor Arena, Paris. Photo Vilacor, Wikimedia Commons, licence CC BY 4.0.",
    ),
    OCTAGON: (
        "Cage octogonale de MMA, photo du Corps des Marines des États-Unis",
        "Cage octogonale de MMA. Photo U.S. Marine Corps, domaine public (Wikimedia Commons).",
    ),
    PLMMA: (
        "Cage octogonale de MMA en salle, illustration d’un club de MMA",
        "Cage MMA en salle (PLMMA, Pologne). Photo Tyka17, Wikimedia Commons, licence CC BY-SA 4.0.",
    ),
}


def token():
    import base64

    return base64.b64encode(f"{USER}:{PASS}".encode()).decode()


def json_headers():
    return {
        "Authorization": f"Basic {token()}",
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def req(method, url, data=None, timeout=90):
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=json_headers(), method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            if raw.strip()[0] in "[{":
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
        print(f"updated {kind} {slug} id={out['id']} {out.get('link')}")
        return out
    out = req("POST", f"{REST}/{kind}", payload)
    print(f"created {kind} {slug} id={out['id']} {out.get('link')}")
    return out


def figure(media_id):
    src_map = {
        ACCOR: "https://www.ufc.fr/wp-content/uploads/2026/08/accor-arena-bercy-scaled.jpg",
        OCTAGON: "https://www.ufc.fr/wp-content/uploads/2026/08/ufc-octagon-usmc-scaled.jpg",
        PLMMA: "https://www.ufc.fr/wp-content/uploads/2026/08/plmma-cage-mma-scaled.jpg",
    }
    alt, cap = FIGS[media_id]
    return f'<figure><img src="{src_map[media_id]}" alt="{alt}" /><figcaption>{cap}</figcaption></figure>\n'


def publish_file(it, cats):
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    content = strip_comments(raw)
    feat = it.get("feat")
    if feat:
        content = figure(feat) + content
    status = it.get("status") or meta_from_comment(raw, "Statut") or "publish"
    if status.lower() in {"draft", "brouillon"}:
        status = "draft"
    payload = {
        "title": meta_from_comment(raw, "Titre"),
        "slug": meta_from_comment(raw, "Slug"),
        "status": status,
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


def notice_html(sentence, kind="ceinture"):
    if kind == "orga":
        return (
            "<p><strong>À lire aussi — UFC.FR, 31 août 2026.</strong> "
            f"{sentence} "
            'Titres : <a href="/champions-mma-actuels/">Champions MMA actuels</a>. '
            'Classements : <a href="/classements-ufc-aout-2026/">août 2026</a>. '
            'Dossier : <a href="/ufc-paris-2026-date-lieu-carte-enjeux/">UFC Paris 2026</a>. '
            'Calendrier : <a href="/calendrier-mma-france-automne-2026/">automne 2026</a>. '
            'Clubs : <a href="/clubs-mma-francais/">clubs MMA français</a>.</p>'
        )
    return (
        "<p><strong>Mise à jour 31 août 2026 — ceinture / statut périmé.</strong> "
        f"{sentence} "
        'Titres à jour : <a href="/champions-mma-actuels/">Champions MMA actuels</a>. '
        'Classements : <a href="/classements-ufc-aout-2026/">août 2026</a>.</p>'
    )


def make_widget(post_id, html):
    cid = f"c{post_id:06x}"[:7]
    wid = f"w{post_id:06x}"[:7]
    return {
        "id": cid,
        "elType": "container",
        "settings": {
            "content_width": "full",
            "padding": {
                "unit": "px",
                "top": "24",
                "right": "0",
                "bottom": "0",
                "left": "0",
                "isLinked": False,
            },
        },
        "elements": [
            {
                "id": wid,
                "elType": "widget",
                "widgetType": "text-editor",
                "settings": {
                    "editor": html,
                    "_background_background": "classic",
                    "_padding": {
                        "unit": "px",
                        "top": "16",
                        "right": "20",
                        "bottom": "16",
                        "left": "20",
                        "isLinked": True,
                    },
                },
                "elements": [],
            }
        ],
        "isInner": True,
    }


def insert_notice(tree, widget):
    def walk(nodes):
        if not isinstance(nodes, list):
            return False
        for node in nodes:
            settings = node.get("settings") or {}
            if settings.get("html_tag") == "main" and isinstance(node.get("elements"), list):
                node["elements"].insert(0, widget)
                return True
            if walk(node.get("elements") or []):
                return True
        return False

    if walk(tree):
        return True
    if tree and isinstance(tree[0].get("elements"), list) and tree[0]["elements"]:
        tree[0]["elements"].insert(1 if len(tree[0]["elements"]) > 1 else 0, widget)
        return True
    return False


def patch_elementor(kind, post_id, sentence, extra_check, html_kind="ceinture"):
    node = req("GET", f"{REST}/{kind}/{post_id}?context=edit")
    meta = node.get("meta") or {}
    raw = meta.get("_elementor_data")
    if not raw or not isinstance(raw, str):
        print(f"skip no elementor {kind}/{post_id}")
        return False
    if extra_check in raw or "ceinture / statut périmé" in raw or "À lire aussi — UFC.FR" in raw:
        print(f"already patched {kind}/{post_id} {(node.get('slug') or '')}")
        return False
    tree = json.loads(raw)
    html = notice_html(sentence, html_kind)
    if not insert_notice(tree, make_widget(post_id, html)):
        print(f"WARN could not insert {kind}/{post_id}")
        return False
    new = json.dumps(tree, ensure_ascii=False, separators=(",", ":"))
    req(
        "POST",
        f"{REST}/{kind}/{post_id}",
        {"meta": {"_elementor_data": new, "_elementor_edit_mode": "builder"}},
    )
    print(f"patched elementor {kind}/{post_id} {node.get('slug')}")
    return True


def sentence_for_slug(slug):
    slug = slug or ""
    for key, sent in SLUG_NOTICES.items():
        if key in slug:
            return sent
    return (
        "Cette fiche date de 2025. Les ceintures et statuts ont pu bouger. "
        "Ne pas la lire comme un état des titres 2026."
    )


def list_portraits():
    found = []
    page = 1
    while page <= 8:
        q = urllib.parse.urlencode(
            {
                "search": "portrait",
                "per_page": 100,
                "page": page,
                "status": "publish",
                "_fields": "id,slug,title,categories,featured_media",
            }
        )
        try:
            batch = req("GET", f"{REST}/posts?{q}")
        except SystemExit as e:
            if "rest_post_invalid_page_number" in str(e) or "400" in str(e):
                break
            raise
        if not batch:
            break
        for p in batch:
            slug = p.get("slug") or ""
            if "portrait" in slug or any(
                c in (p.get("categories") or []) for c in (33, 34, 35, 36, 37, 38, 60)
            ):
                found.append(p)
        if len(batch) < 100:
            break
        page += 1
    # also org-adjacent fighter posts in PFL/ONE/CW/ARES/Hexagone cats
    for cat in (33, 34, 35, 36, 37, 38):
        q = urllib.parse.urlencode(
            {
                "categories": cat,
                "per_page": 100,
                "status": "publish",
                "_fields": "id,slug,title,categories,featured_media",
            }
        )
        batch = req("GET", f"{REST}/posts?{q}") or []
        found.extend(batch)
    uniq = {}
    for p in found:
        uniq[p["id"]] = p
    return list(uniq.values())


def patch_remaining_portraits():
    portraits = list_portraits()
    print(f"portrait candidates {len(portraits)}")
    n = 0
    for p in portraits:
        pid = p["id"]
        if pid in ALREADY_NOTICED:
            continue
        slug = p.get("slug") or ""
        if not slug.startswith("portrait") and "portrait" not in slug:
            # skip news posts in those cats (ares 43, hexagone 47, etc.)
            if pid >= 4800:
                continue
            if "organisation" in slug:
                continue
        try:
            if patch_elementor(
                "posts",
                pid,
                sentence_for_slug(slug),
                extra_check="ceinture / statut périmé",
            ):
                n += 1
        except SystemExit as e:
            print(f"FAIL portrait {pid} {slug}: {e}")
    print(f"portraits newly patched {n}")


def patch_org_pages():
    for pid, sentence in ORG_PAGES.items():
        kind = "pages"
        try:
            node = req("GET", f"{REST}/pages/{pid}?context=edit")
        except SystemExit:
            try:
                node = req("GET", f"{REST}/posts/{pid}?context=edit")
                kind = "posts"
            except SystemExit as e:
                print(f"missing org {pid}: {e}")
                continue
        slug = node.get("slug") or ""
        print(f"org target {kind}/{pid} {slug}")
        try:
            patch_elementor(
                kind,
                pid,
                sentence,
                extra_check="À lire aussi — UFC.FR",
                html_kind="orga",
            )
        except SystemExit as e:
            print(f"FAIL org {pid}: {e}")


def patch_homepage(santos_id, hooker_id):
    page = req("GET", f"{REST}/pages/30?context=edit")
    data = (page.get("meta") or {}).get("_elementor_data")
    if not isinstance(data, str):
        print("homepage no elementor")
        return
    old = data
    data = data.replace(
        '"query_manual_post":["4822","4823"]',
        f'"query_manual_post":["{santos_id}","{hooker_id}"]',
    )
    data = data.replace(
        '"query_manual_post": [4822, 4823]',
        f'"query_manual_post":["{santos_id}","{hooker_id}"]',
    )
    if data == old:
        if f'"{santos_id}"' in data and f'"{hooker_id}"' in data:
            print("homepage grid already on new ids")
            return
        print("WARN homepage query_manual_post 4822/4823 not found — dump hits")
        hits = re.findall(r'"query_manual_post":\[[^\]]+\]', data)
        print("hits", hits[:12])
        return
    req(
        "POST",
        f"{REST}/pages/30",
        {"meta": {"_elementor_data": data, "_elementor_edit_mode": "builder"}},
    )
    print(f"homepage grid -> {santos_id} {hooker_id}")


def set_featured_missing():
    mapping = [
        ("calendrier-mma-france-automne-2026", OCTAGON),
        ("ares-43-oconnor-diatta-adidas-arena", OCTAGON),
        ("categories-poids-mma-guide", OCTAGON),
    ]
    # try known ids too
    by_id = {4839: OCTAGON, 4838: OCTAGON, 4826: OCTAGON}
    for slug, media in mapping:
        node = find_by_slug("posts", slug)
        if not node:
            print(f"featured skip missing {slug}")
            continue
        if node.get("featured_media"):
            print(f"featured already {slug} {node.get('featured_media')}")
            continue
        req("POST", f"{REST}/posts/{node['id']}", {"featured_media": media})
        print(f"featured {slug} <- {media}")
        by_id.pop(node["id"], None)
    for pid, media in by_id.items():
        try:
            node = req("GET", f"{REST}/posts/{pid}?_fields=id,slug,featured_media")
        except SystemExit:
            print(f"featured skip id {pid}")
            continue
        if node.get("featured_media"):
            print(f"featured already id {pid} {node['slug']}")
            continue
        req("POST", f"{REST}/posts/{pid}", {"featured_media": media})
        print(f"featured id {pid} {node.get('slug')} <- {media}")


def update_categories():
    for cid, desc in CAT_DESCS.items():
        cat = req("GET", f"{REST}/categories/{cid}")
        current = (cat.get("description") or "").strip()
        payload = {"description": desc}
        # Yoast category meta if registered
        payload["meta"] = {
            "_yoast_wpseo_desc": desc[:300],
            "_yoast_wpseo_metadesc": desc[:300],
        }
        try:
            req("POST", f"{REST}/categories/{cid}", payload)
            print(f"cat {cid} {cat.get('slug')} desc={'had' if current else 'empty'}->ok")
        except SystemExit as e:
            # retry without yoast meta
            try:
                req("POST", f"{REST}/categories/{cid}", {"description": desc})
                print(f"cat {cid} {cat.get('slug')} desc ok (no yoast meta)")
            except SystemExit as e2:
                print(f"FAIL cat {cid}: {e2}")


def main():
    cats = {
        "actualite": 13,
        "ufc": 32,
        "pfl": 33,
        "one": 34,
        "cage-warriors": 35,
        "ares": 36,
        "hexagone-mma": 37,
        "ksw": 38,
        "ufc-paris-2026": 55,
        "clubs-mma-francais": 56,
        "resultats": 57,
        "evenements": 58,
        "analyses": 59,
        "combattants": 60,
        "interviews": 61,
    }

    items = [
        {"file": "45-cage-training-montpellier.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "46-apex-strasbourg.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "47-monkey-gym-rennes.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "48-charriere-citations.html", "kind": "posts", "cats": ["actualite", "interviews", "ufc", "ufc-paris-2026"], "feat": ACCOR},
        {"file": "49-hooker-citations.html", "kind": "posts", "cats": ["actualite", "interviews", "ufc", "ufc-paris-2026"], "feat": ACCOR},
        {"file": "50-gane-retour.html", "kind": "posts", "cats": ["actualite", "ufc", "combattants"], "feat": OCTAGON},
        {"file": "51-pesee-draft.html", "kind": "posts", "cats": ["actualite", "ufc", "ufc-paris-2026"], "feat": ACCOR, "status": "draft"},
        {"file": "52-analyse-hooker-draft.html", "kind": "posts", "cats": ["analyses", "ufc", "ufc-paris-2026"], "feat": ACCOR, "status": "draft"},
        {"file": "53-bilan-fr-draft.html", "kind": "posts", "cats": ["analyses", "ufc", "ufc-paris-2026", "combattants"], "feat": ACCOR, "status": "draft"},
        {"file": "54-ziam-sola-analyse-draft.html", "kind": "posts", "cats": ["analyses", "ufc", "ufc-paris-2026"], "feat": ACCOR, "status": "draft"},
        {"file": "06-page-clubs-mma-francais.html", "kind": "pages", "cats": [], "feat": PLMMA},
    ]

    published = {}
    print("--- publish ---")
    for it in items:
        out = publish_file(it, cats)
        published[out["slug"]] = out

    santos = find_by_slug("posts", "ufc-paris-santos-forfait-wood")
    hooker = published.get("dan-hooker-citations-ufc-paris-parnasse")
    santos_id = (santos or {}).get("id") or 4864
    hooker_id = (hooker or {}).get("id")

    print("--- homepage ---")
    if hooker_id:
        patch_homepage(santos_id, hooker_id)
    else:
        print("WARN no hooker id")

    print("--- featured ---")
    set_featured_missing()

    print("--- categories ---")
    update_categories()

    print("--- org pages ---")
    patch_org_pages()

    print("--- remaining portraits ---")
    patch_remaining_portraits()

    try:
        req("DELETE", EL_CACHE)
        print("elementor cache deleted")
    except SystemExit as e:
        print(f"cache: {e}")
    req("POST", f"{REST}/pages/30", {"excerpt": "UFC Paris 2026 — Accor Arena. Média MMA indépendant."})
    print("homepage touched")
    print("BATCH ALL DONE")
    for slug, node in published.items():
        print(f"{node.get('status'):8} {node.get('id')} {node.get('link')}")


if __name__ == "__main__":
    main()

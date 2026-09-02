# -*- coding: utf-8 -*-
"""Publish remaining CDC articles + inject Elementor outdated-belt notices."""
import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

USER = "bc.combat31@gmail.com"
PASS = os.environ["WP_APP_PASS"]
DIR = Path(r"c:\Users\PC\Desktop\UFC\contenus-a-publier")
REST = "https://www.ufc.fr/wp-json/wp/v2"
EL_CACHE = "https://www.ufc.fr/wp-json/elementor/v1/cache"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"

ACCOR, OCTAGON, PLMMA = 4852, 4853, 4854

NOTICES = {
    2295: "Jon Jones n’est plus champion UFC des lourds. Champion actuel : Tom Aspinall (intérim Ciryl Gane).",
    3172: "Belal Muhammad n’est plus champion UFC des welters. Champion actuel : Islam Makhachev.",
    3144: "Ilia Topuria n’est plus champion UFC des plumes. Champion plumes : Alexander Volkanovski. Topuria est n°1 des légers (classements Meta, août 2026) après Gaethje.",
    3386: "Alexandre Pantoja n’est plus champion UFC des mouches. Champion actuel : Joshua Van.",
    2275: "Dricus du Plessis n’est plus champion UFC des moyens. Champion actuel : Sean Strickland. Du Plessis est n°2 Meta.",
    3092: "Magomed Ankalaev n’est plus champion UFC des mi-lourds. Champion actuel : Carlos Ulberg. Ankalaev est n°2 Meta.",
    3289: "Julianna Peña n’est plus championne UFC des coqs. Championne actuelle : Kayla Harrison.",
    3123: "Zhang Weili n’est plus championne UFC des pailles. Championne actuelle : Mackenzie Dern.",
    3337: "Merab Dvalishvili n’est plus champion UFC des coqs. Champion actuel : Petr Yan. Merab est n°1 Meta.",
    4341: "Axel Sola n’est plus à lire comme une simple fiche ARES : il boxe Farès Ziam à l’UFC Paris le 5 septembre 2026.",
    3810: "Salahdine Parnasse boxe en main event de l’UFC Paris le 5 septembre. Statut des ceintures KSW à confirmer après Bercy.",
    4165: "Matthieu Duclos (Letho Duclos) est annoncé en début UFC à Paris le 5 septembre, contre Luis Felipe Dias.",
    4154: "Fiche Hexagone d’avril–mai 2025. Les ceintures ont bougé : voir la page Champions MMA actuels.",
}

HUB_NOTICE = (
    "Plusieurs fiches de cette page datent d’avril–mai 2025 et décrivent des ceintures "
    "périmées (Jones, Belal, Topuria plumes, Pantoja, etc.). "
    "Titres à jour : <a href=\"/champions-mma-actuels/\">Champions MMA actuels</a>. "
    "Classements : <a href=\"/classements-ufc-aout-2026/\">août 2026</a>."
)


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


def strip_comments(html: str) -> str:
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


def meta_from_comment(html: str, key: str) -> str:
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


def figure(media_id, alt, cap):
    urls = {
        ACCOR: "https://www.ufc.fr/wp-content/uploads/2026/08/accor-arena-bercy-scaled.jpg",
        OCTAGON: "https://www.ufc.fr/wp-content/uploads/2026/08/ufc-octagon-usmc-scaled.jpg",
        PLMMA: "https://www.ufc.fr/wp-content/uploads/2026/08/plmma-cage-mma-scaled.jpg",
    }
    src = urls[media_id]
    return (
        f'<figure><img src="{src}" alt="{alt}" />'
        f"<figcaption>{cap}</figcaption></figure>\n"
    )


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


def publish_file(it, cats):
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    content = strip_comments(raw)
    feat = it.get("feat")
    if feat:
        alt, cap = FIGS[feat]
        content = figure(feat, alt, cap) + content
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


def notice_html(sentence: str) -> str:
    return (
        "<p><strong>Mise à jour 31 août 2026 — ceinture / statut périmé.</strong> "
        f"{sentence} "
        'Titres à jour : <a href="/champions-mma-actuels/">Champions MMA actuels</a>. '
        'Classements : <a href="/classements-ufc-aout-2026/">août 2026</a>.</p>'
    )


def make_widget(post_id: int, html: str) -> dict:
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
    """Insert notice as first child of html_tag=main, else after hero."""

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


def patch_elementor(kind, post_id, sentence, extra_check="ceinture / statut périmé"):
    node = req("GET", f"{REST}/{kind}/{post_id}?context=edit")
    meta = node.get("meta") or {}
    raw = meta.get("_elementor_data")
    if not raw or not isinstance(raw, str):
        print(f"skip no elementor {kind}/{post_id}")
        return
    if extra_check in raw or "ceinture / statut périmé" in raw:
        print(f"already patched {kind}/{post_id}")
        return
    tree = json.loads(raw)
    html = notice_html(sentence)
    if not insert_notice(tree, make_widget(post_id, html)):
        print(f"WARN could not insert {kind}/{post_id}")
        return
    new = json.dumps(tree, ensure_ascii=False, separators=(",", ":"))
    req(
        "POST",
        f"{REST}/{kind}/{post_id}",
        {
            "meta": {
                "_elementor_data": new,
                "_elementor_edit_mode": "builder",
            }
        },
    )
    print(f"patched elementor {kind}/{post_id}")


def main():
    cats = {
        "actualite": 13,
        "ufc": 32,
        "ares": 36,
        "hexagone-mma": 37,
        "ufc-paris-2026": 55,
        "clubs-mma-francais": 56,
        "resultats": 57,
        "evenements": 58,
        "analyses": 59,
        "combattants": 60,
        "interviews": 61,
    }

    items = [
        {"file": "30-fondation-marseille.html", "kind": "posts", "cats": ["clubs-mma-francais", "actualite"], "feat": PLMMA},
        {"file": "31-fmmaf.html", "kind": "posts", "cats": ["actualite", "analyses", "clubs-mma-francais"], "feat": PLMMA},
        {"file": "32-hexagone-rouen.html", "kind": "posts", "cats": ["actualite", "hexagone-mma", "evenements"], "feat": OCTAGON},
        {"file": "33-differences-orgs.html", "kind": "posts", "cats": ["analyses", "actualite"], "feat": OCTAGON},
        {"file": "34-carte-ufc.html", "kind": "posts", "cats": ["analyses", "ufc"], "feat": ACCOR},
        {"file": "35-femmes-mma.html", "kind": "posts", "cats": ["actualite", "combattants", "ufc-paris-2026", "analyses"], "feat": ACCOR},
        {"file": "36-duclos-aljarouj.html", "kind": "posts", "cats": ["actualite", "combattants", "ufc", "ufc-paris-2026", "analyses"], "feat": ACCOR},
        {"file": "06-page-clubs-mma-francais.html", "kind": "pages", "cats": [], "feat": PLMMA},
        {"file": "17-calendrier-mma-france.html", "kind": "posts", "cats": ["actualite", "evenements", "hexagone-mma", "ares"]},
        {"file": "21-page-forum.html", "kind": "pages", "cats": []},
        {"file": "37-methode-ia.html", "kind": "pages", "cats": [], "status": "private"},
    ]

    published = {}
    for it in items:
        out = publish_file(it, cats)
        published[out["slug"]] = out

    print("--- elementor portraits ---")
    for pid, sentence in NOTICES.items():
        try:
            patch_elementor("posts", pid, sentence)
        except SystemExit as e:
            print(f"FAIL portrait {pid}: {e}")

    print("--- portraits hub 1210 ---")
    try:
        patch_elementor(
            "pages",
            1210,
            "Plusieurs fiches de cette page datent d’avril–mai 2025 et décrivent des ceintures périmées (Jones, Belal, Topuria plumes, Pantoja, etc.).",
        )
    except SystemExit as e:
        print(f"FAIL hub: {e}")

    try:
        req("DELETE", EL_CACHE)
        print("elementor cache deleted")
    except SystemExit as e:
        print(f"cache: {e}")
    req("POST", f"{REST}/pages/30", {"excerpt": "UFC Paris 2026 — Accor Arena. Média MMA indépendant."})
    print("homepage touched")
    print("REMAINING BATCH DONE")
    for slug, node in published.items():
        print(f"{node.get('status'):8} {node.get('link')}")


if __name__ == "__main__":
    main()

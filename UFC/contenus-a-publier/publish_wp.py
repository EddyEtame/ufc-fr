# -*- coding: utf-8 -*-
"""Publish prepared UFC.FR contents via WordPress REST API."""
import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://www.ufc.fr/wp-json/wp/v2"
# L'identifiant de publication ne vit pas dans le code. Il etait ecrit en
# dur dans huit fichiers d'un depot public : le mot de passe etait bien en
# variable d'environnement, mais un identifiant admin valide, indexe, est
# la moitie du travail donnee a qui veut entrer. Les deux se lisent
# desormais dans l'environnement.
USER = os.environ["WP_USER"]
PASS = os.environ["WP_APP_PASS"]
DIR = Path(r"c:\Users\PC\Desktop\UFC\contenus-a-publier")

CTX = ssl.create_default_context()


def auth_header():
    import base64

    token = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    return {
        "Authorization": f"Basic {token}",
        "User-Agent": "UFCFR-COM-Agent/1.0",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def req(method, path, data=None, query=None):
    url = BASE + path
    if query:
        url += "?" + urllib.parse.urlencode(query)
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=auth_header(), method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            return resp.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {e.code}\n{err}") from e


def strip_comments(html: str) -> str:
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


def meta_from_comment(html: str, key: str) -> str:
    m = re.search(rf"{re.escape(key)}:\s*(.+)", html)
    return m.group(1).strip() if m else ""


def ensure_category(name: str, slug: str) -> int:
    status, data = req("GET", "/categories", query={"slug": slug, "per_page": 10})
    if data:
        print(f"cat exists {slug} id={data[0]['id']}")
        return data[0]["id"]
    status, created = req("POST", "/categories", {"name": name, "slug": slug})
    print(f"cat created {slug} id={created['id']}")
    return created["id"]


def find_by_slug(kind: str, slug: str):
    status, data = req("GET", f"/{kind}", query={"slug": slug, "per_page": 5, "status": "any"})
    return data[0] if data else None


def upsert(kind: str, payload: dict, slug: str):
    existing = find_by_slug(kind, slug)
    if existing:
        status, out = req("POST", f"/{kind}/{existing['id']}", payload)
        print(f"updated {kind} {slug} id={out['id']} link={out.get('link')}")
        return out
    status, out = req("POST", f"/{kind}", payload)
    print(f"created {kind} {slug} id={out['id']} link={out.get('link')}")
    return out


def menu_has(title: str, menu_id: int) -> bool:
    status, items = req("GET", "/menu-items", query={"menus": menu_id, "per_page": 100})
    titles = [(i.get("title") or {}).get("rendered", "") for i in items]
    return any(title.lower() in t.lower() for t in titles)


def add_menu_item(menu_id: int, title: str, url: str, object_id: int, object_type: str):
    if menu_has(title, menu_id):
        print(f"menu {menu_id} already has {title}")
        return
    payload = {
        "title": title,
        "status": "publish",
        "url": url,
        "menus": menu_id,
        "type": "post_type",
        "object": object_type,
        "object_id": object_id,
        "parent": 0,
    }
    status, out = req("POST", "/menu-items", payload)
    print(f"menu item {title} -> {out.get('id')} in menu {menu_id}")


def main():
    cats = {
        "actualite": 13,
        "ufc": 32,
        "ufc-paris-2026": ensure_category("UFC Paris 2026", "ufc-paris-2026"),
        "clubs-mma-francais": ensure_category("Clubs de MMA français", "clubs-mma-francais"),
        "resultats": ensure_category("Résultats", "resultats"),
        "evenements": ensure_category("Événements", "evenements"),
        "analyses": ensure_category("Analyses", "analyses"),
        "combattants": ensure_category("Combattants", "combattants"),
    }

    items = [
        {
            "file": "05-page-champions-actuels.html",
            "kind": "pages",
            "object": "page",
            "status": "publish",
            "cats": [],
        },
        {
            "file": "06-page-clubs-mma-francais.html",
            "kind": "pages",
            "object": "page",
            "status": "publish",
            "cats": [],
        },
        {
            "file": "01-ufc-paris-2026-presentation.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["actualite", "ufc", "ufc-paris-2026"],
        },
        {
            "file": "02-ufc-paris-2026-carte.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["actualite", "ufc", "ufc-paris-2026"],
        },
        {
            "file": "03-ufc-paris-combattants-francais.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["actualite", "ufc", "ufc-paris-2026", "combattants"],
        },
        {
            "file": "04-cage-fight-toulouse.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["clubs-mma-francais", "actualite"],
        },
        {
            "file": "09-ufc-paris-historique.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["actualite", "ufc", "ufc-paris-2026"],
        },
        {
            "file": "13-guide-categories-poids.html",
            "kind": "posts",
            "object": "post",
            "status": "publish",
            "cats": ["actualite", "analyses"],
        },
        {
            "file": "10-modele-resultats-ufc-paris.html",
            "kind": "posts",
            "object": "post",
            "status": "draft",
            "cats": ["actualite", "ufc", "ufc-paris-2026", "resultats"],
        },
    ]

    published = {}
    for it in items:
        raw = (DIR / it["file"]).read_text(encoding="utf-8")
        title = meta_from_comment(raw, "Titre")
        slug = meta_from_comment(raw, "Slug")
        yoast_title = meta_from_comment(raw, "Yoast title")
        yoast_desc = meta_from_comment(raw, "Yoast meta")
        content = strip_comments(raw)
        payload = {
            "title": title,
            "slug": slug,
            "status": it["status"],
            "content": content,
            "comment_status": "open",
        }
        if it["cats"]:
            payload["categories"] = [cats[c] for c in it["cats"]]
        if yoast_title or yoast_desc:
            payload["meta"] = {}
            if yoast_title:
                payload["meta"]["_yoast_wpseo_title"] = yoast_title
            if yoast_desc:
                payload["meta"]["_yoast_wpseo_metadesc"] = yoast_desc
        out = upsert(it["kind"], payload, slug)
        published[slug] = out

    # Menus: Principal (4) + Footer (12)
    mapping = [
        ("UFC Paris 2026", "ufc-paris-2026-date-lieu-carte-enjeux", "post"),
        ("Champions actuels", "champions-mma-actuels", "page"),
        ("Clubs de MMA français", "clubs-mma-francais", "page"),
    ]
    for title, slug, obj in mapping:
        node = published[slug]
        for menu_id in (4, 12):
            add_menu_item(menu_id, title, node["link"], node["id"], obj)

    print("DONE")
    for slug, node in published.items():
        print(f"{node['status']:8} {slug} {node.get('link')}")


if __name__ == "__main__":
    main()

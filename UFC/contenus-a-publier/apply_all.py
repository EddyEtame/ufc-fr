# -*- coding: utf-8 -*-
import json
import os
import re
import ssl
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://www.ufc.fr/wp-json/wp/v2"
USER = "bc.combat31@gmail.com"
PASS = os.environ["WP_APP_PASS"]
DIR = Path(r"c:\Users\PC\Desktop\UFC\contenus-a-publier")
CTX = ssl.create_default_context()


def headers():
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
    r = urllib.request.Request(url, data=body, headers=headers(), method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=90) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {e.code}\n{err[:2000]}") from e


def strip_comments(html: str) -> str:
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


def meta_from_comment(html: str, key: str) -> str:
    m = re.search(rf"{re.escape(key)}:\s*(.+)", html)
    return m.group(1).strip() if m else ""


def find_by_slug(kind: str, slug: str):
    data = req("GET", f"/{kind}", query={"slug": slug, "per_page": 5, "status": "any"})
    return data[0] if data else None


def upsert(kind, payload, slug):
    existing = find_by_slug(kind, slug)
    if existing:
        out = req("POST", f"/{kind}/{existing['id']}", payload)
        print(f"updated {kind} {slug} {out.get('link')}")
        return out
    out = req("POST", f"/{kind}", payload)
    print(f"created {kind} {slug} {out.get('link')}")
    return out


def menu_has(title: str, menu_id: int) -> bool:
    items = req("GET", "/menu-items", query={"menus": menu_id, "per_page": 100})
    return any(title.lower() in (i.get("title") or {}).get("rendered", "").lower() for i in items)


def add_menu_item(menu_id, title, url, object_id, object_type):
    if menu_has(title, menu_id):
        print(f"menu {menu_id} has {title}")
        return
    out = req(
        "POST",
        "/menu-items",
        {
            "title": title,
            "status": "publish",
            "url": url,
            "menus": menu_id,
            "type": "post_type",
            "object": object_type,
            "object_id": object_id,
            "parent": 0,
        },
    )
    print(f"menu {menu_id} + {title} id={out.get('id')}")


def publish_file(it, cats):
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    payload = {
        "title": meta_from_comment(raw, "Titre"),
        "slug": meta_from_comment(raw, "Slug"),
        "status": it.get("status", "publish"),
        "content": strip_comments(raw),
        "comment_status": "open",
    }
    if it.get("date"):
        payload["date"] = it["date"]
        payload["date_gmt"] = it["date_gmt"]
    if it.get("cats"):
        payload["categories"] = [cats[c] for c in it["cats"]]
    yt, yd = meta_from_comment(raw, "Yoast title"), meta_from_comment(raw, "Yoast meta")
    if yt or yd:
        payload["meta"] = {}
        if yt:
            payload["meta"]["_yoast_wpseo_title"] = yt
        if yd:
            payload["meta"]["_yoast_wpseo_metadesc"] = yd
    return upsert(it["kind"], payload, payload["slug"])


def update_homepage():
    page = req("GET", "/pages/30", query={"context": "edit"})
    data = page["meta"]["_elementor_data"]
    if isinstance(data, list):
        data = json.dumps(data, ensure_ascii=False)
    old = data
    data = data.replace('"query_manual_post":["3946"]', '"query_manual_post":["4821"]')
    data = data.replace('"query_manual_post":["3857","3919"]', '"query_manual_post":["4822","4823"]')
    data = data.replace('"query_manual_post":["3411"]', '"query_manual_post":["3810"]')
    data = data.replace(
        "Le MMA en Direct, Sans Filtre",
        "UFC Paris 2026 — Accor Arena",
    )
    data = data.replace(
        "Bienvenue sur UFC.FR, votre r\\u00e9f\\u00e9rence incontournable pour tout ce qui concerne le MMA. Restez inform\\u00e9 des derni\\u00e8res actualit\\u00e9s et \\u00e9v\\u00e9nements qui font vibrer les passionn\\u00e9s.",
        "M\\u00e9dia MMA ind\\u00e9pendant \\u2014 pas le site officiel de l\\u2019UFC. Dossier UFC Paris 2026 : Hooker vs Parnasse, le 5 septembre \\u00e0 Bercy.",
    )
    data = data.replace(
        '"url":"#last-news"',
        '"url":"https:\\/\\/www.ufc.fr\\/ufc-paris-2026-date-lieu-carte-enjeux\\/"',
    )
    if data == old:
        print("WARN homepage JSON unchanged — check strings")
    else:
        print("homepage JSON patched")
    payload = {
        "meta": {
            "_elementor_data": data,
            "_elementor_edit_mode": "builder",
        }
    }
    try:
        req("POST", "/pages/30", payload)
        print("homepage meta saved")
    except SystemExit as e:
        print("homepage meta POST failed, retry content only")
        print(str(e)[:500])


def update_mentions():
    page = req("GET", "/pages/2795", query={"context": "edit"})
    raw = page["content"]["raw"]
    bloc = (
        "<h2>Indépendance éditoriale</h2>\n"
        "<p><strong>UFC.FR est un média indépendant d’actualité MMA.</strong> "
        "Il n’est pas affilié à l’Ultimate Fighting Championship, à Zuffa LLC, "
        "à TKO Group Holdings, ni à aucune organisation de MMA citée sur ce site. "
        "Les marques restent la propriété de leurs titulaires.</p>\n"
    )
    if "Indépendance éditoriale" in raw:
        print("mentions already has disclaimer")
        return
    if "<h2>Hébergement</h2>" in raw:
        raw = raw.replace("<h2>Hébergement</h2>", bloc + "<h2>Hébergement</h2>", 1)
    else:
        raw = bloc + raw
    req("POST", "/pages/2795", {"content": raw})
    print("mentions updated")


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
    }

    req(
        "POST",
        "/settings",
        {
            "description": "Média indépendant d’actualité MMA — France et international. Non affilié à l’UFC."
        },
    )
    print("tagline updated")

    items = [
        {
            "file": "20-page-a-propos.html",
            "kind": "pages",
            "object": "page",
            "cats": [],
        },
        {
            "file": "21-page-forum.html",
            "kind": "pages",
            "object": "page",
            "cats": [],
        },
        {
            "file": "14-ufc-shanghai-resultats.html",
            "kind": "posts",
            "object": "post",
            "date": "2026-08-30T21:00:00",
            "date_gmt": "2026-08-30T19:00:00",
            "cats": ["actualite", "ufc", "resultats"],
        },
        {
            "file": "15-ufc-sacramento-resultats.html",
            "kind": "posts",
            "object": "post",
            "date": "2026-08-23T12:00:00",
            "date_gmt": "2026-08-23T10:00:00",
            "cats": ["actualite", "ufc", "resultats"],
        },
        {
            "file": "16-ares-43.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "ares", "evenements"],
        },
        {
            "file": "17-calendrier-mma-france.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "evenements", "hexagone-mma", "ares"],
        },
        {
            "file": "18-parnasse-debuts-ufc.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "ufc", "combattants", "ufc-paris-2026"],
        },
        {
            "file": "19-ziam-vs-sola.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "ufc", "analyses", "ufc-paris-2026"],
        },
    ]

    published = {}
    for it in items:
        out = publish_file(it, cats)
        published[out["slug"]] = out

    for title, slug, obj in [
        ("À propos", "a-propos", "page"),
        ("Communauté", "forum-communaute-mma", "page"),
        ("Calendrier MMA France", "calendrier-mma-france-automne-2026", "post"),
    ]:
        node = published[slug]
        for menu_id in (4, 12):
            add_menu_item(menu_id, title, node["link"], node["id"], obj)

    update_mentions()
    update_homepage()
    print("ALL DONE")
    for slug, node in published.items():
        print(f"{node['status']:8} {node.get('link')}")


if __name__ == "__main__":
    main()

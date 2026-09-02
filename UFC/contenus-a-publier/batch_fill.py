# -*- coding: utf-8 -*-
"""Upload Wikimedia images, publish remaining CDC content, attach featured images."""
import base64
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
IMG_DIR = DIR / "images-wikimedia"
REST = "https://www.ufc.fr/wp-json/wp/v2"
EL_CACHE = "https://www.ufc.fr/wp-json/elementor/v1/cache"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"

NOTICE = (
    '<p><strong>Mise à jour :</strong> cette fiche date d’avril 2025 et peut décrire '
    'une ceinture périmée. Titres actuels : '
    '<a href="/champions-mma-actuels/">Champions MMA actuels</a>. '
    'Classements : <a href="/classements-ufc-aout-2026/">août 2026</a>.</p>\n'
)

IMAGES = {
    "accor": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/9/91/Palais_Omnisports_de_Paris-Bercy_02.jpg",
        "filename": "accor-arena-bercy.jpg",
        "title": "Accor Arena (Palais omnisports de Paris-Bercy)",
        "alt": "Façade de l’Accor Arena, anciennement Palais omnisports de Paris-Bercy, lieu de l’UFC Paris",
        "caption": "Accor Arena, Paris. Photo Vilacor, Wikimedia Commons, licence CC BY 4.0.",
        "mime": "image/jpeg",
    },
    "octagon": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/7/7a/UFC-Octagon-USMCPhoto.jpg",
        "filename": "ufc-octagon-usmc.jpg",
        "title": "Cage octogonale de MMA",
        "alt": "Cage octogonale de MMA vue de l’intérieur, photo du Corps des Marines des États-Unis",
        "caption": "Cage octogonale de MMA. Photo U.S. Marine Corps, domaine public (Wikimedia Commons).",
        "mime": "image/jpeg",
    },
    "plmma": {
        "url": "https://upload.wikimedia.org/wikipedia/commons/c/c3/PLMMA_Cage-Octagon_MMA.JPG",
        "filename": "plmma-cage-mma.jpg",
        "title": "Cage MMA en salle (PLMMA)",
        "alt": "Cage octogonale de MMA installée dans une salle de sport, illustration d’un club de MMA",
        "caption": "Cage MMA en salle (PLMMA, Pologne). Photo Tyka17, Wikimedia Commons, licence CC BY-SA 4.0.",
        "mime": "image/jpeg",
    },
}


def token():
    return base64.b64encode(f"{USER}:{PASS}".encode()).decode()


def json_headers():
    return {
        "Authorization": f"Basic {token()}",
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }


def req(method, url, data=None, extra_headers=None, raw_body=None, timeout=90):
    headers = json_headers()
    if extra_headers:
        headers.update(extra_headers)
    body = raw_body
    if data is not None:
        body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=timeout) as resp:
            raw = resp.read().decode("utf-8")
            return json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {e.code}\n{err[:2500]}") from e


def strip_comments(html: str) -> str:
    return re.sub(r"<!--.*?-->", "", html, flags=re.S).strip()


def meta_from_comment(html: str, key: str) -> str:
    m = re.search(rf"{re.escape(key)}:\s*(.+)", html)
    return m.group(1).strip() if m else ""


def figure(media, extra=""):
    src = media.get("source_url") or ""
    alt = (media.get("alt_text") or "").replace('"', "&quot;")
    cap = IMAGES_BY_ID.get(media["id"], {}).get("caption", "")
    if extra:
        cap = extra
    return (
        f'<figure><img src="{src}" alt="{alt}" />'
        f"<figcaption>{cap}</figcaption></figure>\n"
    )


IMAGES_BY_ID = {}


def ensure_category(name, slug):
    data = req("GET", f"{REST}/categories?{urllib.parse.urlencode({'slug': slug, 'per_page': 5})}")
    if data:
        print(f"cat exists {slug} id={data[0]['id']}")
        return data[0]["id"]
    created = req("POST", f"{REST}/categories", {"name": name, "slug": slug})
    print(f"cat created {slug} id={created['id']}")
    return created["id"]


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


def menu_has(title, menu_id):
    items = req("GET", f"{REST}/menu-items?{urllib.parse.urlencode({'menus': menu_id, 'per_page': 100})}")
    return any(title.lower() in (i.get("title") or {}).get("rendered", "").lower() for i in items)


def add_menu_item(menu_id, title, url, object_id, object_type):
    if menu_has(title, menu_id):
        print(f"menu {menu_id} has {title}")
        return
    out = req(
        "POST",
        f"{REST}/menu-items",
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


def download_images():
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    opener = urllib.request.build_opener()
    opener.addheaders = [("User-Agent", UA)]
    urllib.request.install_opener(opener)
    for key, info in IMAGES.items():
        dest = IMG_DIR / info["filename"]
        if dest.exists() and dest.stat().st_size > 10000:
            print(f"image cached {dest.name} {dest.stat().st_size}b")
            continue
        print(f"download {info['url']}")
        urllib.request.urlretrieve(info["url"], dest)
        print(f"saved {dest} {dest.stat().st_size}b")


def find_media_by_filename(filename):
    q = urllib.parse.urlencode({"search": filename.rsplit(".", 1)[0], "per_page": 20})
    data = req("GET", f"{REST}/media?{q}")
    for item in data or []:
        src = item.get("source_url") or ""
        slug = item.get("slug") or ""
        if filename.rsplit(".", 1)[0] in src or filename.rsplit(".", 1)[0] in slug:
            return item
    return None


def upload_image(key):
    info = IMAGES[key]
    existing = find_media_by_filename(info["filename"])
    if existing:
        print(f"media exists {key} id={existing['id']}")
        media = existing
    else:
        path = IMG_DIR / info["filename"]
        raw = path.read_bytes()
        extra = {
            "Content-Type": info["mime"],
            "Content-Disposition": f'attachment; filename="{info["filename"]}"',
            "Accept": "application/json",
        }
        extra.pop("Content-Type", None)
        headers = json_headers()
        headers["Content-Type"] = info["mime"]
        headers["Content-Disposition"] = f'attachment; filename="{info["filename"]}"'
        r = urllib.request.Request(f"{REST}/media", data=raw, headers=headers, method="POST")
        try:
            with urllib.request.urlopen(r, context=CTX, timeout=120) as resp:
                media = json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            err = e.read().decode("utf-8", errors="replace")
            raise SystemExit(f"upload {key} -> {e.code}\n{err[:2500]}") from e
        print(f"uploaded {key} id={media['id']} {media.get('source_url')}")
    req(
        "POST",
        f"{REST}/media/{media['id']}",
        {
            "title": info["title"],
            "alt_text": info["alt"],
            "caption": info["caption"],
            "description": info["caption"],
        },
    )
    media = req("GET", f"{REST}/media/{media['id']}")
    IMAGES_BY_ID[media["id"]] = info
    return media


def publish_file(it, cats, featured=None, figure_media=None):
    raw = (DIR / it["file"]).read_text(encoding="utf-8")
    content = strip_comments(raw)
    if figure_media:
        content = figure(figure_media, IMAGES_BY_ID[figure_media["id"]]["caption"]) + content
    payload = {
        "title": meta_from_comment(raw, "Titre"),
        "slug": meta_from_comment(raw, "Slug"),
        "status": it.get("status", "publish"),
        "content": content,
        "comment_status": "open",
    }
    if it.get("cats"):
        payload["categories"] = [cats[c] for c in it["cats"]]
    if featured:
        payload["featured_media"] = featured["id"]
    yt, yd = meta_from_comment(raw, "Yoast title"), meta_from_comment(raw, "Yoast meta")
    if yt or yd:
        payload["meta"] = {}
        if yt:
            payload["meta"]["_yoast_wpseo_title"] = yt
        if yd:
            payload["meta"]["_yoast_wpseo_metadesc"] = yd
    return upsert(it["kind"], payload, payload["slug"])


def set_featured(kind, slug, media):
    node = find_by_slug(kind, slug)
    if not node:
        print(f"WARN missing {kind}/{slug}")
        return
    req("POST", f"{REST}/{kind}/{node['id']}", {"featured_media": media["id"]})
    print(f"featured {slug} <- {media['id']}")


def mark_old_portraits():
    slugs = [
        "portrait-ufc-john-jones",
        "portrait-ufc-jon-jones",
        "portrait-ufc-belal-muhammad",
        "portrait-ufc-llia-topuria",
        "portrait-ufc-ilia-topuria",
        "portrait-ufc-alexandre-pantoja",
        "portrait-ufc-dricus-du-plessis",
        "portrait-ufc-magomed-ankalaev",
        "portrait-ufc-islam-makhachev",
    ]
    for slug in slugs:
        node = find_by_slug("posts", slug)
        if not node:
            print(f"portrait skip (absent) {slug}")
            continue
        full = req("GET", f"{REST}/posts/{node['id']}?context=edit")
        raw = (full.get("content") or {}).get("raw") or ""
        if not raw.strip():
            print(f"portrait Elementor/empty {slug} id={node['id']}")
            continue
        if "ceinture périmée" in raw or "cette fiche date" in raw:
            print(f"portrait already noticed {slug}")
            continue
        req("POST", f"{REST}/posts/{node['id']}", {"content": NOTICE + raw})
        print(f"portrait notice {slug} id={node['id']}")


def purge_caches():
    try:
        req("DELETE", EL_CACHE)
        print("elementor cache DELETE ok")
    except SystemExit as e:
        print(f"elementor cache: {e}")
    req("POST", f"{REST}/pages/30", {"excerpt": "UFC Paris 2026 — Accor Arena. Média MMA indépendant."})
    print("homepage excerpt touched")


def main():
    download_images()
    accor = upload_image("accor")
    octagon = upload_image("octagon")
    plmma = upload_image("plmma")

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
        "interviews": ensure_category("Interviews", "interviews"),
    }

    items = [
        {
            "file": "22-classements-ufc.html",
            "kind": "pages",
            "object": "page",
            "cats": [],
            "feat": octagon,
            "fig": octagon,
        },
        {
            "file": "27-suivi-seo.html",
            "kind": "pages",
            "object": "page",
            "cats": [],
            "feat": None,
            "fig": None,
        },
        {
            "file": "06-page-clubs-mma-francais.html",
            "kind": "pages",
            "object": "page",
            "cats": [],
            "feat": plmma,
            "fig": plmma,
        },
        {
            "file": "02-ufc-paris-2026-carte.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "ufc", "ufc-paris-2026"],
            "feat": accor,
            "fig": None,
        },
        {
            "file": "10-modele-resultats-ufc-paris.html",
            "kind": "posts",
            "object": "post",
            "status": "draft",
            "cats": ["actualite", "ufc", "ufc-paris-2026", "resultats"],
            "feat": accor,
            "fig": None,
        },
        {
            "file": "23-coachs-cage-fight.html",
            "kind": "posts",
            "object": "post",
            "cats": ["clubs-mma-francais", "combattants"],
            "feat": plmma,
            "fig": plmma,
        },
        {
            "file": "24-unlock-paris.html",
            "kind": "posts",
            "object": "post",
            "cats": ["clubs-mma-francais", "actualite"],
            "feat": plmma,
            "fig": plmma,
        },
        {
            "file": "25-nrfight-paris.html",
            "kind": "posts",
            "object": "post",
            "cats": ["clubs-mma-francais", "actualite"],
            "feat": plmma,
            "fig": plmma,
        },
        {
            "file": "26-parnasse-citations.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "interviews", "ufc", "ufc-paris-2026"],
            "feat": accor,
            "fig": accor,
        },
        {
            "file": "28-santos-forfait.html",
            "kind": "posts",
            "object": "post",
            "cats": ["actualite", "ufc", "ufc-paris-2026"],
            "feat": accor,
            "fig": accor,
        },
    ]

    published = {}
    for it in items:
        out = publish_file(it, cats, featured=it.get("feat"), figure_media=it.get("fig"))
        published[out["slug"]] = out

    featured_map = [
        ("posts", "ufc-paris-2026-date-lieu-carte-enjeux", accor),
        ("posts", "ufc-paris-2026-carte-complete-hooker-parnasse", accor),
        ("posts", "ufc-paris-2026-combattants-francais", accor),
        ("posts", "ufc-paris-historique-accor-arena", accor),
        ("posts", "salahdine-parnasse-debuts-ufc-paris-2026", accor),
        ("posts", "ziam-vs-sola-ufc-paris-2026-enjeux", accor),
        ("posts", "cage-fight-toulouse-club-mma", plmma),
        ("posts", "ufc-shanghai-resultats", octagon),
        ("posts", "ufc-sacramento-resultats", octagon),
        ("pages", "champions-mma-actuels", octagon),
        ("pages", "a-propos", octagon),
    ]
    for kind, slug, media in featured_map:
        set_featured(kind, slug, media)

    for title, slug, obj in [
        ("Classements UFC", "classements-ufc-aout-2026", "page"),
        ("Interviews", "salahdine-parnasse-citations-ufc-paris", "post"),
    ]:
        node = published[slug]
        for menu_id in (4, 12):
            add_menu_item(menu_id, title, node["link"], node["id"], obj)

    mark_old_portraits()
    purge_caches()
    print("BATCH DONE")
    for slug, node in published.items():
        print(f"{node['status']:8} {node.get('link')}")


if __name__ == "__main__":
    main()

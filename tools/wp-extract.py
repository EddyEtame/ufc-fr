# -*- coding: utf-8 -*-
"""Aspiration complete du WordPress www.ufc.fr vers data/wp/.

Lecture seule, API REST publique, aucun identifiant. Le but est de detenir
localement 100 % du contenu avant que le WordPress soit debranche : articles,
pages, taxonomies, medias et fichiers binaires. Rien de ce script ne doit
survivre dans le site rendu — il sert une fois, a la migration.
"""
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

BASE = "https://www.ufc.fr/wp-json/wp/v2"
OUT = Path(__file__).resolve().parent.parent / "data" / "wp"
MEDIA_DIR = OUT / "media"
UA = "UFCFR-Migration/1.0 (+https://www.ufc.fr/; extraction avant refonte)"

# Les taxonomies et types qu'on veut integralement.
COLLECTIONS = ["posts", "pages", "categories", "tags", "media", "comments"]


def fetch(url, tries=4):
    """GET avec repli exponentiel — le WP est derriere Wordfence, on reste poli."""
    for attempt in range(tries):
        req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.loads(resp.read().decode("utf-8")), dict(resp.headers)
        except urllib.error.HTTPError as err:
            if err.code in (400, 401, 403, 404):
                return None, {"error": f"HTTP {err.code}"}
            wait = 2 ** attempt
            print(f"  HTTP {err.code} sur {url} — nouvelle tentative dans {wait}s")
            time.sleep(wait)
        except Exception as err:  # reseau, TLS, timeout
            wait = 2 ** attempt
            print(f"  {type(err).__name__} sur {url} — nouvelle tentative dans {wait}s")
            time.sleep(wait)
    return None, {"error": "epuise"}


def collect(name):
    """Pagine une collection entiere. `_embed` ramene auteur, image a la une et termes."""
    items, page = [], 1
    while True:
        url = f"{BASE}/{name}?per_page=100&page={page}&_embed=1"
        batch, headers = fetch(url)
        if not batch:
            break
        items.extend(batch)
        total_pages = int(headers.get("X-WP-TotalPages", 1) or 1)
        print(f"  {name}: page {page}/{total_pages} ({len(items)} cumules)")
        if page >= total_pages:
            break
        page += 1
        time.sleep(0.4)
    return items


def download_media(media_items):
    """Rapatrie les binaires. Le nom de fichier d'origine est conserve : les
    slugs WP sont deja propres et servent de cle de correspondance."""
    MEDIA_DIR.mkdir(parents=True, exist_ok=True)
    manifest, done, failed = [], 0, 0
    for item in media_items:
        src = item.get("source_url")
        if not src:
            continue
        name = os.path.basename(urllib.parse.urlparse(src).path)
        dest = MEDIA_DIR / name
        entry = {
            "id": item.get("id"),
            "slug": item.get("slug"),
            "source_url": src,
            "local": f"data/wp/media/{name}",
            "mime": item.get("mime_type"),
            "alt": (item.get("alt_text") or "").strip(),
            "title": (item.get("title") or {}).get("rendered", ""),
            "caption": (item.get("caption") or {}).get("rendered", ""),
            "media_details": {
                k: v for k, v in (item.get("media_details") or {}).items() if k in ("width", "height")
            },
        }
        manifest.append(entry)
        if dest.exists() and dest.stat().st_size > 0:
            done += 1
            continue
        try:
            req = urllib.request.Request(src, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=90) as resp, open(dest, "wb") as fh:
                fh.write(resp.read())
            done += 1
        except Exception as err:
            failed += 1
            entry["error"] = f"{type(err).__name__}"
            print(f"  media KO {name}: {err}")
        time.sleep(0.15)
    print(f"  medias: {done} recuperes, {failed} en echec")
    return manifest


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    summary = {}
    media_items = []

    for name in COLLECTIONS:
        print(f"[{name}]")
        items = collect(name)
        (OUT / f"{name}.json").write_text(
            json.dumps(items, ensure_ascii=False, indent=1), encoding="utf-8"
        )
        summary[name] = len(items)
        if name == "media":
            media_items = items

    # Les menus et reglages du theme ne sont pas exposes par l'API standard ;
    # on garde au moins l'identite du site telle que WP la declare.
    root, _ = fetch("https://www.ufc.fr/wp-json")
    if root:
        (OUT / "site.json").write_text(
            json.dumps(
                {k: root.get(k) for k in ("name", "description", "url", "home", "gmt_offset", "timezone_string")},
                ensure_ascii=False,
                indent=1,
            ),
            encoding="utf-8",
        )

    print("[media binaries]")
    manifest = download_media(media_items)
    (OUT / "media-manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    summary["media_files"] = len(manifest)
    (OUT / "extraction-summary.json").write_text(
        json.dumps({"source": BASE, "counts": summary, "at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())},
                   ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print("\n=== RESUME ===")
    for key, value in summary.items():
        print(f"  {key}: {value}")


if __name__ == "__main__":
    main()

# -*- coding: utf-8 -*-
"""Correct belt notices for fighters who still hold titles (31 Aug 2026)."""
import json
import os
import ssl
import urllib.request
import urllib.error

USER = "bc.combat31@gmail.com"
PASS = os.environ["WP_APP_PASS"]
REST = "https://www.ufc.fr/wp-json/wp/v2"
EL_CACHE = "https://www.ufc.fr/wp-json/elementor/v1/cache"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"

# Still listed as champions on /champions-mma-actuels/ as of 31 Aug 2026
STILL_CHAMP = {
    3313: "Valentina Shevchenko est toujours championne UFC des mouches féminins (depuis sept. 2024).",
    4590: "Yuya Wakamatsu est listé champion ONE des mouches (août 2026, ESPN).",
    4568: "Xiong Jing Nan est listée championne ONE des pailles féminines (août 2026).",
    4542: "Tang Kai est listé champion ONE des plumes (août 2026, ESPN).",
    4513: "Oumar Kane est listé champion ONE des lourds (août 2026, ESPN).",
    4484: "Joshua Pacio est listé champion ONE des pailles (août 2026).",
    4448: "Denice Zamboanga est listée championne ONE atomweight (août 2026).",
    4421: "Christian Lee est listé champion ONE welters et légers (août 2026, ESPN).",
    4397: "Anatoly Malykhin est listé champion ONE mi-lourds et moyens (août 2026, ESPN).",
    4325: "Jady Menezes est listée championne ARES des mouches féminins.",
    4312: "Aboubakar Younousov est listé champion ARES des coqs.",
    4187: "Virgil Augen est listé champion ARES des moyens.",
    4140: "Harry Hardwick est listé champion Cage Warriors des plumes.",
    4054: "Dario Bellandi est listé champion Cage Warriors des moyens.",
    3743: "Phil De Fries est listé champion KSW des lourds.",
    3691: "Paweł Pawlak est listé champion KSW des moyens.",
}


def token():
    import base64

    return base64.b64encode(f"{USER}:{PASS}".encode()).decode()


def req(method, url, data=None):
    import json as _json

    headers = {
        "Authorization": f"Basic {token()}",
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = None if data is None else _json.dumps(data, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(r, context=CTX, timeout=90) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            if raw.strip()[0] in "[{":
                return _json.loads(raw)
            return raw
    except urllib.error.HTTPError as e:
        err = e.read().decode("utf-8", errors="replace")
        raise SystemExit(f"{method} {url} -> {e.code}\n{err[:1500]}") from e


def rewrite_editor(obj, new_html):
    n = 0
    if isinstance(obj, list):
        for x in obj:
            n += rewrite_editor(x, new_html)
    elif isinstance(obj, dict):
        s = obj.get("settings") or {}
        if obj.get("widgetType") == "text-editor" and isinstance(s.get("editor"), str):
            if "ceinture / statut périmé" in s["editor"] or "Toujours titulaire" in s["editor"]:
                s["editor"] = new_html
                n += 1
        n += rewrite_editor(obj.get("elements") or [], new_html)
    return n


def html_for(sentence):
    return (
        "<p><strong>Mise à jour 31 août 2026 — statut titre.</strong> "
        f"{sentence} "
        "Fiche de parcours 2025 : relire les faits récents. "
        'Titres : <a href="/champions-mma-actuels/">Champions MMA actuels</a>.</p>'
    )


def main():
    for pid, sentence in STILL_CHAMP.items():
        node = req("GET", f"{REST}/posts/{pid}?context=edit")
        raw = (node.get("meta") or {}).get("_elementor_data")
        if not isinstance(raw, str) or not raw:
            print(f"skip {pid} no elementor")
            continue
        tree = json.loads(raw)
        n = rewrite_editor(tree, html_for(sentence))
        if not n:
            print(f"WARN no editor rewrite {pid} {node.get('slug')}")
            continue
        req(
            "POST",
            f"{REST}/posts/{pid}",
            {
                "meta": {
                    "_elementor_data": json.dumps(tree, ensure_ascii=False, separators=(",", ":")),
                    "_elementor_edit_mode": "builder",
                }
            },
        )
        print(f"corrected {pid} {node.get('slug')} n={n}")

    # leftover hexagone / pfl portraits without notice
    import urllib.parse

    leftovers = []
    for cat in (33, 34, 35, 36, 37, 38):
        q = urllib.parse.urlencode(
            {"categories": cat, "per_page": 100, "status": "publish", "_fields": "id,slug"}
        )
        leftovers.extend(req("GET", f"{REST}/posts?{q}") or [])
    q = urllib.parse.urlencode(
        {"search": "portrait-hexagone", "per_page": 100, "status": "publish", "_fields": "id,slug"}
    )
    leftovers.extend(req("GET", f"{REST}/posts?{q}") or [])
    seen = set()
    for p in leftovers:
        pid, slug = p["id"], p.get("slug") or ""
        if pid in seen or pid in STILL_CHAMP:
            continue
        seen.add(pid)
        if "portrait" not in slug:
            continue
        node = req("GET", f"{REST}/posts/{pid}?context=edit")
        raw = (node.get("meta") or {}).get("_elementor_data") or ""
        if "ceinture / statut" in raw or "statut titre" in raw:
            print(f"ok already {pid} {slug}")
            continue
        if not raw:
            print(f"no el {pid} {slug}")
            continue
        print(f"UNPATCHED {pid} {slug}")

    try:
        req("DELETE", EL_CACHE)
        print("cache ok")
    except SystemExit as e:
        print("cache", e)
    req("POST", f"{REST}/pages/30", {"excerpt": "UFC Paris 2026 — Accor Arena. Média MMA indépendant."})


if __name__ == "__main__":
    main()

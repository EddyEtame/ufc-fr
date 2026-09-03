# -*- coding: utf-8 -*-
"""Met à jour la page privée /veille-mma-quotidienne/ (file éditoriale)."""
import json
import os
import ssl
import time
import urllib.request
import base64
from datetime import datetime

# L'identifiant de publication ne vit pas dans le code. Il etait ecrit en
# dur dans huit fichiers d'un depot public : le mot de passe etait bien en
# variable d'environnement, mais un identifiant admin valide, indexe, est
# la moitie du travail donnee a qui veut entrer. Les deux se lisent
# desormais dans l'environnement.
USER = os.environ["WP_USER"]
PASS = os.environ["WP_APP_PASS"]
REST = "https://www.ufc.fr/wp-json/wp/v2"
CTX = ssl.create_default_context()
UA = "UFCFR-COM-Agent/1.0 (https://www.ufc.fr/; editorial MMA media)"


def req(method, url, data=None):
    token = base64.b64encode(f"{USER}:{PASS}".encode()).decode()
    h = {
        "Authorization": f"Basic {token}",
        "User-Agent": UA,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    body = None if data is None else json.dumps(data, ensure_ascii=False).encode()
    r = urllib.request.Request(url, data=body, headers=h, method=method)
    with urllib.request.urlopen(r, context=CTX, timeout=60) as resp:
        raw = resp.read().decode()
        return json.loads(raw) if raw.strip()[:1] in "[{" else raw


def main():
    now = datetime.now().strftime("%Y-%m-%d %H:%M")
    html = f"""
<p>Veille régénérée le <strong>{now}</strong> par veille_mma.py. Relire avant toute publication.</p>
<ol>
<li>Carte UFC Paris — Wood / remplaçant Santos.</li>
<li>Pesée — uniquement le 4 septembre si chiffres officiels.</li>
<li>Brouillon résultats — post 4827, nuit du 5.</li>
<li>Citations FR — La Sueur, ActuMMA, Helwani.</li>
<li>Hexagone Rouen 12/09 — affiche officielle.</li>
<li>KSW — ceintures Parnasse après Bercy.</li>
</ol>
<p>Sources : ufc.com/rankings, actumma.com, lasueur.com, hexagonemma.fr, wikipedia UFC rankings.</p>
"""
    found = req("GET", REST + "/pages?slug=veille-mma-quotidienne&status=any")
    payload = {
        "title": "Veille MMA — file opérationnelle (interne)",
        "slug": "veille-mma-quotidienne",
        "status": "private",
        "content": html,
    }
    if found:
        req("POST", f"{REST}/pages/{found[0]['id']}", payload)
        print("updated", found[0]["id"])
    else:
        out = req("POST", REST + "/pages", payload)
        print("created", out.get("id"))


if __name__ == "__main__":
    main()

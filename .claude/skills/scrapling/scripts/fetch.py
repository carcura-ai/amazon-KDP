#!/usr/bin/env python3
"""Webseiten mit Scrapling abrufen - eine Seite oder eine ganze Website mit Unterseiten.

Aufruf:
  python3 fetch.py <URL>                   # eine Seite als Text (Markdown-nah)
  python3 fetch.py <URL> --crawl 30        # bis zu 30 Unterseiten derselben Domain
  python3 fetch.py <URL> --out ordner      # Ergebnis zusaetzlich als Dateien speichern
  python3 fetch.py <URL> --browser         # JavaScript-Seiten ueber Chromium rendern

Grundsaetze: robots.txt wird beachtet, hoechstens eine Anfrage pro Sekunde,
nur dieselbe Domain beim Crawlen, keine Anmeldedaten, kein Umgehen von Logins
oder Bezahlschranken. Proxy und CA-Bundle der Umgebung werden genutzt.
"""
import argparse
import os
import re
import sys
import time
import urllib.robotparser
from urllib.parse import urljoin, urldefrag, urlparse

CA = "/root/.ccr/ca-bundle.crt"
UA = "Mozilla/5.0 (compatible; CarcuraResearch/1.0)"


def proxy_for(url):
    host = urlparse(url).hostname or ""
    no_proxy = [h.strip().lstrip("*.").lstrip(".") for h in (os.environ.get("NO_PROXY") or os.environ.get("no_proxy") or "").split(",") if h.strip()]
    if any(host == h or host.endswith("." + h) for h in no_proxy):
        return None
    return os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")


def get(url, browser=False):
    if browser:
        from scrapling.fetchers import DynamicFetcher
        return DynamicFetcher.fetch(url, headless=True, network_idle=True, proxy=proxy_for(url))
    from scrapling.fetchers import Fetcher
    kwargs = {"timeout": 30, "stealthy_headers": True}
    p = proxy_for(url)
    if p:
        kwargs["proxy"] = p
    if os.path.exists(CA):
        kwargs["verify"] = CA
    return Fetcher.get(url, **kwargs)


def text_of(page):
    for sel in ["script", "style", "noscript", "svg"]:
        for el in page.css(sel):
            try:
                el.remove() if hasattr(el, "remove") else None
            except Exception:
                pass
    title = (page.css("title::text").get() or "").strip()
    parts = []
    for el in page.css("h1, h2, h3, h4, p, li, td, th, blockquote, a[href^='tel:'], a[href^='mailto:']"):
        t = re.sub(r"\s+", " ", el.get_all_text(strip=True) if hasattr(el, "get_all_text") else str(el.text or "")).strip()
        if not t:
            continue
        tag = getattr(el, "tag", "")
        if tag in ("h1", "h2", "h3", "h4"):
            parts.append("\n" + "#" * int(tag[1]) + " " + t)
        elif tag == "li":
            parts.append("- " + t)
        else:
            parts.append(t)
    out, seen = [], set()
    for line in parts:  # Dubletten (verschachtelte Elemente) entfernen
        if line not in seen:
            seen.add(line)
            out.append(line)
    return title, "\n".join(out).strip()


def links_of(page, base, domain):
    found = []
    for href in page.css("a::attr(href)").getall():
        url = urldefrag(urljoin(base, href))[0]
        u = urlparse(url)
        if u.scheme in ("http", "https") and u.hostname == domain and not re.search(r"\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|mov|css|js)$", u.path, re.I):
            found.append(url)
    return found


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("url")
    ap.add_argument("--crawl", type=int, default=0, help="maximale Anzahl Seiten derselben Domain")
    ap.add_argument("--out", default="", help="Ordner fuer die Ergebnisdateien")
    ap.add_argument("--browser", action="store_true", help="mit Chromium rendern (JavaScript-Seiten)")
    ap.add_argument("--ignore-robots", action="store_true", help="nur fuer eigene Websites")
    a = ap.parse_args()

    start = a.url if "://" in a.url else "https://" + a.url
    domain = urlparse(start).hostname
    robots = urllib.robotparser.RobotFileParser()
    if not a.ignore_robots:
        try:
            rp = get(urljoin(start, "/robots.txt"))
            robots.parse((rp.body.decode("utf-8", "ignore") if isinstance(rp.body, bytes) else str(rp.body)).splitlines() if rp.status == 200 else [])
        except Exception:
            robots.parse([])
    else:
        robots.parse([])

    limit = max(1, a.crawl)
    queue, done = [start], []
    while queue and len(done) < limit:
        url = queue.pop(0)
        if url in done:
            continue
        if not robots.can_fetch(UA, url):
            print(f"[robots.txt verbietet] {url}", file=sys.stderr)
            done.append(url)
            continue
        try:
            page = get(url, a.browser)
        except Exception as e:
            print(f"[Fehler] {url}: {type(e).__name__}: {str(e)[:200]}", file=sys.stderr)
            if "CONNECT tunnel failed" in str(e) or "403" in str(e):
                print("Hinweis: Die Netzwerk-Sperre der Umgebung blockiert diese Domain. "
                      "Freigabe: Cloud-Umgebung -> Bearbeiten -> Netzwerkzugriff.", file=sys.stderr)
            done.append(url)
            continue
        done.append(url)
        title, body = text_of(page)
        block = f"\n\n==== {url} (HTTP {page.status}) ====\n# {title}\n{body}\n"
        print(block)
        if a.out:
            os.makedirs(a.out, exist_ok=True)
            name = re.sub(r"[^a-z0-9]+", "-", (urlparse(url).path or "start").lower()).strip("-") or "start"
            with open(os.path.join(a.out, f"{name}.md"), "w", encoding="utf-8") as f:
                f.write(block)
        if a.crawl:
            for link in links_of(page, url, domain):
                if link not in done and link not in queue:
                    queue.append(link)
            time.sleep(1)


if __name__ == "__main__":
    main()

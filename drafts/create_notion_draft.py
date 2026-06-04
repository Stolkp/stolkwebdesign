#!/usr/bin/env python3
"""Plaatst de module-aankondiging als Notion-draft (Status=Draft) in de Blog drafts DB."""
import os, re, json, urllib.request

DB_ID = "36ff84f0-fafd-81d1-b3b0-e583e2b54227"
TOKEN = None
with open(os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")) as f:
    for line in f:
        if line.startswith("NOTION_API_KEY="):
            TOKEN = line.split("=", 1)[1].strip().strip('"').strip("'")
            break
assert TOKEN, "NOTION_API_KEY niet gevonden"

TITLE = "Vijf modules: beheer je website zelf, betaal alleen wat je gebruikt"
SLUG = "stolkwebdesign-modules-beheer-je-site-zelf"
EXCERPT = ("Je website hoeft geen momentopname te zijn die langzaam veroudert. Met vijf losse "
           "modules bovenop je site beheer je content, facturen, social en SEO helemaal zelf "
           "— zonder WordPress.")
TOPIC = "tooling"

BLOCKS = [
    ("p", "De meeste websites zijn prachtig op de dag van oplevering. En daarna bevriezen ze."),
    ("p", "Een tekst die niet meer klopt. Een foto die je wilt vervangen. Een factuur die de deur uit moet. Bij de meeste bureaus betekent dat: een mailtje, wachten, en betalen per wijziging. De site is van jou — maar je kunt er niks mee."),
    ("p", "Daarom bouwde ik er iets bovenop. Geen zwaar systeem dat je moet onderhouden, maar vijf losse modules die van je website een gereedschap maken. Je neemt ze af wanneer je ze nodig hebt, en je betaalt alleen voor wat je gebruikt."),
    ("h2", "Eén fundering, daarna kies je zelf"),
    ("p", "Alles draait op één basis: het **Basis CMS** — een beveiligd beheerpaneel met login, bovenop je eigen site. Dat is de fundering. **€149, eenmalig, één keer per klant.** Geen abonnement, geen dubbel betalen. Daarna stapel je erop wat je nodig hebt."),
    ("h2", "De vijf modules"),
    ("p", "**01 · Content — €99 voor je homepage, €49 per extra pagina.** De teksten en foto's op je site, zelf aanpassen. Geen mailtje meer voor een typefout of een nieuwe prijs. Foto's worden automatisch gecomprimeerd, zodat je pagina snel blijft."),
    ("p", "**02 · Factuur-tool — €199.** Facturen opstellen en als PDF versturen, rechtstreeks vanuit je dashboard. Geen los boekhoudpakket nodig voor de simpele dingen."),
    ("p", "**03 · Social Campagnes — €99, plus €149 per campagne.** Schrijf je social posts, keur ze goed en laat ze in vier kant-en-klare formaten genereren: Instagram, LinkedIn, Google en Story. Eén keer invullen, vier beelden eruit."),
    ("p", "**04 · SEO-rapport — €99, plus per actiepunt.** Je vindbaarheid en concrete verbeterpunten op één plek, in een eigen klantportaal. Deze module staat los — je hebt er niet eens het Basis CMS voor nodig."),
    ("p", "**05 · Blog — €99, plus €89 per artikel.** (vanaf Q3 2026) Publiceer artikelen die automatisch netjes op je site verschijnen, mét bijpassende social-slides. Deze lees je nu — geschreven met precies die module."),
    ("h2", "Hoe het werkt — zonder WordPress"),
    ("p", "De truc zit in de combinatie: een statische site (snel, veilig, geen plugin-onderhoud) met **Supabase** als backend eronder. De publieke pagina's blijven kant-en-klare HTML — goed voor Google, pijlsnel voor bezoekers. Maar de teksten, foto's en posts worden overschreven met wat jij in je dashboard invult."),
    ("p", "Inloggen en beveiliging regelen we met Supabase Auth en row-level security: een bezoeker kan alleen lezen, jij beheert alleen je eigen content, en niemand komt bij iets waar hij niet hoort. Geen server om te onderhouden, geen nachtelijke updates die kapotgaan."),
    ("h2", "In de praktijk"),
    ("p", "Het werkt. Een juridisch adviesbureau uit Uithoorn draait er al op: teksten, foto's, facturen én social posts — allemaal in eigen beheer, op een handgebouwde site zonder een grammetje WordPress. De eigenaar is van niemand meer afhankelijk om haar site bij te houden."),
    ("h2", "Voor wie dit is"),
    ("p", "Voor iedereen die zijn website niet als momentopname wil, maar als gereedschap dat meegroeit met de zaak. Je begint met de fundering en breidt uit wanneer het nodig is — nooit meer, nooit minder."),
    ("p", "Bekijk alle modules op [stolkwebdesign.nl/modules](https://stolkwebdesign.nl/modules) of plan een gesprek via [cal.com/peter-stolk](https://cal.com/peter-stolk)."),
]

LINK_RE = re.compile(r"\[([^\]]+)\]\(([^)]+)\)")
BOLD_RE = re.compile(r"(\*\*[^*]+\*\*)")

def parse_bold(text):
    out = []
    for part in BOLD_RE.split(text):
        if not part:
            continue
        if part.startswith("**") and part.endswith("**"):
            out.append({"type": "text", "text": {"content": part[2:-2]}, "annotations": {"bold": True}})
        else:
            out.append({"type": "text", "text": {"content": part}})
    return out

def parse_inline(text):
    tokens, pos = [], 0
    for m in LINK_RE.finditer(text):
        if m.start() > pos:
            tokens.extend(parse_bold(text[pos:m.start()]))
        tokens.append({"type": "text", "text": {"content": m.group(1), "link": {"url": m.group(2)}}})
        pos = m.end()
    if pos < len(text):
        tokens.extend(parse_bold(text[pos:]))
    return tokens

def make_block(kind, text):
    rt = parse_inline(text)
    btype = "heading_2" if kind == "h2" else "paragraph"
    return {"object": "block", "type": btype, btype: {"rich_text": rt}}

payload = {
    "parent": {"database_id": DB_ID},
    "properties": {
        "Title": {"title": [{"text": {"content": TITLE}}]},
        "Slug": {"rich_text": [{"text": {"content": SLUG}}]},
        "Excerpt": {"rich_text": [{"text": {"content": EXCERPT}}]},
        "Topic": {"select": {"name": TOPIC}},
        "Status": {"select": {"name": "Draft"}},
    },
    "children": [make_block(k, t) for k, t in BLOCKS],
}

req = urllib.request.Request(
    "https://api.notion.com/v1/pages",
    data=json.dumps(payload).encode("utf-8"),
    headers={
        "Authorization": f"Bearer {TOKEN}",
        "Notion-Version": "2022-06-28",
        "Content-Type": "application/json",
    },
    method="POST",
)
try:
    with urllib.request.urlopen(req) as r:
        res = json.load(r)
    print("OK  page_id:", res.get("id"))
    print("URL:", res.get("url"))
    print("Status: Draft  |  Slug:", SLUG, " |  Topic:", TOPIC)
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:600])

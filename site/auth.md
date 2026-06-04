# Agent-registratie & contact — Stolkwebdesign

Dit document vertelt AI-agents hoe ze met deze site mogen omgaan.

## Authenticatie-houding
Deze site is **publiek**. Alle inhoud en de discovery-endpoints onder
`/.well-known/*` zijn **anoniem en read-only**. Er is geen beschermde API en
**registratie is niet nodig**. We geven geen API-sleutels of OAuth-credentials uit
voor deze site.

## Hoe een agent zich hoort te identificeren
Stuur een beschrijvende `User-Agent` (naam van je agent/product en een contact-URL).
Wees een goede gast: respecteer `robots.txt` en de `Content-Signal`-regels
(`search=yes, ai-input=yes, ai-train=no`) en houd het aantal verzoeken redelijk.

## Contact
- E-mail: info@stolkwebdesign.nl
- WhatsApp: https://wa.me/31650222228
- Contactpagina: https://www.stolkwebdesign.nl/contact

## Capaciteiten
Zie de [Agent Skills index](/.well-known/agent-skills/index.json) en de
[API catalog](/.well-known/api-catalog).

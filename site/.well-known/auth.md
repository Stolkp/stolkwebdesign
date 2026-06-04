# auth.md — Agent registration & contact (Stolkwebdesign)

This document describes how AI agents should register, authenticate and identify
themselves when interacting with this site.

## Authentication posture
This site is **public**. All content and the discovery endpoints under
`/.well-known/*` are **anonymous and read-only**. There is no protected API, so
**no agent registration, API key or OAuth credential is required** to access
anything here.

## Agent registration
No registration is needed. Agents may access the public content and discovery
files directly. We do not issue API keys, client credentials, or OAuth tokens for
this site, and there is no `register_uri`, because there is no protected resource.

## How an agent should identify itself
Send a descriptive `User-Agent` containing your agent/product name and a contact
URL. Respect `robots.txt` and the `Content-Signal` directives
(`search=yes, ai-input=yes, ai-train=no`) and keep request rates reasonable.

## Contact
- Email: info@stolkwebdesign.nl
- WhatsApp: https://wa.me/31650222228
- Contact page: https://www.stolkwebdesign.nl/contact

## Capabilities
See the [Agent Skills index](/.well-known/agent-skills/index.json) and the
[API catalog](/.well-known/api-catalog).

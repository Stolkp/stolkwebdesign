# Module Wachtlijst → Notion (deploy-stappen)

End-to-end: bezoeker vult wachtlijst-modal in op `/modules.html` → Supabase INSERT in `stolkwebdesign_module_waitlist` → Database Webhook fired → Edge Function `waitlist-to-notion` → Notion-pagina aangemaakt in **Klantverzoeken** met `Type Verzoek = "Module wachtlijst"`.

Hergebruikt de bestaande Notion-integratie + database van Stolksupport's contactformulier (zie `Projecten/Stolksupport/site/api/contact.js`).

---

## 1. Edge Function deployen

Vereist Supabase CLI (eenmalig: `brew install supabase/tap/supabase`).

```bash
cd "Projecten/Stolkwebdesign"

# Eenmalig (als nog niet gedaan):
supabase login
supabase link --project-ref lkcfwndigzhzcjnhxcmb

# Deploy de function:
supabase functions deploy waitlist-to-notion
```

Verwachte output: `Deployed function waitlist-to-notion`. De function staat dan op:
`https://lkcfwndigzhzcjnhxcmb.supabase.co/functions/v1/waitlist-to-notion`

## 2. Secrets zetten

```bash
supabase secrets set \
  NOTION_API_KEY="secret_xxxxxxxxxxxxxxxxxx" \
  NOTION_DATABASE_ID="xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
```

Zelfde waardes als die Stolksupport gebruikt (uit Vercel env van project `stolksupport-site`). Vercel dashboard → stolksupport-site → Settings → Environment Variables.

## 3. Database Webhook configureren (Supabase dashboard)

1. Open: <https://supabase.com/dashboard/project/lkcfwndigzhzcjnhxcmb/database/hooks>
2. Klik **"Create a new hook"**
3. Vul in:
   - **Name**: `waitlist_to_notion`
   - **Table**: `stolkwebdesign_module_waitlist`
   - **Events**: `Insert` (uitvinken: Update, Delete)
   - **Type**: `Supabase Edge Functions`
   - **Edge Function**: `waitlist-to-notion`
   - **HTTP Method**: `POST`
   - **HTTP Headers**: leeg laten (Authorization wordt automatisch gezet)
4. **Create hook**

## 4. Notion: zorg dat de integratie schrijfrechten heeft

De Stolksupport-integratie heeft al toegang tot de Klantverzoeken DB. De Edge Function probeert een **nieuwe select-waarde "Module wachtlijst"** te schrijven op het `Type Verzoek` veld — Notion accepteert dit alleen als de integratie de capability `Update content` heeft.

Check via: Notion → Klantverzoeken database → `...` → "Connections" → de Stolksupport integratie → moet "Can edit content" hebben.

(Optioneel: voeg de select-waarde "Module wachtlijst" handmatig toe aan het `Type Verzoek` veld in Notion, dan hoeft de integratie niet eens edit-rights te hebben.)

## 5. Test

**End-to-end test:**
1. Open <https://www.stolkwebdesign.nl/modules.html> (of lokaal via `python3 -m http.server`)
2. Klik op een module-card → "Op de wachtlijst"
3. Vul testdata in (gebruik je echte email of `test+wl@stolkwebdesign.nl`)
4. Submit → modal toont succes
5. Check Notion → **Klantverzoeken** database → er staat een nieuwe rij met:
   - Naam = ingevulde naam (of email als geen naam)
   - Type Verzoek = `Module wachtlijst`
   - Beschrijving = email + bedrijf + modules + bron + eventuele notitie

**Debug-tools bij problemen:**

| Probleem | Check |
|---|---|
| Geen Notion-rij | Supabase Logs → Edge Functions → `waitlist-to-notion` → laatste invocations |
| Webhook fired niet | Supabase Logs → Database → Webhook history voor `waitlist_to_notion` |
| `Type Verzoek` faalt | Notion: voeg "Module wachtlijst" handmatig toe als select-optie in Klantverzoeken |
| 401/403 van Notion | Check `supabase secrets list` → NOTION_API_KEY moet matchen met Stolksupport |
| 500 zonder log | `supabase functions logs waitlist-to-notion --tail` (live log streaming) |

## 6. Wat er in Supabase blijft staan

De rij blijft in `stolkwebdesign_module_waitlist` staan, ook na succesvolle Notion-push. Dit is bewust:
- **Backup**: als Notion later verandert, behoud je de raw data
- **Reporting**: SQL-queries voor wachtlijst-stats (modules-frequentie, signups-per-week) draaien op Supabase, niet op Notion
- **Idempotent**: webhook retry's krijgen de bestaande Supabase-rij — geen dubbele inserts

Eventueel later: kolom `notion_page_id` toevoegen aan de waitlist-tabel zodat we kunnen tracken welke rijen al naar Notion zijn gepushed. Niet nodig voor MVP.

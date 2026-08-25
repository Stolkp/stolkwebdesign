# Blogpost-concept: gevonden worden door AI

Status: **concept.** Klaar om in het admin-paneel te plakken. Niets staat in de database.

- **slug:** `ai-citeerde-onze-oude-prijzen`
- **topic:** `mkb`
- **excerpt:** Onze eigen site vertelde ChatGPT maandenlang prijzen die we al een half jaar niet meer voerden. We merkten het niet, want dat bestand leest niemand met het oog. Wat er misging en hoe je het bij jezelf controleert.
- **hero:** nog kiezen

---

## AI citeerde maandenlang onze oude prijzen

Op een maandag in augustus liep ik de eigen site na op iets nieuws: kan een AI-antwoordmachine er eigenlijk wel wat mee? Steeds meer mensen stellen hun vraag aan ChatGPT of aan de AI-antwoorden bovenaan Google, en klikken daarna niet meer door naar een lijstje links.

De uitkomst was ongemakkelijk. Op de site stonden pakketten van €1.250, €2.250 en €3.500. In het bestand dat AI het liefst leest stond nog €950, €1.500 en €2.450.

Dat verschil is niet klein. Wie op dat moment aan een taalmodel vroeg wat een website bij ons kost, kreeg bedragen te horen die tot dertig procent onder onze werkelijke prijs lagen. Een half jaar lang, zonder dat iemand het zag.

## Waarom niemand dat merkt

Er staat op elke moderne site een laag die niet voor mensen bedoeld is. Een `llms.txt` waarin in gewone taal staat wie je bent en wat je doet. Blokjes structured data die letterlijk vertellen wat je verkoopt en wat het kost. Een `robots.txt` waarin staat wat automatische bezoekers mogen.

Je bezoeker ziet daar niets van. Jij ook niet, want je opent die bestanden nooit. Ze worden één keer met de hand geschreven bij de bouw, en daarna verandert de site wel en dat bestand niet.

Bij ons was het erger dan alleen prijzen. Er stond een uurtarief in dat nergens meer op de site voorkwam. Er stond een link naar een pagina die een 404 gaf. En op de Engelse versie was per ongeluk een stukje URL aan het e-mailadres geplakt, waardoor de mailknop een ongeldig adres opende. Allemaal dingen die je pas ziet als je ze meet.

## Wat we eraan gedaan hebben

De echte oplossing was niet de bestanden bijwerken. Dat lost het één keer op, en over drie maanden staat er weer iets ouds.

We hebben ze uit één bron laten genereren. Alle prijzen, diensten en pagina's staan nu in één bestand, en bij elke publicatie worden `llms.txt` en de structured data daaruit opgebouwd. Daar zit een slot op: verandert er een prijs op de site zonder dat die bron is bijgewerkt, dan stopt de publicatie met een foutmelding. Je kúnt niet meer per ongeluk oude bedragen naar buiten sturen.

Dezelfde controle draait nu maandelijks over alle sites die we beheren. Bij één klantsite bleek dat een crawler helemaal geen inhoud kreeg: de site bouwde zich pas op in de browser van de bezoeker, en dat is een stap die zoekmachines en AI-antwoordmachines meestal niet zetten. Voor een bezoeker was de site compleet, voor een antwoordmachine een lege pagina.

## Hoe je dit bij jezelf controleert

Drie dingen, en je hebt er geen tools voor nodig.

**Open jouwsite.nl/llms.txt in je browser.** Krijg je een foutmelding, dan bestaat het bestand niet en moet een model alles uit je opmaak afleiden. Staat er wel iets, lees het dan door alsof je een klant bent. Klopt het nog?

**Open jouwsite.nl/robots.txt.** Staat daar niets over GPTBot, ClaudeBot of PerplexityBot, dan heb je nooit vastgelegd wat AI met je inhoud mag. Je kunt aangeven dat citeren prima is en trainen niet.

**Kijk naar je paginabron.** Rechtermuisknop, "paginabron weergeven", en zoek dan met ctrl-F een zin uit je eigen tekst. Vind je hem niet, dan ziet een crawler die zin ook niet, en dan bestaat je hele pagina niet voor een antwoordmachine.

## Wat het oplevert

Eerlijk zijn over de cijfers hoort erbij: we werden op het moment van meten in nul Nederlandse AI-antwoorden genoemd. Nul. Dat is precies waarom we nu meten in plaats van vermoeden. Er ligt een nulmeting, en over drie maanden weten we of het bewoog.

Wat we intussen wel zeker weten: we vertellen AI nu geen prijzen meer die we niet voeren. Dat is geen marketing, dat is een lek dat dicht is.

---

Wil je weten hoe jouw site ervoor staat? De module [Gevonden worden door AI](/modules#aeo) is een scan met een score, de inrichting die eruit volgt, en maandelijkse hermeting. €199 eenmalig, daarna €29 per maand.

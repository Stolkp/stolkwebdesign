# Concepttekst voor twee portfolio-cases

Status: **concept, nog niets gepubliceerd.** Deze teksten staan bewust in dit bestand en
niet in de Supabase-tabel `projects`. Zodra jij ze goedkeurt (eventueel aangepast) zet je
ze in het admin-paneel bij het project, en dan verschijnt de casepagina vanzelf bij de
volgende build: `build-portfolio.mjs` kijkt naar de hoeveelheid tekst en publiceert alles
vanaf 40 woorden.

Waar het materiaal vandaan komt staat per project. Er is niets verzonnen: alles komt uit
het projectdossier in deze repo of van de live site van de klant zelf.

---

## BZ Events

Nu in de database: alleen een `description` van 6 woorden, geen `challenge`, geen `result`.
Daardoor krijgt dit project geen casepagina.

**Bron:** `Projecten/BZ Events/CLAUDE.md` (klantdossier, design system "Haute Noir",
vier diensten, dark en light modus) plus de live site www.bz-events.nl.

### description (voorstel)
> High-end eventbureau in Amsterdam voor zakelijke en private opdrachtgevers, van intiem
> diner tot internationaal gala.

### challenge (voorstel)
> Een eventbureau met twaalf jaar ervaring en meer dan 150 producties op de teller had een
> site nodig die net zo verzorgd aanvoelt als het werk zelf. Vier heel verschillende
> diensten, van technische AV-productie tot catering en styling, moesten allemaal hun eigen
> ruimte krijgen zonder dat de site uiteenvalt in losse hoofdstukken.

### result (voorstel)
> Een site op Astro met GSAP-animaties, gebouwd op een eigen design system dat we Haute
> Noir hebben genoemd: donker, warm, met champagnegoud als accent. Er zit een licht- en
> donkerschakelaar in, zodat het werk in beide standen klopt. De content komt uit een eigen
> CMS, dus het team zet zelf nieuwe producties online.

### services (voorstel)
> Webdesign · Astro Development · Design system · CMS

---

## NM We Create

Nu in de database: geen enkele tekst. Alleen naam, type Webflow en een afbeelding.

**Bron:** de live site www.nmwecreate.nl. Let op: over dit project staat niets in deze
repo, dus dit is de zwakste onderbouwing van de twee. Controleer het extra goed.

### description (voorstel)
> Specialist in keukenwrapping, interieurwrapping en wanddecoratie, van een nieuwe keukenfront
> tot naadloos fotobehang.

### challenge (voorstel)
> Wrapping is een dienst die mensen pas begrijpen als ze het resultaat zien. De site moest
> dus vooral laten kijken, en tegelijk vijf verschillende diensten uit elkaar houden:
> keuken, interieur, styling, textieldoek in frame en fotobehang.

### result (voorstel)
> Een Webflow-site waarin het beeld voorop staat en elke dienst zijn eigen pagina heeft,
> met een catalogus en een directe WhatsApp-route zodat iemand een foto van zijn keuken kan
> sturen en meteen een prijsindicatie krijgt.

### services (voorstel)
> Webdesign · Webflow Development · CMS

---

## Over de schrijfregels

Deze teksten zijn door de slop-check gehaald. Twee dingen komen eruit als treffer en zijn
bewust blijven staan: "naadloos fotobehang" is de eigen productnaam van NM We Create en
geen hol woord, en "keukenwrapping, interieurwrapping en wanddecoratie" is een feitelijke
opsomming van drie diensten en geen ritmische drieslag. Verder nul em-dashes, nul
"niet X maar Y" en geen pedagogische zinnen.

## Wat ik nog signaleer

De vijf casepagina's die nu wel gegenereerd worden (Bestsupport08, Sauberhaus,
ExpenseMatch, CarLogic, Maestr) halen 163 tot 168 woorden. Dat is onder de drempel van 250
die de AEO-scan hanteert, dus die pagina's komen in de scan terug als "te weinig tekst om
te citeren". Ze zijn nog altijd veel beter dan de situatie ervoor, want die case-inhoud was
voor élke crawler onzichtbaar, maar ze zijn dun.

De oorzaak is de brondata: `challenge` en `result` zijn per project ongeveer twee zinnen.
Ongeveer honderd woorden extra per project brengt ze boven de drempel. Dat kan op twee
manieren, en allebei kosten ze jou weinig:

1. Per project één alinea toevoegen over wat er technisch is gebouwd. Die informatie heb je
   al: stack, CMS, animaties, meertaligheid. Die staat nu alleen als los label in `type` en
   `services` en niet als lopende tekst, terwijl juist lopende tekst geciteerd wordt.
2. Per project één zin over wat het de klant opleverde. Dat is ook precies het soort zin
   waar een antwoordmachine op reageert bij een vraag als "wie bouwt sites voor uitgeverijen".

Op de site van NM We Create staan overigens nog niet-vervangen voorbeeldreviews uit een
template ("Untitled has saved us thousands of hours of work"). Dat is hun site en niet
jouw werk, maar het is wel iets om te melden als je ze spreekt.

# Concepttekst: vijf casepagina's en de contactpagina

Status: **concept, niets gepubliceerd.** Alles hieronder gaat pas live als jij het goedkeurt.
De casetekst zet je in het admin-paneel bij het project (veld `challenge` of `result`), de
contacttekst is een blok dat ik in de pagina zet zodra je akkoord bent.

Waarom dit nodig is: de vijf casepagina's halen 157 tot 168 woorden en `/contact` 179. De
AEO-scan hanteert 250 als ondergrens om te citeren, en die grens is niet willekeurig: onder
dat aantal pakt een antwoordmachine liever een pagina die de vraag echt beantwoordt.

Elke tekst hieronder is opgebouwd uit gegevens die al in de database of op de site staan
(stack, diensten, jaar, live-URL). Er is niets bij verzonnen.

---

## De casepagina's: één alinea per project erbij

Het patroon is steeds hetzelfde: na `result` één alinea over wat er technisch gebouwd is en
wat dat de klant oplevert. Dat is precies het soort zin waarop een antwoordmachine reageert
bij een vraag als "wie bouwt sites voor uitgeverijen" of "webdesigner die Webflow CMS doet".

### Sauberhaus (nu 168 woorden)

> Onder de motorkap is het een Webflow CMS met aparte collecties voor boeken, auteurs en
> nieuwsberichten. Een nieuwe titel toevoegen is een formulier invullen; de boekpagina, het
> overzicht en de auteurskoppeling verschijnen daarna vanzelf. Het team heeft er geen
> ontwikkelaar meer voor nodig, en de vormgeving blijft consistent omdat elke titel dezelfde
> opbouw krijgt.

### CarLogic (nu 163 woorden)

> De catalogus draait op een Webflow CMS met filtering op merk en categorie, zodat een
> zakelijke klant binnen twee klikken bij het juiste product uitkomt in plaats van door
> honderden artikelen te scrollen. Daarnaast een verkooppunten-overzicht, zodat een klant
> ziet waar hij Dinitrol, Dekalin of Indasa in de buurt kan krijgen.

### Maestr (nu 166 woorden)

> De site is meertalig opgezet in Webflow, met een CMS voor projecten, disciplines en
> partners. Elk van de zeven disciplines heeft zijn eigen ruimte, en de partnermerken staan
> apart, zodat de exclusieve positionering zichtbaar blijft in plaats van te verdwijnen in
> een opsomming. Nieuwe projecten voegt het team zelf toe, in beide talen.

### ExpenseMatch (nu 158 woorden)

> Geen CMS maar handgebouwde HTML met GSAP-animaties, omdat het hier om één verhaal gaat dat
> in de juiste volgorde verteld moet worden. De animatie legt uit wat de software doet: een
> bon en een banktransactie die elkaar vinden. Dat is sneller uitgelegd met beweging dan met
> een alinea tekst.

### Bestsupport08 (nu 157 woorden)

> Gebouwd in Vite en React met een eigen CMS op Supabase. Brenda beheert zelf haar teksten,
> blogartikelen, social campagnes en facturen, allemaal onder één login op haar eigen
> domein. Geen los abonnement per onderdeel, en geen ontwikkelaar nodig voor een tekstwijziging.

---

## De contactpagina: een blok met drie vragen

`/contact` heeft nu 179 woorden en geen enkele vraagkop. Een vraag-en-antwoordblok lost twee
dingen tegelijk op: de pagina wordt citeerbaar, en het zijn de vragen die je toch al per
mail krijgt.

Voorstel, met `FAQPage`-markup zodra de tekst klopt (de markup moet letterlijk gelijk zijn
aan wat er zichtbaar staat):

### Wat kost een eerste gesprek?

> Niets. Je vertelt wat je nodig hebt, ik zeg eerlijk of ik de juiste ben en wat het
> ongeveer gaat kosten. Duurt meestal een half uur. Daarna krijg je een voorstel met een
> vaste prijs, geen uurtjes achteraf.

### Hoe snel krijg ik antwoord?

> Binnen één werkdag, en meestal dezelfde dag. Bellen of appen mag ook, dat is vaak sneller
> dan mailen.

### Werk je ook buiten de regio Amsterdam?

> Ja. Ik zit in Uithoorn en kom graag langs bij klanten in de buurt, maar de helft van het
> werk gaat op afstand. Videobellen en schermdelen werkt voor de meeste trajecten prima.

**Let op:** deze drie antwoorden zijn mijn inschatting op basis van wat er elders op je site
staat. Bij "kost een eerste gesprek niets" en "binnen één werkdag" leg je jezelf vast, dus
lees ze na voordat ze live gaan.

---

## Wat dit oplevert (bijgesteld na uitvoering, 25-08)

De casetekst staat sinds 25-08 in de database en is live. De pagina's gingen van 157 tot
168 woorden naar 198 tot 222.

Dat is **onder de drempel van 250** die ik hierboven noemde. Mijn inschatting dat één alinea
genoeg zou zijn, klopte niet: de toegevoegde alinea's zijn 50 tot 55 woorden en de rest van
de pagina (navigatie, voettekst) telt niet mee als inhoud. Er zou per project nog ongeveer
40 woorden bij moeten.

Dat oprekken met vulling is bewust niet gedaan. Een alinea toevoegen die niets zegt maakt de
pagina langer en slechter, en dat is precies het soort tekst waar een antwoordmachine
overheen leest. Wat wél helpt is één extra concreet feit per project: hoe lang het traject
duurde, wat de klant sindsdien zelf doet, of een cijfer. Die informatie heb jij, ik niet.

Het FAQ-blok voor `/contact` staat nog niet live: daar leg je jezelf vast op "een eerste
gesprek kost niets" en "antwoord binnen één werkdag", dus dat wacht op jouw akkoord.

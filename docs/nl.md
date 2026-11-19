# Onbalansprijzen (Elia, TenneT)

## Wat de integratie doet

De onbalansprijs verrekent per kwartier het verschil tussen wat het
elektriciteitsnet had gepland en wat er echt gebeurde. Sommige dynamische
contracten in België en Nederland geven hem door aan hun klanten
(„onbalans“-contracten, thuisbatterijen die erop sturen). Deze integratie
brengt hem bijna realtime naar Gladys:

- **België**, via Elia Open Data: de prijs van het lopende kwartier, minuut
  per minuut geschat, en de definitieve waarde van elk afgesloten kwartier;
- **Nederland**, via de TenneT-API: een indicatieve prijs, elke minuut
  berekend uit de regelenergie die TenneT inzet.

Ze dekt alleen de onbalansprijs. Gebruik voor day-aheadprijzen (EPEX,
ENTSO-E) of het tarief van een leverancier de integraties die daarvoor
bestaan.

## Vereisten

- Gladys 5.3.0 of nieuwer.
- Internettoegang vanaf Gladys (opendata.elia.be, api.tennet.eu).
- Alleen voor Nederland: een gratis TenneT-API-sleutel. Registreer je op
  [developer.tennet.eu](https://developer.tennet.eu/register/) en maak daarna
  een sleutel aan in je account. België heeft geen account nodig.

## Installatie

1. Open in Gladys **Integraties → Installeren vanaf GitHub** (de interface van
   Gladys bestaat niet in het Nederlands: Integrations → Install from GitHub).
2. Vul `https://github.com/guim31/gladys-imbalance-prices` in en installeer.

## Configuratie

- **België (Elia)**: standaard aangevinkt.
- **TenneT-API-sleutel (Nederland)**: laat leeg om Nederland niet te volgen.
- **Taal van de namen**: taal van de namen van de functies en van de richting
  van de onbalans, vastgelegd bij het toevoegen van een apparaat (standaard
  Frans; Nederlands bestaat niet in Gladys, kies Engels).

Open daarna het tabblad **Discovery** en voeg de apparaten toe: één per zone.
De actie **Read the prices now** vraagt beide bronnen op en toont de prijs van
het lopende kwartier: handig om een nieuwe TenneT-sleutel te controleren.

## Apparaten

Elke zone is een apparaat met deze functies (namen in het Engels):

| Functie                             | Betekenis                                                  |
| ----------------------------------- | ---------------------------------------------------------- |
| Quarter-hour price (€/MWh)          | prijs van het lopende kwartier, elke minuut bijgewerkt     |
| Quarter-hour price (€/kWh)          | dezelfde, gedeeld door 1.000                               |
| Previous quarter-hour price (€/MWh) | prijs van het zojuist afgesloten kwartier                  |
| System imbalance (MW)               | positief: overschot in de zone; negatief: tekort           |
| Imbalance direction                 | Surplus, Shortage of Balanced                              |
| Current quarter-hour                | begin van het lopende kwartier, tijd van Brussel/Amsterdam |

Gladys kent geen eenheid €/MWh of MW: de namen van de functies dragen ze. Een
negatieve prijs betekent dat verbruiken in dat kwartier betaald wordt.

## Scènes

Twee triggers, in de categorie **Integrations** van de scène-editor:

- **The imbalance price turns negative**: de geschatte prijs van het lopende
  kwartier zakt onder 0 €/MWh.
- **The imbalance price rises above a threshold**: hij stijgt boven 100, 150,
  200, 300, 500 of 1.000 €/MWh.

Beide kunnen tot één zone beperkt worden (leeg: beide zones). Elke trigger
gaat af wanneer de prijs de grens overschrijdt, hoogstens één keer per
kwartier, en niet opnieuw zolang de prijs aan dezelfde kant blijft. De
volgende acties kunnen `{{triggerEvent.data.price}}` (€/MWh), `price_kwh`,
`zone` en `quarter_hour` lezen. Gebruik de trigger van het apparaat zelf
(„Quarter-hour price (€/MWh) ≥ 0“) om een toestel te stoppen wanneer de prijs
weer stijgt.

## Dashboard

De widget **Imbalance prices** toont per zone de prijs van het lopende en het
vorige kwartier, de systeemonbalans en de curve van de dag (te verbergen in de
instellingen van de widget).

## Gegevensbronnen en grenzen

- **Elia**: datasets `ods161` (per minuut) en `ods162` (per kwartier) van
  [Elia Open Data](https://opendata.elia.be), elke minuut gelezen, plus één
  keer per kwartier voor de afgesloten kwartieren. De lopende waarde is een
  schatting over de verstreken minuten; die van minuut 14 is de gepubliceerde.
  Elia markeert deze gegevens als „niet gevalideerd“: de verrekende prijs kan
  nog veranderen.
- **TenneT**: „Balance Delta High Res“ (`/latest`), elke minuut gelezen (fair
  use: hoogstens 10 per minuut). De prijs volgt de regeltoestand van TenneT:
  alleen opregelen → hoogste opregelprijs, alleen afregelen → laagste
  afregelprijs, beide → prijs van de netto richting, geen → middenprijs. Hij
  is indicatief: de verrekende prijs die TenneT later publiceert kan afwijken.
  De curve van de dag begint pas bij de start van de integratie.
- **Ontwikkeld zonder TenneT-sleutel: feedback welkom.** Het Nederlandse deel
  volgt de API-beschrijving van TenneT; het kon niet tegen de echte API getest
  worden.
- De tijden volgen de klok van Brussel en Amsterdam, wat de tijdzone van
  Gladys ook is.

## Problemen oplossen

- De integratie staat in fout: haar melding zegt welke bron faalt (Elia
  onbereikbaar, TenneT-sleutel geweigerd, TenneT onbereikbaar). De laatste
  waarden blijven op de apparaten staan.
- Geen waarde op een apparaat: het moet via het tabblad **Discovery**
  toegevoegd worden; de eerste waarden komen binnen de minuut.
- Logboeken: de pagina van de integratie in Gladys; `LOG_LEVEL=debug` toont
  elke opvraging.

## Met dank aan

Gegevens: [Elia Open Data](https://opendata.elia.be) (Elia Transmission
Belgium) en de [TenneT-API](https://developer.tennet.eu) (TenneT TSO B.V.).
Deze integratie is niet verbonden aan Elia of TenneT.

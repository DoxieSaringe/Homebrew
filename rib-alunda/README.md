# RIB Alunda – Station 4300

Intern hemsida för personalen på räddningstjänstens station Alunda (4300). Det är vanlig statisk HTML utan byggsteg. Sidorna fungerar att öppna direkt från en filserver och kan läggas på SharePoint eller annan intern webbserver.

## Sidor

| Sida | Innehåll |
|------|----------|
| `index.html` – **Beredskap** | Vilken grupp som har beredskap den aktuella veckan (med telefonnummer), bläddring mellan veckor, årsöversikt, storhelger, kommande aktiviteter och senaste nyhetsbrev |
| `aktiviteter.html` | Schema för övningar och andra aktiviteter, grupperat per månad |
| `nyheter.html` | Nyhetsbrev, nyaste först |
| `telefonbok.html` | Sökbar telefonbok: viktiga nummer och all personal per grupp. Tryck på ett nummer för att ringa |

## Uppdatera innehåll

Allt innehåll ligger i `data/`. Öppna filen i en textredigerare och följ exemplen i den.

| Fil | Vad |
|-----|-----|
| `data/aktiviteter.js` | Aktiviteter (datum `ÅÅÅÅ-MM-DD`, tid, titel, plats, beskrivning) |
| `data/nyheter.js` | Nyhetsbrev (id, datum, titel, text, valfri länk till t.ex. PDF) |
| `data/beredskap.js` | Beredskapsschema, personal, viktiga nummer och storhelger. **Finns inte i repot**, se nedan |

## Beredskapsdata och personuppgifter

Repot är **publikt**. Därför committas inte `data/beredskap.js`, som innehåller namn och mobilnummer (se `.gitignore`). Utan filen visar sidan exempeldata från `data/beredskap.exempel.js` och en gul notis om det.

Skapa filen från Excel-schemat:

```bash
pip install openpyxl
python3 verktyg/xlsx_till_beredskap.py "Beredskap Alunda 2026.xlsx" > data/beredskap.js
```

Skriptet förutsätter samma layout som 2026 års fil: grupperna i kolumn A–C, veckonummer på grupprubrikens rad, viktiga nummer i A46–C51 och storhelger i J46–K50. Ändras layouten går det också att redigera `data/beredskap.js` för hand.

> Publicera inte sajten med den riktiga datafilen på en öppen adress, till exempel GitHub Pages för det här repot. Lägg den där bara personalen kommer åt den.

## Publicera på SharePoint

1. Ladda upp hela mappen (inklusive `data/beredskap.js`) till ett dokumentbibliotek, t.ex. **Site Assets**.
2. Länka till `index.html`, eller bädda in den med en **Embed**-webbdel på en SharePoint-sida (se `../sharepoint-speedtest/README.md` för stegen).

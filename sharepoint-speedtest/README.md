# SharePoint – Nätverkshastighetstest för Microsoft Teams Town Hall

En självständig HTML-sida som låter användare testa om deras nätverksanslutning uppfyller kraven för att delta i eller arrangera en **Microsoft Teams Town Hall**.

## Vad testas?

| Mätning | Beskrivning |
|---------|-------------|
| **Latens (ms)** | Median av 5 anrop mot Microsoft 365 CDN (`res.cdn.office.net`) |
| **Nedladdning (Mbps)** | 3 parallella anrop mäter genomströmning mot samma CDN |
| **Kvalitetsomdöme** | Bra / OK / Dålig baserat på Microsoft Teams Townhall-krav |

### Kvalitetsgränser

| Omdöme | Nedladdning | Latens |
|--------|-------------|--------|
| ✅ Bra | ≥ 3 Mbps | ≤ 100 ms |
| ⚠ OK | 1,5 – 3 Mbps | ≤ 200 ms |
| ❌ Dålig | < 1,5 Mbps | > 200 ms |

---

## Deployment till SharePoint

### Alternativ 1 – Embed-webdel (rekommenderas)

1. Gå till ditt SharePoint-webbplatsbibliotek, t.ex. **Site Assets**.
2. Ladda upp `speedtest.html` till biblioteket.
3. Kopiera den direkta URL:en till filen (högerklicka → Kopiera länk).
4. Skapa eller redigera en modern SharePoint-sida.
5. Lägg till webdelen **Bädda in** (Embed).
6. Klistra in URL:en till `speedtest.html` i fältet.
7. Publicera sidan.

> **Obs:** SharePoint-sidor kräver att inbäddade filer serveras via HTTPS. Filens URL från ett SharePoint-dokumentbibliotek uppfyller alltid detta krav.

### Alternativ 2 – Azure Static Web Apps

1. Skapa en Azure Static Web App (gratisnivå räcker).
2. Ladda upp `speedtest.html` som `index.html`.
3. Bädda in den publika URL:en i en SharePoint Embed-webdel.

---

## Krav och kompatibilitet

- Moderna webbläsare: Chrome 90+, Edge 90+, Firefox 88+, Safari 14+
- Ingen installation, inget byggsystem – ren HTML/CSS/JS
- Inga externa beroenden eller CDN-anrop (bortsett från test-endpoints)
- Fungerar inuti SharePoint iframe (Embed-webdel)

## Felsökning

| Problem | Möjlig orsak | Åtgärd |
|---------|-------------|--------|
| Testet misslyckas direkt | Brandvägg blockerar `res.cdn.office.net` | Kontakta IT – domänen krävs för Microsoft 365 |
| Nedladdning kan ej mätas | Browser-policy eller Content Security Policy | Testa i annan webbläsare |
| Sidan visas ej i Embed | Filen ej HTTPS eller fel URL | Verifiera URL i Site Assets |

## Endpoints som kontaktas

- `https://res.cdn.office.net` – Microsoft Office 365 CDN (samma infrastruktur som Teams Town Hall använder)

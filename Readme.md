# JanneFest — Real-time partychatt

En ASP.NET Core Razor Pages-app med SignalR för live-chatt under Jannes 40-årskalas.

---

## Starta appen

```bash
cd C:\Users\sebas\OOP2\FrånGustavTillJanne\JanneFest
dotnet run
```

Öppna `http://localhost:5258` — standardlösenordet är **janne40** (ändras i `triggerwords.json`).

### Lösenord via kommandorad

Lösenordet kan ges direkt vid start och åsidosätter då `triggerwords.json`:

```bash
dotnet run -- pingvin123
dotnet run -- --password pingvin123
```

---

## Funktioner

### 1. Användarinloggning & meddelandehighlight

- Alla gäster loggar in med ett gemensamt lösenord + eget namn.
- Namn lagras i **server-side session** — klienten kan inte förfalska avsändare (anti-fusk).
- Egna meddelanden visas högerställda med rosa ram och glöd för att underlätta egna annonseringar.
- Cookie `janne_name` sparar namnet för förifyllning vid återbesök (används aldrig för auth).

### 2. Presentationsläge (projektor)

- Lämna namnfältet tomt vid inloggning → automatisk omdirigering till `/Projector`.
- Projektorvyn är anpassad för **helskärmsvisning** — inga inmatningsfält, stor text.
- Visar max 6 senaste meddelanden med avsändarens avatar och namn.
- Räknar upp magiska ord och kombos i realtid.

### 3. Lösenord via kommandorad

- Lösenord kan ges som positionellt argument (`dotnet run -- mittlösenord`) eller med flaggan `--password`.
- CLI-lösenordet har företräde över `triggerwords.json` — ingen fil behöver ändras.

### 4. Genererade avatarer

- Varje användare får en **deterministisk SVG-avatar** baserad på sitt namn.
- Unik bakgrundsfärg + ringfärg beräknas via hash — samma namn = samma avatar alltid.
- Ingen extern tjänst används. Logiken finns i `wwwroot/js/avatar.js`.
- Visas i chattbubblan (36 px) och i projektor-vyn (42 px).

### 5. Triggerord, kombos & mini-konfetti

- Ord och kombinationer konfigureras i `triggerwords.json` utan att röra kod.
- Första gången ett ord dyker upp låses det upp globalt med konfetti-animation.
- **Mini-konfetti** visas även om ett redan upplåst ord skrivs igen.
- Kombinationer kräver att **alla ord finns i samma meddelande**.
- Sidopanel i chattvyn visar progress (låsta/upplåsta).

---

## Arkitektur

| Fil | Syfte |
|---|---|
| `Program.cs` | App-setup: SignalR, session, singleton TriggerService, CLI-lösenord |
| `Models/TriggerConfig.cs` | Datamodeller: TriggerWord, TriggerCombo, TriggerConfig, TriggerResult |
| `Services/TriggerService.cs` | Singleton — laddar triggerwords.json, håller global trigger-state |
| `Hubs/ChatHub.cs` | SignalR-hub — real-time chatt, anti-fusk via session |
| `Pages/Index` | Inloggningssida (lösenord + valfritt namn) |
| `Pages/Chat` | Chattsida med meddelandeflöde, sidopanel och räknare |
| `Pages/Projector` | Projektorsida — stor text, inga inmatningsfält |
| `wwwroot/css/site.css` | Mörkt partytema, fullt responsivt |
| `wwwroot/js/avatar.js` | Deterministisk SVG-avatar-generator |
| `wwwroot/js/chat.js` | SignalR-klient, konfetti, meddelanderendering |
| `wwwroot/js/projector.js` | Samma men projektor-anpassat |
| `triggerwords.json` | Konfiguration: lösenord, triggerord + kombos |

---

## Säkerhet

- Lösenord kontrolleras **server-side** — ett gemensamt lösenord för alla gäster.
- Användarnamn lagras i **server-side session** — klienten skickar bara meddelandetext.
- Session-cookie har `SameSite=Strict` och `HttpOnly=true` för CSRF- och XSS-skydd.
- Meddelanden renderas via `textContent` (aldrig `innerHTML`) — skyddar mot XSS.
- Meddelandelängd begränsas till 500 tecken server-side.

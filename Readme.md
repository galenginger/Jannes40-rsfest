Arkitektur

  ┌────────────────────────────┬───────────────────────────────────────────────┐
  │            Fil             │                     Syfte                     │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Program.cs                 │ App-setup: SignalR, session, singleton        │
  │                            │ TriggerService                                │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Models/TriggerConfig.cs    │ Datamodeller för triggerord, kombos, och      │
  │                            │ resultat                                      │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Services/TriggerService.cs │ Singleton som laddar triggerwords.json och    │
  │                            │ håller global triggerstate                    │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Hubs/ChatHub.cs            │ SignalR-hub — real-time chatt                 │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Pages/Index                │ Inloggningssida (lösenord + namn)             │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Pages/Chat                 │ Chattsida med räknare och meddelandeflöde     │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ Pages/Projector            │ Projektor-vy (ingen inmatning, stor text)     │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ wwwroot/css/site.css       │ Mörkt partytema, fullt responsivt             │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ wwwroot/js/chat.js         │ SignalR-client, konfetti, meddelanderendering │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ wwwroot/js/projector.js    │ Samma men projektor-anpassat                  │
  ├────────────────────────────┼───────────────────────────────────────────────┤
  │ triggerwords.json          │ Konfig med lösenord, triggerord + kombos      │
  └────────────────────────────┴───────────────────────────────────────────────┘

  Kravuppfyllnad

  - Lösenordsskydd — ett gemensamt lösenord, kontrolleras server-side
  - Namnval vid inloggning — ingen kontohantering, sparas i session + cookie
  - Real-time meddelanden — SignalR, klarar 50+ samtida användare
  - Projektor-läge — ingen namnfyllning = projektor-URL, inga inmatningsfält
  - Anti-fusk — namn lagras i server-side session, klienten skickar bara text,
  servern slår upp avsändaren
  - triggerwords.json — redigera lösenord, ord, emojis och kombos utan att röra
  koden
  - Konfetti — canvas-confetti, enkelt för ord och dramatisk sidokonfetti för
  kombos
  - Räknare — separata räknare för enskilda ord och kombos
  - Kombos — kräver att ALLA ord i kombinationen finns i SAMMA meddelande

  Starta appen

  cd C:\Users\sebas\OOP2\FrånGustavTillJanne\JanneFest
  dotnet run
  Öppna http://localhost:5258 — lösenordet är janne40 (ändras i
  triggerwords.json).
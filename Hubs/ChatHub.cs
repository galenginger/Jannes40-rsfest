using System.Collections.Concurrent;
using JanneFest.Services;
using Microsoft.AspNetCore.SignalR;

namespace JanneFest.Hubs;

// Real-time SignalR-hub för partychatten.
//
// Anti-fusk: Användarnamnet läses ALDRIG från klienten.
// Vid anslutning läses det från server-side sessionen och sparas i _connectionUsers
// kopplade till ConnectionId. När ett meddelande skickas slår hubben upp namnet
// server-side — klienten kan inte påverka vem som "verkar" skriva.
//
// SignalR skapar en ny hub-instans per anrop, därav static ConcurrentDictionary.
// Hanterar 50+ samtida användare via async I/O och .NETs trådpool.
public class ChatHub : Hub
{
    private readonly TriggerService _triggerService;

    // ConnectionId -> användarnamn (sätts vid anslutning från session, ej från klient)
    private static readonly ConcurrentDictionary<string, string> _connectionUsers = new();

    public ChatHub(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    // Anropas automatiskt när en klient ansluter till hubben.
    // Läser användarnamnet från server-side session och lagrar det kopplat till ConnectionId.
    // Skickar även aktuell triggerräknar-status till den nyanslutne klienten.
    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext != null)
        {
            // Session måste laddas explicit i SignalR-context
            await httpContext.Session.LoadAsync();
            var username = httpContext.Session.GetString("username") ?? string.Empty;
            _connectionUsers[Context.ConnectionId] = username;
        }

        // Skicka aktuell triggerstatistik till den nyanslutne klienten
        await Clients.Caller.SendAsync("UpdateCounters", new
        {
            unlockedWords = _triggerService.UnlockedWordCount,
            unlockedCombos = _triggerService.UnlockedComboCount,
            totalWords = _triggerService.TotalWordCount,
            totalCombos = _triggerService.TotalComboCount
        });

        await base.OnConnectedAsync();
    }

    // Rensa upp mapping när klient kopplar från
    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connectionUsers.TryRemove(Context.ConnectionId, out _);
        await base.OnDisconnectedAsync(exception);
    }

    // Tar emot ett meddelande från en klient.
    // Användarnamnet hämtas server-side — klienten skickar bara texten.
    // Klienter utan namn (projektor-läge) kan inte skicka meddelanden.
    public async Task SendMessage(string text)
    {
        // Slå upp användarnamnet server-side — anti-fusk
        if (!_connectionUsers.TryGetValue(Context.ConnectionId, out var username)
            || string.IsNullOrWhiteSpace(username))
        {
            return; // Projektor-läge eller ej autentiserad — inga meddelanden
        }

        // Grundläggande sanering
        text = text.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 500) return;

        // Kontrollera triggers och uppdatera global status
        var triggerResult = _triggerService.CheckMessage(text);

        // Skicka meddelandet + triggerinformation till ALLA anslutna klienter
        await Clients.All.SendAsync("ReceiveMessage", username, text, new
        {
            newWords = triggerResult.NewlyUnlockedWords.Select(w => new { w.Word, w.Emoji }).ToList(),
            newCombos = triggerResult.NewlyUnlockedCombos.Select(c => new { c.Description, c.Emoji }).ToList(),
            totalUnlockedWords = triggerResult.TotalUnlockedWords,
            totalUnlockedCombos = triggerResult.TotalUnlockedCombos
        });
    }
}

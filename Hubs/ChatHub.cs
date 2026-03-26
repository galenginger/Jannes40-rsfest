using System.Collections.Concurrent;
using DanneFest.Services;
using Microsoft.AspNetCore.SignalR;

namespace DanneFest.Hubs;

public class ChatHub : Hub
{
    private readonly TriggerService _triggerService;

    // ConnectionId -> användarnamn (sätts från session, aldrig från klienten)
    private static readonly ConcurrentDictionary<string, string> _connectionUsers = new();

    public ChatHub(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        if (httpContext != null)
        {
            await httpContext.Session.LoadAsync();
            var username = httpContext.Session.GetString("username") ?? string.Empty;
            _connectionUsers[Context.ConnectionId] = username;
        }

        await Clients.Caller.SendAsync("UpdateCounters", new
        {
            unlockedWords = _triggerService.UnlockedWordCount,
            unlockedCombos = _triggerService.UnlockedComboCount,
            totalWords = _triggerService.TotalWordCount,
            totalCombos = _triggerService.TotalComboCount
        });

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connectionUsers.TryRemove(Context.ConnectionId, out _);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SendMessage(string text)
    {
        if (!_connectionUsers.TryGetValue(Context.ConnectionId, out var username)
            || string.IsNullOrWhiteSpace(username))
        {
            return;
        }

        text = text.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 256) return;

        var triggerResult = _triggerService.CheckMessage(text);
        var isHighlighted = _triggerService.IsHighlightedUser(username);

        await Clients.All.SendAsync("ReceiveMessage", username, text, isHighlighted, new
        {
            newWords = triggerResult.NewlyUnlockedWords.Select(w => new { w.Word, w.Emoji }).ToList(),
            newCombos = triggerResult.NewlyUnlockedCombos.Select(c => new { c.Description, c.Emoji }).ToList(),
            totalUnlockedWords = triggerResult.TotalUnlockedWords,
            totalUnlockedCombos = triggerResult.TotalUnlockedCombos
        });
    }
}

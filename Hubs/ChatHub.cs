using System.Collections.Concurrent;
using DanneFest.Models;
using DanneFest.Services;
using Microsoft.AspNetCore.SignalR;

namespace DanneFest.Hubs;

public class ChatHub : Hub
{
    private readonly TriggerService _triggerService;
    private readonly MessageHistoryService _historyService;

    // ConnectionId -> användarnamn (sätts från session, aldrig från klienten)
    private static readonly ConcurrentDictionary<string, string> _connectionUsers = new();

    // Användarnamn som redan har skickat "Är med på festen!" — återanslutningar spammar inte
    private static readonly ConcurrentDictionary<string, bool> _announcedUsers = new();

    public ChatHub(TriggerService triggerService, MessageHistoryService historyService)
    {
        _triggerService = triggerService;
        _historyService = historyService;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var username = string.Empty;

        if (httpContext != null)
        {
            try
            {
                await httpContext.Session.LoadAsync();
                username = httpContext.Session.GetString("username") ?? string.Empty;
            }
            catch (InvalidOperationException)
            {
                // Session kan saknas i vissa proxy/transport-scenarion.
            }

            if (string.IsNullOrWhiteSpace(username))
            {
                username = httpContext.Request.Query["username"].ToString();
            }

            if (!string.IsNullOrWhiteSpace(username))
            {
                username = username.Trim();
                if (username.Length > 40)
                    username = username[..40];
                _connectionUsers[Context.ConnectionId] = username;
            }
        }

        await Clients.Caller.SendAsync("UpdateCounters", new
        {
            unlockedWords = _triggerService.UnlockedWordCount,
            unlockedCombos = _triggerService.UnlockedComboCount,
            totalWords = _triggerService.TotalWordCount,
            totalCombos = _triggerService.TotalComboCount
        });

        await BroadcastParticipantCount();

        // Meddelandena "Är med på festen" är inaktiverade
        // if (_connectionUsers.TryGetValue(Context.ConnectionId, out var joinedUser) && !string.IsNullOrEmpty(joinedUser))
        // {
        //     if (_announcedUsers.TryAdd(joinedUser, true))
        //         await Clients.Others.SendAsync("UserJoined", joinedUser);
        // }

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connectionUsers.TryRemove(Context.ConnectionId, out _);
        await BroadcastParticipantCount();
        await base.OnDisconnectedAsync(exception);
    }

    private Task BroadcastParticipantCount()
    {
        var count = _connectionUsers.Values.Count(u => !string.IsNullOrEmpty(u));
        return Clients.All.SendAsync("UpdateParticipants", count);
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
        var timestamp = DateTime.UtcNow;

        await Clients.All.SendAsync("ReceiveMessage", username, text, isHighlighted, new
        {
            newWords = triggerResult.NewlyUnlockedWords.Select(w => new { w.Word, w.Emoji }).ToList(),
            newCombos = triggerResult.NewlyUnlockedCombos.Select(c => new { c.Description, c.Emoji }).ToList(),
            totalUnlockedWords = triggerResult.TotalUnlockedWords,
            totalUnlockedCombos = triggerResult.TotalUnlockedCombos
        }, timestamp.ToString("O"));

        _historyService.Add(new MessageRecord
        {
            Username = username,
            Text = text,
            IsHighlighted = isHighlighted,
            Timestamp = timestamp
        });
    }

    public Task<List<MessageRecord>> GetHistory(DateTime since)
    {
        return Task.FromResult(_historyService.GetMessagesSince(since));
    }
}

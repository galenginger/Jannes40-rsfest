using System.Collections.Concurrent;
using DanneFest.Models;
using DanneFest.Services;
using Microsoft.AspNetCore.SignalR;

namespace DanneFest.Hubs;

public class ChatHub : Hub
{
    private const string AnnouncementPrefix = "/!";
    private const string AnnouncementUsername = "VMA";
    private const string AnnouncementAvatarId = "announcement-megaphone";

    private sealed class ConnectedUser
    {
        public string Username { get; init; } = string.Empty;
        public string AvatarId { get; init; } = string.Empty;
    }

    private readonly TriggerService _triggerService;
    private readonly MessageHistoryService _historyService;

    // ConnectionId -> användarnamn (sätts från session, aldrig från klienten)
    private static readonly ConcurrentDictionary<string, ConnectedUser> _connectionUsers = new();

    public ChatHub(TriggerService triggerService, MessageHistoryService historyService)
    {
        _triggerService = triggerService;
        _historyService = historyService;
    }

    public override async Task OnConnectedAsync()
    {
        var httpContext = Context.GetHttpContext();
        var username = string.Empty;
        var avatarId = string.Empty;

        if (httpContext != null)
        {
            try
            {
                await httpContext.Session.LoadAsync();
                username = httpContext.Session.GetString("username") ?? string.Empty;
                avatarId = httpContext.Session.GetString("avatar_id") ?? string.Empty;
            }
            catch (InvalidOperationException)
            {
                // Session kan saknas i vissa proxy/transport-scenarion.
            }

            if (string.IsNullOrWhiteSpace(username))
            {
                username = httpContext.Request.Query["username"].ToString();
            }

            if (string.IsNullOrWhiteSpace(avatarId))
            {
                avatarId = httpContext.Request.Query["avatarId"].ToString();
            }

            if (!string.IsNullOrWhiteSpace(username))
            {
                username = username.Trim();
                if (username.Length > 40)
                    username = username[..40];

                avatarId = NormalizeAvatarId(avatarId);

                _connectionUsers[Context.ConnectionId] = new ConnectedUser
                {
                    Username = username,
                    AvatarId = avatarId
                };
            }
        }

        await Clients.Caller.SendAsync("UpdateCounters", new
        {
            unlockedWords = _triggerService.UnlockedWordCount,
            unlockedCombos = _triggerService.UnlockedComboCount,
            totalWords = _triggerService.TotalWordCount,
            totalCombos = _triggerService.TotalComboCount
        });

        await BroadcastParticipants();

        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        _connectionUsers.TryRemove(Context.ConnectionId, out _);
        await BroadcastParticipants();
        await base.OnDisconnectedAsync(exception);
    }

    private Task BroadcastParticipants()
    {
        var participants = _connectionUsers.Values
            .Select(u => u.Username)
            .Where(u => !string.IsNullOrWhiteSpace(u))
            .Select(u => u.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(u => u, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return Task.WhenAll(
            Clients.All.SendAsync("UpdateParticipants", participants.Count),
            Clients.All.SendAsync("UpdateParticipantList", participants)
        );
    }

    public async Task SendMessage(string text)
    {
        if (!_connectionUsers.TryGetValue(Context.ConnectionId, out var user)
            || string.IsNullOrWhiteSpace(user.Username))
        {
            return;
        }

        var username = user.Username;
        var avatarId = user.AvatarId;

        text = text.Trim();
        if (string.IsNullOrWhiteSpace(text) || text.Length > 256) return;

        var isAnnouncement = text.StartsWith(AnnouncementPrefix, StringComparison.Ordinal);
        if (isAnnouncement)
        {
            text = text[AnnouncementPrefix.Length..].TrimStart();
            if (string.IsNullOrWhiteSpace(text))
                return;
        }

        var triggerResult = _triggerService.CheckMessage(text);
        var isHighlighted = isAnnouncement || _triggerService.IsHighlightedUser(username);
        var timestamp = DateTime.UtcNow;
        var displayUsername = isAnnouncement ? AnnouncementUsername : username;
        var displayAvatarId = isAnnouncement ? AnnouncementAvatarId : avatarId;

        await Clients.All.SendAsync("ReceiveMessage", displayUsername, text, isHighlighted, displayAvatarId, new
        {
            newWords = triggerResult.NewlyUnlockedWords.Select(w => new { w.Word, w.Emoji }).ToList(),
            newCombos = triggerResult.NewlyUnlockedCombos.Select(c => new { c.Description, c.Emoji }).ToList(),
            totalUnlockedWords = triggerResult.TotalUnlockedWords,
            totalUnlockedCombos = triggerResult.TotalUnlockedCombos
        }, timestamp.ToString("O"), isAnnouncement);

        _historyService.Add(new MessageRecord
        {
            Username = displayUsername,
            AvatarId = displayAvatarId,
            Text = text,
            IsHighlighted = isHighlighted,
            IsAnnouncement = isAnnouncement,
            Timestamp = timestamp
        });
    }

    public Task<List<MessageRecord>> GetHistory(DateTime since)
    {
        return Task.FromResult(_historyService.GetMessagesSince(since));
    }

    private static string NormalizeAvatarId(string? raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
            return string.Empty;

        var cleaned = new string(raw
            .Trim()
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_')
            .ToArray());

        if (cleaned.Length > 64)
            cleaned = cleaned[..64];

        return cleaned;
    }
}

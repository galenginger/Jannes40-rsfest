namespace DanneFest.Models;

public class MessageRecord
{
    public string Username { get; init; } = string.Empty;
    public string AvatarId { get; init; } = string.Empty;
    public string Text { get; init; } = string.Empty;
    public bool IsHighlighted { get; init; }
    public bool IsAnnouncement { get; init; }
    public DateTime Timestamp { get; init; }
}

namespace DanneFest.Data;

/// <summary>
/// Entitet för chattmeddelanden i SQLite-databasen
/// </summary>
public class Message
{
    public int Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string AvatarId { get; set; } = string.Empty;
    public string Text { get; set; } = string.Empty;
    public bool IsHighlighted { get; set; }
    public bool IsAnnouncement { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

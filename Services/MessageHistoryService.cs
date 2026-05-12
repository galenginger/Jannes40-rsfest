using DanneFest.Models;

namespace DanneFest.Services;

public class MessageHistoryService
{
    private const int MaxMessages = 200;
    private readonly List<MessageRecord> _messages = new();
    private readonly object _lock = new();

    public void Add(MessageRecord record)
    {
        lock (_lock)
        {
            _messages.Add(record);
            if (_messages.Count > MaxMessages)
                _messages.RemoveAt(0);
        }
    }

    public List<MessageRecord> GetMessagesSince(DateTime since)
    {
        lock (_lock)
        {
            return _messages.Where(m => m.Timestamp > since).ToList();
        }
    }
}

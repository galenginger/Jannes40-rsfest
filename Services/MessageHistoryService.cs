using DanneFest.Models;
using Microsoft.Extensions.Logging;
using System.Text.Json;

namespace DanneFest.Services;

public class MessageHistoryService
{
    private const int MaxMessages = 200;
    private readonly List<MessageRecord> _messages = new();
    private readonly object _lock = new();
    private readonly ILogger<MessageHistoryService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };
    private readonly string _stateDirectory;
    private readonly string _stateFilePath;

    public MessageHistoryService(IWebHostEnvironment env, ILogger<MessageHistoryService> logger)
    {
        _logger = logger;
        _stateDirectory = Path.Combine(env.ContentRootPath, "App_Data", "runtime-state");
        _stateFilePath = Path.Combine(_stateDirectory, "message-history.json");
        LoadPersistedHistory();
    }

    public void Add(MessageRecord record)
    {
        List<MessageRecord> snapshot;

        lock (_lock)
        {
            _messages.Add(record);
            if (_messages.Count > MaxMessages)
                _messages.RemoveAt(0);

            snapshot = _messages.ToList();
        }

        PersistHistory(snapshot);
    }

    public List<MessageRecord> GetMessagesSince(DateTime since)
    {
        lock (_lock)
        {
            return _messages.Where(m => m.Timestamp > since).ToList();
        }
    }

    private void LoadPersistedHistory()
    {
        try
        {
            if (!File.Exists(_stateFilePath))
            {
                return;
            }

            var json = File.ReadAllText(_stateFilePath);
            var persisted = JsonSerializer.Deserialize<List<MessageRecord>>(json) ?? new List<MessageRecord>();

            lock (_lock)
            {
                _messages.Clear();

                if (persisted.Count > MaxMessages)
                {
                    persisted = persisted.Skip(Math.Max(0, persisted.Count - MaxMessages)).ToList();
                }

                _messages.AddRange(persisted);
            }

            _logger.LogInformation("Loaded persisted chat history: {MessageCount} messages.", _messages.Count);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load persisted chat history. Starting with empty history.");
        }
    }

    private void PersistHistory(List<MessageRecord> snapshot)
    {
        try
        {
            Directory.CreateDirectory(_stateDirectory);
            var tempFile = _stateFilePath + ".tmp";
            var json = JsonSerializer.Serialize(snapshot, _jsonOptions);
            File.WriteAllText(tempFile, json);
            File.Move(tempFile, _stateFilePath, true);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist chat history to disk.");
        }
    }
}

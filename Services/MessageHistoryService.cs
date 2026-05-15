using DanneFest.Data;
using DanneFest.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DanneFest.Services;

public class MessageHistoryService : IHostedService, IDisposable
{
    private const int MaxBatchSize = 25;
    private const int MaxPendingMessages = 2000;
    private static readonly TimeSpan FlushInterval = TimeSpan.FromMilliseconds(800);

    private readonly IServiceScopeFactory _scopeFactory;
    private readonly ILogger<MessageHistoryService> _logger;
    private readonly object _pendingLock = new();
    private List<Message> _pendingMessages = new();
    private Timer? _flushTimer;
    private int _isFlushing;
    private int _flushQueued;

    public MessageHistoryService(IServiceScopeFactory scopeFactory, ILogger<MessageHistoryService> logger)
    {
        _scopeFactory = scopeFactory;
        _logger = logger;
    }

    public Task StartAsync(CancellationToken cancellationToken)
    {
        _flushTimer = new Timer(_ => FlushPendingMessages(), null, FlushInterval, FlushInterval);
        return Task.CompletedTask;
    }

    public Task StopAsync(CancellationToken cancellationToken)
    {
        _flushTimer?.Change(Timeout.Infinite, Timeout.Infinite);
        FlushPendingMessages();
        return Task.CompletedTask;
    }

    public void Dispose()
    {
        _flushTimer?.Dispose();
    }

    /// <summary>
    /// Köar meddelanden för batchad skrivning till databasen
    /// </summary>
    public void Add(MessageRecord record)
    {
        var message = new Message
        {
            Username = record.Username,
            AvatarId = record.AvatarId,
            Text = record.Text,
            IsHighlighted = record.IsHighlighted,
            IsAnnouncement = record.IsAnnouncement,
            Timestamp = record.Timestamp
        };

        var shouldFlushNow = false;

        lock (_pendingLock)
        {
            _pendingMessages.Add(message);

            if (_pendingMessages.Count > MaxPendingMessages)
            {
                var overflow = _pendingMessages.Count - MaxPendingMessages;
                _pendingMessages.RemoveRange(0, overflow);
                _logger.LogWarning("Pending message queue hit cap ({Cap}). Dropped {Dropped} oldest queued messages.", MaxPendingMessages, overflow);
            }

            if (_pendingMessages.Count >= MaxBatchSize)
            {
                shouldFlushNow = true;
            }
        }

        if (shouldFlushNow)
        {
            QueueFlush();
        }
    }

    private void QueueFlush()
    {
        if (Interlocked.CompareExchange(ref _flushQueued, 1, 0) != 0)
            return;

        _ = Task.Run(() =>
        {
            try
            {
                FlushPendingMessages();
            }
            finally
            {
                Interlocked.Exchange(ref _flushQueued, 0);
            }
        });
    }

    private void FlushPendingMessages()
    {
        if (Interlocked.Exchange(ref _isFlushing, 1) == 1)
            return;

        List<Message> batch;
        lock (_pendingLock)
        {
            if (_pendingMessages.Count == 0)
            {
                Interlocked.Exchange(ref _isFlushing, 0);
                return;
            }

            batch = _pendingMessages;
            _pendingMessages = new List<Message>();
        }

        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            dbContext.Messages.AddRange(batch);
            dbContext.SaveChanges();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to persist message batch to database.");

            // Lägg tillbaka batchen för nytt försök vid nästa flush.
            lock (_pendingLock)
            {
                _pendingMessages.AddRange(batch);
                if (_pendingMessages.Count > MaxPendingMessages)
                {
                    var overflow = _pendingMessages.Count - MaxPendingMessages;
                    _pendingMessages.RemoveRange(0, overflow);
                    _logger.LogWarning("Pending message queue hit cap ({Cap}) after DB error. Dropped {Dropped} oldest queued messages.", MaxPendingMessages, overflow);
                }
            }
        }
        finally
        {
            Interlocked.Exchange(ref _isFlushing, 0);
        }
    }

    /// <summary>
    /// Hämtar meddelanden som skickades efter given tid
    /// </summary>
    public List<MessageRecord> GetMessagesSince(DateTime since)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            var persisted = dbContext.Messages
                .AsNoTracking()
                .Where(m => m.Timestamp > since)
                .OrderBy(m => m.Timestamp)
                .Select(m => new MessageRecord
                {
                    Username = m.Username,
                    AvatarId = m.AvatarId,
                    Text = m.Text,
                    IsHighlighted = m.IsHighlighted,
                    IsAnnouncement = m.IsAnnouncement,
                    Timestamp = m.Timestamp
                })
                .ToList();

            List<MessageRecord> pending;
            lock (_pendingLock)
            {
                pending = _pendingMessages
                    .Where(m => m.Timestamp > since)
                    .OrderBy(m => m.Timestamp)
                    .Select(m => new MessageRecord
                    {
                        Username = m.Username,
                        AvatarId = m.AvatarId,
                        Text = m.Text,
                        IsHighlighted = m.IsHighlighted,
                        IsAnnouncement = m.IsAnnouncement,
                        Timestamp = m.Timestamp
                    })
                    .ToList();
            }

            if (pending.Count == 0)
                return persisted;

            return persisted.Concat(pending)
                .OrderBy(m => m.Timestamp)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch messages since {Since}.", since);
            return new List<MessageRecord>();
        }
    }

    /// <summary>
    /// Hämtar de senaste N meddelanden från databasen (för initial load)
    /// </summary>
    public List<MessageRecord> GetLatestMessages(int count = 100)
    {
        try
        {
            using var scope = _scopeFactory.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            var persisted = dbContext.Messages
                .AsNoTracking()
                .OrderByDescending(m => m.Timestamp)
                .Take(count)
                .OrderBy(m => m.Timestamp)
                .Select(m => new MessageRecord
                {
                    Username = m.Username,
                    AvatarId = m.AvatarId,
                    Text = m.Text,
                    IsHighlighted = m.IsHighlighted,
                    IsAnnouncement = m.IsAnnouncement,
                    Timestamp = m.Timestamp
                })
                .ToList();

            List<MessageRecord> pending;
            lock (_pendingLock)
            {
                pending = _pendingMessages
                    .OrderBy(m => m.Timestamp)
                    .Select(m => new MessageRecord
                    {
                        Username = m.Username,
                        AvatarId = m.AvatarId,
                        Text = m.Text,
                        IsHighlighted = m.IsHighlighted,
                        IsAnnouncement = m.IsAnnouncement,
                        Timestamp = m.Timestamp
                    })
                    .ToList();
            }

            if (pending.Count == 0)
                return persisted;

            return persisted.Concat(pending)
                .OrderByDescending(m => m.Timestamp)
                .Take(count)
                .OrderBy(m => m.Timestamp)
                .ToList();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch latest messages.");
            return new List<MessageRecord>();
        }
    }
}

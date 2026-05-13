using DanneFest.Data;
using DanneFest.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace DanneFest.Services;

public class MessageHistoryService
{
    private readonly ChatDbContext _dbContext;
    private readonly ILogger<MessageHistoryService> _logger;

    public MessageHistoryService(ChatDbContext dbContext, ILogger<MessageHistoryService> logger)
    {
        _dbContext = dbContext;
        _logger = logger;
    }

    /// <summary>
    /// Lägger till ett nytt meddelande i databasen
    /// </summary>
    public void Add(MessageRecord record)
    {
        try
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

            _dbContext.Messages.Add(message);
            _dbContext.SaveChanges();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save message to database.");
        }
    }

    /// <summary>
    /// Hämtar meddelanden som skickades efter given tid
    /// </summary>
    public List<MessageRecord> GetMessagesSince(DateTime since)
    {
        try
        {
            return _dbContext.Messages
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
            return _dbContext.Messages
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
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to fetch latest messages.");
            return new List<MessageRecord>();
        }
    }
}

using System.Text.Json;
using DanneFest.Data;
using DanneFest.Models;
using Microsoft.Extensions.Logging;

namespace DanneFest.Services;

// Singleton — trådsäker via _lock.
public class TriggerService
{
    private readonly IWebHostEnvironment _env;
    private readonly ILogger<TriggerService> _logger;
    private readonly IServiceProvider _serviceProvider;
    private TriggerConfig _config = new();
    private readonly object _lock = new();

    private readonly HashSet<string> _unlockedWords = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _unlockedCombos = new();

    public TriggerService(IWebHostEnvironment env, ILogger<TriggerService> logger, IServiceProvider serviceProvider)
    {
        _env = env;
        _logger = logger;
        _serviceProvider = serviceProvider;
    }

    public void Initialize(string? passwordOverride = null)
    {
        var path = Path.Combine(_env.ContentRootPath, "triggerwords.json");
        if (!File.Exists(path))
        {
            Console.WriteLine("[TriggerService] triggerwords.json hittades inte — inga triggers aktiva.");
            return;
        }

        var json = File.ReadAllText(path);
        _config = JsonSerializer.Deserialize<TriggerConfig>(json, new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        }) ?? new TriggerConfig();

        if (!string.IsNullOrWhiteSpace(passwordOverride))
        {
            _config.Password = passwordOverride;
            Console.WriteLine("[TriggerService] Lösenord satt via kommandorad.");
        }

        LoadPersistedState();

        Console.WriteLine($"[TriggerService] Laddade {_config.Words.Count} ord och {_config.Combos.Count} kombos.");
    }

    public string GetPassword() => _config.Password;
    public IReadOnlyList<TriggerWord> GetAllWords() => _config.Words.AsReadOnly();
    public IReadOnlyList<TriggerCombo> GetAllCombos() => _config.Combos.AsReadOnly();

    public bool IsHighlightedUser(string username) =>
        _config.HighlightedUsers.Any(u =>
            string.Equals(u, username, StringComparison.OrdinalIgnoreCase));

    public int TotalWordCount => _config.Words.Count;
    public int TotalComboCount => _config.Combos.Count;

    public int UnlockedWordCount
    {
        get { lock (_lock) { return _unlockedWords.Count; } }
    }

    public int UnlockedComboCount
    {
        get { lock (_lock) { return _unlockedCombos.Count; } }
    }

    public HashSet<string> GetUnlockedWordSet()
    {
        lock (_lock) { return new HashSet<string>(_unlockedWords, StringComparer.OrdinalIgnoreCase); }
    }

    public HashSet<string> GetUnlockedComboSet()
    {
        lock (_lock) { return new HashSet<string>(_unlockedCombos); }
    }

    public TriggerResult CheckMessage(string messageText)
    {
        if (string.IsNullOrWhiteSpace(messageText))
            return new TriggerResult { TotalUnlockedWords = UnlockedWordCount, TotalUnlockedCombos = UnlockedComboCount };

        var result = new TriggerResult();
        var lowerMessage = messageText.ToLowerInvariant();
        var hasNewUnlocks = false;

        lock (_lock)
        {
            foreach (var triggerWord in _config.Words)
            {
                if (lowerMessage.Contains(triggerWord.Word.ToLowerInvariant())
                    && _unlockedWords.Add(triggerWord.Word.ToLowerInvariant()))
                {
                    result.NewlyUnlockedWords.Add(triggerWord);
                    hasNewUnlocks = true;
                }
            }

            foreach (var combo in _config.Combos)
            {
                var comboKey = string.Join("+", combo.Words
                    .Select(w => w.ToLowerInvariant())
                    .OrderBy(w => w));

                if (_unlockedCombos.Contains(comboKey)) continue;

                if (combo.Words.All(w => lowerMessage.Contains(w.ToLowerInvariant())))
                {
                    _unlockedCombos.Add(comboKey);
                    result.NewlyUnlockedCombos.Add(combo);
                    hasNewUnlocks = true;
                }
            }

            result.TotalUnlockedWords = _unlockedWords.Count;
            result.TotalUnlockedCombos = _unlockedCombos.Count;
        }

        if (hasNewUnlocks)
        {
            var newWords = result.NewlyUnlockedWords
                .Select(w => w.Word.ToLowerInvariant())
                .Where(w => !string.IsNullOrWhiteSpace(w))
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();

            var newCombos = result.NewlyUnlockedCombos
                .Select(c => string.Join("+", c.Words.Select(w => w.ToLowerInvariant()).OrderBy(w => w)))
                .Where(c => !string.IsNullOrWhiteSpace(c))
                .Distinct(StringComparer.Ordinal)
                .ToList();

            PersistState(newWords, newCombos);
        }

        return result;
    }

    private void LoadPersistedState()
    {
        try
        {
            // Skapa en scope för att ladda från databasen
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            var unlockedWords = dbContext.UnlockedTriggers
                .Where(ut => ut.Type == "word")
                .Select(ut => ut.TriggerValue)
                .ToList();

            var unlockedCombos = dbContext.UnlockedTriggers
                .Where(ut => ut.Type == "combo")
                .Select(ut => ut.TriggerValue)
                .ToList();

            lock (_lock)
            {
                _unlockedWords.Clear();
                _unlockedCombos.Clear();

                foreach (var word in unlockedWords.Where(w => !string.IsNullOrWhiteSpace(w)))
                {
                    _unlockedWords.Add(word.ToLowerInvariant());
                }

                foreach (var combo in unlockedCombos.Where(c => !string.IsNullOrWhiteSpace(c)))
                {
                    _unlockedCombos.Add(combo);
                }
            }

            _logger.LogInformation("Loaded trigger state from database: {WordCount} words, {ComboCount} combos.",
                UnlockedWordCount,
                UnlockedComboCount);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load trigger state from database. Starting with empty unlock state.");
        }
    }

    private void PersistState(List<string> newWords, List<string> newCombos)
    {
        if (newWords.Count == 0 && newCombos.Count == 0)
            return;

        try
        {
            // Skapa en scope för att spara till databasen
            using var scope = _serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();

            foreach (var word in newWords)
            {
                dbContext.UnlockedTriggers.Add(new UnlockedTrigger
                {
                    Type = "word",
                    TriggerValue = word,
                    UnlockedAt = DateTime.UtcNow
                });
            }

            foreach (var combo in newCombos)
            {
                dbContext.UnlockedTriggers.Add(new UnlockedTrigger
                {
                    Type = "combo",
                    TriggerValue = combo,
                    UnlockedAt = DateTime.UtcNow
                });
            }

            dbContext.SaveChanges();
        }
        catch (Microsoft.EntityFrameworkCore.DbUpdateException)
        {
            // Unik index-krock vid race condition kan inträffa; ignoreras säkert.
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to persist trigger state to database.");
        }
    }
}

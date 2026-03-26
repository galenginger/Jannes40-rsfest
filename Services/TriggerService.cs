using System.Text.Json;
using DanneFest.Models;

namespace DanneFest.Services;

// Singleton — trådsäker via _lock.
public class TriggerService
{
    private readonly IWebHostEnvironment _env;
    private TriggerConfig _config = new();
    private readonly object _lock = new();

    private readonly HashSet<string> _unlockedWords = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _unlockedCombos = new();

    public TriggerService(IWebHostEnvironment env)
    {
        _env = env;
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

        lock (_lock)
        {
            foreach (var triggerWord in _config.Words)
            {
                if (lowerMessage.Contains(triggerWord.Word.ToLowerInvariant())
                    && _unlockedWords.Add(triggerWord.Word.ToLowerInvariant()))
                {
                    result.NewlyUnlockedWords.Add(triggerWord);
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
                }
            }

            result.TotalUnlockedWords = _unlockedWords.Count;
            result.TotalUnlockedCombos = _unlockedCombos.Count;
        }

        return result;
    }
}

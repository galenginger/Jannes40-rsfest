using System.Text.Json;
using DanneFest.Models;
using Microsoft.Extensions.Logging;

namespace DanneFest.Services;

// Singleton — trådsäker via _lock.
public class TriggerService
{
    private sealed class PersistedTriggerState
    {
        public List<string> UnlockedWords { get; set; } = new();
        public List<string> UnlockedCombos { get; set; } = new();
    }

    private readonly IWebHostEnvironment _env;
    private readonly ILogger<TriggerService> _logger;
    private readonly JsonSerializerOptions _jsonOptions = new() { WriteIndented = true };
    private readonly string _stateDirectory;
    private readonly string _stateFilePath;
    private TriggerConfig _config = new();
    private readonly object _lock = new();

    private readonly HashSet<string> _unlockedWords = new(StringComparer.OrdinalIgnoreCase);
    private readonly HashSet<string> _unlockedCombos = new();

    public TriggerService(IWebHostEnvironment env, ILogger<TriggerService> logger)
    {
        _env = env;
        _logger = logger;
        _stateDirectory = Path.Combine(_env.ContentRootPath, "App_Data", "runtime-state");
        _stateFilePath = Path.Combine(_stateDirectory, "trigger-state.json");
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
            PersistState();
        }

        return result;
    }

    private void LoadPersistedState()
    {
        try
        {
            if (!File.Exists(_stateFilePath))
            {
                return;
            }

            var json = File.ReadAllText(_stateFilePath);
            var persisted = JsonSerializer.Deserialize<PersistedTriggerState>(json);
            if (persisted is null)
            {
                return;
            }

            lock (_lock)
            {
                _unlockedWords.Clear();
                _unlockedCombos.Clear();

                foreach (var word in persisted.UnlockedWords.Where(w => !string.IsNullOrWhiteSpace(w)))
                {
                    _unlockedWords.Add(word.ToLowerInvariant());
                }

                foreach (var combo in persisted.UnlockedCombos.Where(c => !string.IsNullOrWhiteSpace(c)))
                {
                    _unlockedCombos.Add(combo);
                }
            }

            _logger.LogInformation("Loaded persisted trigger state: {WordCount} words, {ComboCount} combos.",
                UnlockedWordCount,
                UnlockedComboCount);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to load persisted trigger state. Starting with empty unlock state.");
        }
    }

    private void PersistState()
    {
        PersistedTriggerState snapshot;

        lock (_lock)
        {
            snapshot = new PersistedTriggerState
            {
                UnlockedWords = _unlockedWords.ToList(),
                UnlockedCombos = _unlockedCombos.ToList()
            };
        }

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
            _logger.LogWarning(ex, "Failed to persist trigger state to disk.");
        }
    }
}

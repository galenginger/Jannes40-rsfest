using System.Text.Json;
using JanneFest.Models;

namespace JanneFest.Services;

// Singleton-tjänst som håller global triggerords-status för alla användare.
// Trådsäker via _lock — kan hantera 50+ samtida SignalR-anslutningar.
// Konfigurationen laddas från triggerwords.json vid appstart.
public class TriggerService
{
    private readonly IWebHostEnvironment _env;
    private TriggerConfig _config = new();
    private readonly object _lock = new();

    // Upplåsta enskilda ord (lowercase). HashSet.Add returnerar false om redan upplåst.
    private readonly HashSet<string> _unlockedWords = new(StringComparer.OrdinalIgnoreCase);

    // Upplåsta kombinationer. Nyckel = ordens lowercase sorterade och sammanfogade med "+".
    private readonly HashSet<string> _unlockedCombos = new();

    public TriggerService(IWebHostEnvironment env)
    {
        _env = env;
    }

    // Läser triggerwords.json. Anropas en gång i Program.cs vid appstart.
    // passwordOverride: om angett via kommandorad, ersätter lösenordet i triggerwords.json.
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

    // Returnerar true om användarnamnet finns i highlightedUsers (case-insensitivt)
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

    // Returnerar de ord (lowercase) som hittills låsts upp — används för att rita sidopanelen
    public HashSet<string> GetUnlockedWordSet()
    {
        lock (_lock) { return new HashSet<string>(_unlockedWords, StringComparer.OrdinalIgnoreCase); }
    }

    // Returnerar de combo-nycklar som hittills låsts upp
    public HashSet<string> GetUnlockedComboSet()
    {
        lock (_lock) { return new HashSet<string>(_unlockedCombos); }
    }

    // Analyserar ett meddelande efter triggerord och kombinationer.
    //
    // Regler:
    //   Enskilda ord: case-insensitiv matchning, låses upp globalt första gången.
    //   Kombinationer: ALLA ord måste finnas i SAMMA meddelande — detta är
    //   "på skärmen samtidigt"-kravet som gör att man inte kan fuska.
    public TriggerResult CheckMessage(string messageText)
    {
        if (string.IsNullOrWhiteSpace(messageText))
            return new TriggerResult { TotalUnlockedWords = UnlockedWordCount, TotalUnlockedCombos = UnlockedComboCount };

        var result = new TriggerResult();
        var lowerMessage = messageText.ToLowerInvariant();

        lock (_lock)
        {
            // Kontrollera enskilda ord
            foreach (var triggerWord in _config.Words)
            {
                if (lowerMessage.Contains(triggerWord.Word.ToLowerInvariant())
                    && _unlockedWords.Add(triggerWord.Word.ToLowerInvariant()))
                {
                    result.NewlyUnlockedWords.Add(triggerWord);
                }
            }

            // Kontrollera kombinationer — alla ord krävs i DETTA meddelande
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

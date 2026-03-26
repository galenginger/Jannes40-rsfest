namespace DanneFest.Models;

public class TriggerWord
{
    public string Word { get; set; } = string.Empty;
    public string Emoji { get; set; } = "🎉";
}

// Alla ord måste finnas i SAMMA meddelande för att kombinationen ska låsas upp.
public class TriggerCombo
{
    public List<string> Words { get; set; } = new();
    public string Emoji { get; set; } = "🎊";
    public string Description { get; set; } = string.Empty;
}

public class TriggerConfig
{
    public string Password { get; set; } = string.Empty;
    public List<string> HighlightedUsers { get; set; } = new();
    public List<TriggerWord> Words { get; set; } = new();
    public List<TriggerCombo> Combos { get; set; } = new();
}

public class TriggerResult
{
    public List<TriggerWord> NewlyUnlockedWords { get; set; } = new();
    public List<TriggerCombo> NewlyUnlockedCombos { get; set; } = new();
    public int TotalUnlockedWords { get; set; }
    public int TotalUnlockedCombos { get; set; }
}

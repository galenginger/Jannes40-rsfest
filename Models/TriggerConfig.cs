namespace JanneFest.Models;

// Representerar ett enskilt triggerord med tillhörande emoji.
// När ordet dyker upp i ett meddelande för första gången triggas konfetti.
public class TriggerWord
{
    public string Word { get; set; } = string.Empty;
    public string Emoji { get; set; } = "🎉";
}

// Representerar en kombination av ord som ALLA måste finnas i SAMMA meddelande
// för att kombinationen ska låsas upp ("visas på skärmen samtidigt").
// Detta förhindrar fusk via separata meddelanden.
public class TriggerCombo
{
    public List<string> Words { get; set; } = new();
    public string Emoji { get; set; } = "🎊";

    // Visningsnamn i räknarlistan
    public string Description { get; set; } = string.Empty;
}

// Rotkonfiguration laddad från triggerwords.json vid appstart.
public class TriggerConfig
{
    public string Password { get; set; } = string.Empty;
    // Användare vars meddelanden highlightas för ALLA (t.ex. värden/jubilaren)
    public List<string> HighlightedUsers { get; set; } = new();
    public List<TriggerWord> Words { get; set; } = new();
    public List<TriggerCombo> Combos { get; set; } = new();
}

// Returneras från TriggerService.CheckMessage() med info om vad som precis låstes upp.
public class TriggerResult
{
    public List<TriggerWord> NewlyUnlockedWords { get; set; } = new();
    public List<TriggerCombo> NewlyUnlockedCombos { get; set; } = new();
    public int TotalUnlockedWords { get; set; }
    public int TotalUnlockedCombos { get; set; }
}

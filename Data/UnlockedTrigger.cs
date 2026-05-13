namespace DanneFest.Data;

/// <summary>
/// Spårar vilka trigger-ord och combos som är upplåsta
/// </summary>
public class UnlockedTrigger
{
    public int Id { get; set; }

    /// <summary>
    /// "word" eller "combo"
    /// </summary>
    public string Type { get; set; } = "word";

    /// <summary>
    /// För ord: ordet självt (lowercase)
    /// För combos: ord sorterade och sammanfogade med "+" (t.ex. "banana+beer+hello")
    /// </summary>
    public string TriggerValue { get; set; } = string.Empty;

    public DateTime UnlockedAt { get; set; } = DateTime.UtcNow;
}

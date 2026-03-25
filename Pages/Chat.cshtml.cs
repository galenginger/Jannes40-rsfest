using System.Text.Json;
using JanneFest.Models;
using JanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace JanneFest.Pages;

// Chattsida för inloggade användare med namn.
// Visar real-time meddelandeflöde, sidopanel med trigger-progress och textinmatning.
// Omdirigerar till inloggning om sessionen saknar namn.
public class ChatModel : PageModel
{
    private readonly TriggerService _triggerService;

    public string Username { get; private set; } = string.Empty;
    public int TotalWords { get; private set; }
    public int TotalCombos { get; private set; }
    public int UnlockedWords { get; private set; }
    public int UnlockedCombos { get; private set; }

    // Hela trigger-konfigurationen som JSON — skickas till JS för sidopanelen
    public string WordsJson { get; private set; } = "[]";
    public string CombosJson { get; private set; } = "[]";

    // Vilka ord/kombos är redan upplåsta vid sidladdning
    public string UnlockedWordSetJson { get; private set; } = "[]";
    public string UnlockedComboSetJson { get; private set; } = "[]";

    public ChatModel(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    public IActionResult OnGet()
    {
        var username = HttpContext.Session.GetString("username");
        if (string.IsNullOrWhiteSpace(username))
            return RedirectToPage("/Index");

        Username = username;
        TotalWords = _triggerService.TotalWordCount;
        TotalCombos = _triggerService.TotalComboCount;
        UnlockedWords = _triggerService.UnlockedWordCount;
        UnlockedCombos = _triggerService.UnlockedComboCount;

        // Serialisera konfiguration och aktuellt state för JS-sidopanelen
        var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };

        WordsJson = JsonSerializer.Serialize(
            _triggerService.GetAllWords().Select(w => new { w.Word, w.Emoji }), opts);

        // Combo-nyckel = ord sorterade och sammanfogade med "+" (matchar TriggerService)
        CombosJson = JsonSerializer.Serialize(
            _triggerService.GetAllCombos().Select(c => new
            {
                c.Description,
                c.Emoji,
                Key = string.Join("+", c.Words.Select(w => w.ToLowerInvariant()).OrderBy(w => w))
            }), opts);

        UnlockedWordSetJson = JsonSerializer.Serialize(
            _triggerService.GetUnlockedWordSet().ToList());

        UnlockedComboSetJson = JsonSerializer.Serialize(
            _triggerService.GetUnlockedComboSet().ToList());

        return Page();
    }

    // Loggar ut och rensar sessionen -> tillbaka till inloggningssidan
    public IActionResult OnPostLogout()
    {
        HttpContext.Session.Clear();
        return RedirectToPage("/Index");
    }
}

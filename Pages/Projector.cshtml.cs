using System.Text.Json;
using JanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace JanneFest.Pages;

public class ProjectorModel : PageModel
{
    private readonly TriggerService _triggerService;

    public int TotalWords { get; private set; }
    public int TotalCombos { get; private set; }
    public int UnlockedWords { get; private set; }
    public int UnlockedCombos { get; private set; }

    public string WordsJson { get; private set; } = "[]";
    public string UnlockedWordSetJson { get; private set; } = "[]";

    public ProjectorModel(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    public IActionResult OnGet()
    {
        if (HttpContext.Session.GetString("authenticated") != "true")
            return RedirectToPage("/Index");

        TotalWords = _triggerService.TotalWordCount;
        TotalCombos = _triggerService.TotalComboCount;
        UnlockedWords = _triggerService.UnlockedWordCount;
        UnlockedCombos = _triggerService.UnlockedComboCount;

        var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        WordsJson = JsonSerializer.Serialize(
            _triggerService.GetAllWords().Select(w => new { w.Word, w.Emoji }), opts);
        UnlockedWordSetJson = JsonSerializer.Serialize(
            _triggerService.GetUnlockedWordSet().ToList());

        return Page();
    }
}

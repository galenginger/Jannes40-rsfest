using System.Text.Json;
using DanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DanneFest.Pages;

public class ProjectorModel : PageModel
{
    private readonly TriggerService _triggerService;
    private readonly MessageHistoryService _historyService;
    private readonly IWebHostEnvironment _env;

    public int TotalWords { get; private set; }
    public int TotalCombos { get; private set; }
    public int UnlockedWords { get; private set; }
    public int UnlockedCombos { get; private set; }
    public int TotalMessages { get; private set; }
    public string HourlyMessageCountsJson { get; private set; } = "[]";
    public string LatestVmaMessage { get; private set; } = string.Empty;
    public string ProjectorHeadline { get; private set; } = string.Empty;
    public string ProjectorSubtext { get; private set; } = string.Empty;

    public string WordsJson { get; private set; } = "[]";
    public string UnlockedWordSetJson { get; private set; } = "[]";

    public ProjectorModel(TriggerService triggerService, MessageHistoryService historyService, IWebHostEnvironment env)
    {
        _triggerService = triggerService;
        _historyService = historyService;
        _env = env;
    }

    public IActionResult OnPostLogout()
    {
        HttpContext.Session.Clear();
        Response.Cookies.Delete("danne_auth");
        Response.Cookies.Delete("danne_name");
        Response.Cookies.Delete("danne_avatar");
        return RedirectToPage("/Index");
    }

    public IActionResult OnGet()
    {
        if (HttpContext.Session.GetString("authenticated") != "true")
            return RedirectToPage("/Index");

        TotalWords = _triggerService.TotalWordCount;
        TotalCombos = _triggerService.TotalComboCount;
        UnlockedWords = _triggerService.UnlockedWordCount;
        UnlockedCombos = _triggerService.UnlockedComboCount;
        TotalMessages = _historyService.GetTotalMessageCount();
        HourlyMessageCountsJson = JsonSerializer.Serialize(_historyService.GetLast12HoursMessageCounts());
        LatestVmaMessage = _historyService.GetLatestAnnouncementText();

        var projectorTextPath = Path.Combine(_env.ContentRootPath, "projectortext.txt");
        if (System.IO.File.Exists(projectorTextPath))
        {
            var lines = System.IO.File.ReadAllLines(projectorTextPath);
            if (lines.Length > 0)
                ProjectorHeadline = lines[0].Trim();
            if (lines.Length > 1)
                ProjectorSubtext = lines[1].Trim();
        }

        var opts = new JsonSerializerOptions { PropertyNamingPolicy = JsonNamingPolicy.CamelCase };
        WordsJson = JsonSerializer.Serialize(
            _triggerService.GetAllWords().Select(w => new { w.Word, w.Emoji }), opts);
        UnlockedWordSetJson = JsonSerializer.Serialize(
            _triggerService.GetUnlockedWordSet().ToList());

        return Page();
    }
}

using System.Text.Json;
using DanneFest.Hubs;
using DanneFest.Models;
using DanneFest.Services;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DanneFest.Pages;

public class ChatModel : PageModel
{
    private readonly TriggerService _triggerService;
    private readonly IHubContext<ChatHub> _hubContext;

    public string Username { get; private set; } = string.Empty;
    public string AvatarId { get; private set; } = string.Empty;
    public int TotalWords { get; private set; }
    public int TotalCombos { get; private set; }
    public int UnlockedWords { get; private set; }
    public int UnlockedCombos { get; private set; }

    public string WordsJson { get; private set; } = "[]";
    public string CombosJson { get; private set; } = "[]";
    public string UnlockedWordSetJson { get; private set; } = "[]";
    public string UnlockedComboSetJson { get; private set; } = "[]";

    public ChatModel(TriggerService triggerService, IHubContext<ChatHub> hubContext)
    {
        _triggerService = triggerService;
        _hubContext = hubContext;
    }

    public IActionResult OnGet()
    {
        var username = HttpContext.Session.GetString("username");
        if (string.IsNullOrWhiteSpace(username))
            return RedirectToPage("/Index");

        Username = username;
        AvatarId = HttpContext.Session.GetString("avatar_id") ?? string.Empty;
        TotalWords = _triggerService.TotalWordCount;
        TotalCombos = _triggerService.TotalComboCount;
        UnlockedWords = _triggerService.UnlockedWordCount;
        UnlockedCombos = _triggerService.UnlockedComboCount;

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

    public async Task<IActionResult> OnPostLogout()
    {
        var username = HttpContext.Session.GetString("username") ?? string.Empty;
        ChatHub.MarkParticipantLoggedOut(username);

        var participants = ChatHub.GetActiveParticipantsSnapshot();
        await _hubContext.Clients.All.SendAsync("UpdateParticipants", participants.Count);
        await _hubContext.Clients.All.SendAsync("UpdateParticipantList", participants);

        HttpContext.Session.Clear();
        Response.Cookies.Delete("danne_auth");
        Response.Cookies.Delete("danne_name");
        Response.Cookies.Delete("danne_avatar");
        return RedirectToPage("/Index");
    }
}

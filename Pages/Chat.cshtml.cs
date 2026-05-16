using System.Text.Json;
using DanneFest.Hubs;
using DanneFest.Models;
using DanneFest.Services;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.SignalR;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DanneFest.Pages;

public class ChatModel : PageModel
{
    private const long MaxImageBytes = 8 * 1024 * 1024;
    private static readonly HashSet<string> AllowedImageExtensions = new(StringComparer.OrdinalIgnoreCase)
    {
        ".jpg", ".jpeg", ".png", ".gif", ".webp"
    };

    private readonly TriggerService _triggerService;
    private readonly IHubContext<ChatHub> _hubContext;
    private readonly IWebHostEnvironment _env;

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

    public ChatModel(TriggerService triggerService, IHubContext<ChatHub> hubContext, IWebHostEnvironment env)
    {
        _triggerService = triggerService;
        _hubContext = hubContext;
        _env = env;
    }

    public async Task<IActionResult> OnPostUploadImageAsync(IFormFile? imageFile)
    {
        if (HttpContext.Session.GetString("username") is null)
            return Unauthorized();

        if (imageFile is null || imageFile.Length == 0)
            return BadRequest(new { error = "Ingen bild vald." });

        if (imageFile.Length > MaxImageBytes)
            return BadRequest(new { error = "Bilden är för stor. Max 8 MB." });

        var extension = Path.GetExtension(imageFile.FileName);
        if (!AllowedImageExtensions.Contains(extension))
            return BadRequest(new { error = "Filtypen stöds inte." });

        if (string.IsNullOrWhiteSpace(imageFile.ContentType) || !imageFile.ContentType.StartsWith("image/", StringComparison.OrdinalIgnoreCase))
            return BadRequest(new { error = "Ogiltig bildfil." });

        var uploadsDir = Path.Combine(_env.WebRootPath, "uploads");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{DateTime.UtcNow:yyyyMMddHHmmss}_{Guid.NewGuid():N}{extension.ToLowerInvariant()}";
        var fullPath = Path.Combine(uploadsDir, fileName);

        await using (var stream = System.IO.File.Create(fullPath))
        {
            await imageFile.CopyToAsync(stream);
        }

        var imageUrl = $"{Request.PathBase}/uploads/{fileName}";
        return new JsonResult(new { imageUrl });
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

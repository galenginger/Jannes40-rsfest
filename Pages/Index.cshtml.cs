using DanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace DanneFest.Pages;

public class IndexModel : PageModel
{
    private const string AuthCookieName = "danne_auth";
    private const string NameCookieName = "danne_name";
    private const string AvatarCookieName = "danne_avatar";

    private readonly TriggerService _triggerService;

    [BindProperty]
    public string Password { get; set; } = string.Empty;

    [BindProperty]
    public string? Username { get; set; }

    [BindProperty]
    public string? AvatarId { get; set; }

    public string? ErrorMessage { get; set; }

    // Förifyllt från cookie, används bara för formuläret — aldrig för auth
    public string SavedName { get; set; } = string.Empty;

    public IndexModel(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    public IActionResult OnGet()
    {
        var sessionName = HttpContext.Session.GetString("username");
        if (!string.IsNullOrWhiteSpace(sessionName))
            return RedirectToPage("/Chat");

        if (HttpContext.Session.GetString("authenticated") == "true")
            return RedirectToPage("/Projector");

        if (Request.Cookies[AuthCookieName] == "1")
        {
            HttpContext.Session.SetString("authenticated", "true");

            var cookieName = Request.Cookies[NameCookieName] ?? string.Empty;
            if (!string.IsNullOrWhiteSpace(cookieName))
            {
                var cleanName = cookieName.Trim();
                if (cleanName.Length > 50)
                    cleanName = cleanName[..50];

                var avatarFromCookie = NormalizeAvatarId(Request.Cookies[AvatarCookieName]);
                if (string.IsNullOrWhiteSpace(avatarFromCookie))
                {
                    avatarFromCookie = "name-" + cleanName.ToLowerInvariant();
                }

                HttpContext.Session.SetString("username", cleanName);
                HttpContext.Session.SetString("avatar_id", avatarFromCookie);
                return RedirectToPage("/Chat");
            }

            return RedirectToPage("/Projector");
        }

        SavedName = Request.Cookies[NameCookieName] ?? string.Empty;

        return Page();
    }

    public IActionResult OnPost()
    {
        var correctPassword = _triggerService.GetPassword();

        if (string.IsNullOrWhiteSpace(Password) || Password != correctPassword)
        {
            ErrorMessage = "Fel lösenord — försök igen!";
            SavedName = Request.Cookies[NameCookieName] ?? string.Empty;
            return Page();
        }

        HttpContext.Session.SetString("authenticated", "true");

        var cookieOptions = new CookieOptions
        {
            Expires = DateTimeOffset.UtcNow.AddDays(30),
            HttpOnly = true,
            SameSite = SameSiteMode.Lax,
            Secure = Request.IsHttps
        };

        Response.Cookies.Append(AuthCookieName, "1", cookieOptions);

        if (!string.IsNullOrWhiteSpace(Username))
        {
            var cleanName = Username.Trim();
            if (cleanName.Length > 50) cleanName = cleanName[..50];

            var cleanAvatarId = NormalizeAvatarId(AvatarId);
            if (string.IsNullOrEmpty(cleanAvatarId))
                cleanAvatarId = "name-" + cleanName.ToLowerInvariant();

            HttpContext.Session.SetString("username", cleanName);
            HttpContext.Session.SetString("avatar_id", cleanAvatarId);

            Response.Cookies.Append(NameCookieName, cleanName, cookieOptions);
            Response.Cookies.Append(AvatarCookieName, cleanAvatarId, cookieOptions);

            return RedirectToPage("/Chat");
        }

        return RedirectToPage("/Projector");
    }

    private static string NormalizeAvatarId(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
            return string.Empty;

        var cleaned = new string(value
            .Trim()
            .Where(c => char.IsLetterOrDigit(c) || c == '-' || c == '_')
            .ToArray());

        if (cleaned.Length > 64)
            cleaned = cleaned[..64];

        return cleaned;
    }
}

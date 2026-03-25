using JanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace JanneFest.Pages;

public class IndexModel : PageModel
{
    private readonly TriggerService _triggerService;

    [BindProperty]
    public string Password { get; set; } = string.Empty;

    [BindProperty]
    public string? Username { get; set; }

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

        SavedName = Request.Cookies["janne_name"] ?? string.Empty;

        return Page();
    }

    public IActionResult OnPost()
    {
        var correctPassword = _triggerService.GetPassword();

        if (string.IsNullOrWhiteSpace(Password) || Password != correctPassword)
        {
            ErrorMessage = "Fel lösenord — försök igen!";
            SavedName = Request.Cookies["janne_name"] ?? string.Empty;
            return Page();
        }

        HttpContext.Session.SetString("authenticated", "true");

        if (!string.IsNullOrWhiteSpace(Username))
        {
            var cleanName = Username.Trim();
            if (cleanName.Length > 50) cleanName = cleanName[..50];

            HttpContext.Session.SetString("username", cleanName);

            Response.Cookies.Append("janne_name", cleanName, new CookieOptions
            {
                Expires = DateTimeOffset.UtcNow.AddHours(12),
                HttpOnly = false,
                SameSite = SameSiteMode.Strict,
                Secure = Request.IsHttps
            });

            return RedirectToPage("/Chat");
        }

        return RedirectToPage("/Projector");
    }
}

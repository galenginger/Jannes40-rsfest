using JanneFest.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.RazorPages;

namespace JanneFest.Pages;

// Inloggningssida med två lägen:
//   1. Namnbaserad inloggning: lösenord + namn -> session -> /Chat
//   2. Projektor-läge: enbart lösenord -> session -> /Projector
//
// Användarnamnet sparas i server-side session, INTE från klientens cookie direkt.
// Cookie används bara för bekvämlighet (förifyllning av namnfältet vid återbesök).
public class IndexModel : PageModel
{
    private readonly TriggerService _triggerService;

    [BindProperty]
    public string Password { get; set; } = string.Empty;

    [BindProperty]
    public string? Username { get; set; }

    public string? ErrorMessage { get; set; }

    // Förifyllt namn från cookie (visas bara i formuläret, används inte för auth)
    public string SavedName { get; set; } = string.Empty;

    public IndexModel(TriggerService triggerService)
    {
        _triggerService = triggerService;
    }

    public IActionResult OnGet()
    {
        // Redan inloggad med namn -> gå direkt till chatten
        var sessionName = HttpContext.Session.GetString("username");
        if (!string.IsNullOrWhiteSpace(sessionName))
            return RedirectToPage("/Chat");

        // Autentiserad utan namn (projektor-läge)
        if (HttpContext.Session.GetString("authenticated") == "true")
            return RedirectToPage("/Projector");

        // Förifyll namnfältet från sparat cookie om det finns
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

        // Lösenordet stämmer -> märk sessionen som autentiserad
        HttpContext.Session.SetString("authenticated", "true");

        if (!string.IsNullOrWhiteSpace(Username))
        {
            var cleanName = Username.Trim();
            if (cleanName.Length > 50) cleanName = cleanName[..50];

            // Spara namn i server-side session -> klienten kan inte ändra detta (anti-fusk)
            HttpContext.Session.SetString("username", cleanName);

            // Spara i cookie för bekvämlighets skull (förifyllning vid nästa besök).
            // Cookien används ALDRIG för auth — det är sessionen som gäller.
            Response.Cookies.Append("janne_name", cleanName, new CookieOptions
            {
                Expires = DateTimeOffset.UtcNow.AddHours(12),
                HttpOnly = false,   // Måste vara läsbar av JS för förifyllning
                SameSite = SameSiteMode.Strict,
                Secure = Request.IsHttps
            });

            return RedirectToPage("/Chat");
        }

        // Inget namn -> projektor-läge
        return RedirectToPage("/Projector");
    }
}

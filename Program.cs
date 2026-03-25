using JanneFest.Hubs;
using JanneFest.Services;

// Lösenord kan ges som kommandoradsargument: dotnet run -- mittlösenord
// Stöder även --password mittlösenord
string? cliPassword = null;
for (int i = 0; i < args.Length; i++)
{
    if (args[i] == "--password" && i + 1 < args.Length)
    {
        cliPassword = args[i + 1];
        break;
    }
    else if (!args[i].StartsWith("--"))
    {
        cliPassword = args[i];
        break;
    }
}

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddRazorPages();

// SignalR för real-time chatt
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

// Session-stöd — används för anti-fusk (användarnamn lagras server-side, aldrig på klienten)
builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(24);
    options.Cookie.HttpOnly = true;                 // Förhindrar JS-åtkomst till session-cookie
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Strict;  // CSRF-skydd
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

// TriggerService som singleton — delas av alla samtida anslutningar
builder.Services.AddSingleton<TriggerService>();

var app = builder.Build();

if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseStaticFiles();
app.UseRouting();
app.UseSession();   // Måste ligga före MapRazorPages och MapHub

app.MapRazorPages();
app.MapHub<ChatHub>("/chathub");

// Ladda triggerwords.json en gång vid appstart (CLI-lösenord har företräde om angivet)
app.Services.GetRequiredService<TriggerService>().Initialize(cliPassword);

app.Run();

using DanneFest.Hubs;
using DanneFest.Services;
using Microsoft.AspNetCore.HttpOverrides;

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

builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
});

builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders =
        ForwardedHeaders.XForwardedFor |
        ForwardedHeaders.XForwardedProto;

    options.KnownProxies.Add(System.Net.IPAddress.Parse("127.0.0.1"));
});

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(24);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
    options.Cookie.SameSite = SameSiteMode.Strict;
    options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
});

builder.Services.AddSingleton<TriggerService>();

var app = builder.Build();

app.UseForwardedHeaders();

app.UsePathBase("/danne"); //Eftersom siten servas under suvnet.se/danne


if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();

app.MapRazorPages();
app.MapHub<ChatHub>("/chathub");

app.Services.GetRequiredService<TriggerService>().Initialize(cliPassword);

app.Run();

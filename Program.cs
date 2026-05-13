using DanneFest.Data;
using DanneFest.Hubs;
using DanneFest.Services;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.EntityFrameworkCore;

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
    options.KeepAliveInterval = TimeSpan.FromSeconds(30);
    options.ClientTimeoutInterval = TimeSpan.FromMinutes(60);
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

// Registrera Entity Framework med SQLite
var connectionString = $"Data Source=chat.db";
builder.Services.AddDbContext<ChatDbContext>(options =>
    options.UseSqlite(connectionString)
);

builder.Services.AddSingleton<TriggerService>();
builder.Services.AddScoped<MessageHistoryService>();

var app = builder.Build();

// Migrera databasen vid startup
using (var scope = app.Services.CreateScope())
{
    var dbContext = scope.ServiceProvider.GetRequiredService<ChatDbContext>();
    dbContext.Database.Migrate();
}

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

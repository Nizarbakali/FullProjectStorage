using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.Services;

var builder = WebApplication.CreateBuilder(args);

// ----------------------------------------------------
// Controllers
// ----------------------------------------------------
builder.Services
    .AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.ReferenceHandler =
            System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });

// ----------------------------------------------------
// Swagger
// ----------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// ----------------------------------------------------
// CORS: Allow React frontend
// ----------------------------------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactFrontend", policy =>
    {
        policy
            .WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174"
            )
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

// ----------------------------------------------------
// Database connection
// ----------------------------------------------------
var connectionString =
    builder.Configuration.GetConnectionString(
        "DefaultConnection");

if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "The connection string 'DefaultConnection' " +
        "was not found inside appsettings.json.");
}

builder.Services.AddDbContext<StorageDbContext>(
    options =>
        options.UseSqlServer(connectionString));

// ----------------------------------------------------
// Dependency injection
// ----------------------------------------------------
builder.Services.AddHttpClient<
    IGeocodingService,
    NominatimGeocodingService>(client =>
    {
        client.BaseAddress =
            new Uri("https://nominatim.openstreetmap.org/");

        client.DefaultRequestHeaders.UserAgent.ParseAdd(
            "GMDMetalStorage/1.0");

        client.DefaultRequestHeaders.AcceptLanguage.ParseAdd(
            "fr");

        client.Timeout = TimeSpan.FromSeconds(15);
    });

builder.Services.AddScoped<
    IDonneeService,
    DonneeService>();

builder.Services.AddScoped<
    IMagasinService,
    MagasinService>();

builder.Services.AddScoped<
    IRayonService,
    RayonService>();

builder.Services.AddScoped<
    IZoneService,
    ZoneService>();

builder.Services.AddScoped<
    ICaseService,
    CaseService>();

builder.Services.AddScoped<
    IArticleService,
    ArticleService>();

builder.Services.AddScoped<
    IForecastService,
    ForecastService>();

// ----------------------------------------------------
// Build application
// ----------------------------------------------------
var app = builder.Build();

// ----------------------------------------------------
// HTTP request pipeline
// ----------------------------------------------------
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseRouting();

app.UseCors("ReactFrontend");

app.UseAuthorization();

app.MapControllers();

app.Run();
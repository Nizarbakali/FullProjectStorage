using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
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
        "ConnectionStrings:DefaultConnection is not configured. Set it via " +
        "'dotnet user-secrets set \"ConnectionStrings:DefaultConnection\" \"...\"' " +
        "in Development, or the ConnectionStrings__DefaultConnection environment " +
        "variable elsewhere. See Storage_backend/README.md.");
}

builder.Services.AddDbContext<StorageDbContext>(
    options =>
        options.UseSqlServer(connectionString));

// ----------------------------------------------------
// JWT Authentication
// ----------------------------------------------------
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Set it via 'dotnet user-secrets set \"Jwt:Key\" \"...\"' " +
        "in Development, or the Jwt__Key environment variable elsewhere. See Storage_backend/README.md.");
}

builder.Services
    .AddAuthentication(options =>
    {
        options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
        options.DefaultChallengeScheme    = JwtBearerDefaults.AuthenticationScheme;
    })
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtSection["Issuer"],
            ValidAudience            = jwtSection["Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(
                Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

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

builder.Services.AddScoped<
    IAuthService,
    AuthService>();

builder.Services.AddScoped<
    IUserService,
    UserService>();

// ----------------------------------------------------
// Build application
// ----------------------------------------------------
var app = builder.Build();

// ----------------------------------------------------
// Seed default admin (runs once if no admin exists)
// ----------------------------------------------------
using (var scope = app.Services.CreateScope())
{
    var userService = scope.ServiceProvider.GetRequiredService<IUserService>();
    await userService.SeedDefaultAdminAsync();
}

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

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class AuthService : IAuthService
{
    private readonly IConfiguration    _config;
    private readonly StorageDbContext  _db;

    public AuthService(IConfiguration config, StorageDbContext db)
    {
        _config = config;
        _db     = db;
    }

    public async Task<LoginResponseDto?> LoginAsync(LoginRequestDto request)
    {
        var hash = HashPassword(request.Password);

        var user = await _db.AppUsers.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == request.Username.ToLower() &&
            u.PasswordHash == hash);

        if (user == null) return null;

        var token = GenerateToken(user.Username, user.Role);
        return new LoginResponseDto(token, user.Role, user.Username);
    }

    // ── Register ───────────────────────────────────────────────────────────────

    public async Task<LoginResponseDto> RegisterAsync(RegisterRequestDto request)
    {
        // Enforce unique username
        var exists = await _db.AppUsers
            .AnyAsync(u => u.Username.ToLower() == request.Username.ToLower());

        if (exists)
            throw new InvalidOperationException($"Le nom d'utilisateur \"{request.Username}\" est déjà pris.");

        var user = new AppUser
        {
            Username     = request.Username.Trim(),
            PasswordHash = HashPassword(request.Password),
            Role         = "user", // Self-registered accounts are always regular users
            CreatedAt    = DateTime.UtcNow
        };

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();

        var token = GenerateToken(user.Username, user.Role);
        return new LoginResponseDto(token, user.Role, user.Username);
    }

    // ── Password helpers ───────────────────────────────────────────────────────

    public static string HashPassword(string password)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
        return Convert.ToHexString(bytes).ToLower();
    }

    // ── Token generation ───────────────────────────────────────────────────────

    private string GenerateToken(string username, string role)
    {
        var jwtSection = _config.GetSection("Jwt");
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(jwtSection["Key"]!));

        var credentials = new SigningCredentials(
            key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub, username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            new Claim(ClaimTypes.Name, username),
            new Claim(ClaimTypes.Role, role),
        };

        var expiryMinutes = int.TryParse(
            jwtSection["ExpiryMinutes"], out var mins) ? mins : 60;

        var token = new JwtSecurityToken(
            issuer:             jwtSection["Issuer"],
            audience:           jwtSection["Audience"],
            claims:             claims,
            expires:            DateTime.UtcNow.AddMinutes(expiryMinutes),
            signingCredentials: credentials);

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

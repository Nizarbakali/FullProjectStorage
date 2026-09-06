using System.Globalization;
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
        var user = await _db.AppUsers.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == request.Username.ToLower());

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
            return null;

        // Accounts created before the PBKDF2 migration still carry a legacy
        // unsalted SHA-256 hash; upgrade it transparently on next successful login.
        if (IsLegacyHash(user.PasswordHash))
        {
            user.PasswordHash = HashPassword(request.Password);
            await _db.SaveChangesAsync();
        }

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
    //
    // Format: "PBKDF2.<iterations>.<base64 salt>.<base64 hash>". Accounts created
    // before this migration store a bare hex SHA-256 hash instead (no prefix) —
    // VerifyPassword still checks those, and LoginAsync rehashes into the new
    // format the next time that account logs in successfully.

    private const string Pbkdf2Prefix = "PBKDF2";
    private const int Pbkdf2Iterations = 100_000;
    private const int Pbkdf2SaltSize = 16;
    private const int Pbkdf2HashSize = 32;

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(Pbkdf2SaltSize);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            Pbkdf2Iterations,
            HashAlgorithmName.SHA256,
            Pbkdf2HashSize);

        return string.Join(
            '.',
            Pbkdf2Prefix,
            Pbkdf2Iterations.ToString(CultureInfo.InvariantCulture),
            Convert.ToBase64String(salt),
            Convert.ToBase64String(hash));
    }

    private static bool IsLegacyHash(string storedHash) =>
        !storedHash.StartsWith(Pbkdf2Prefix + ".", StringComparison.Ordinal);

    private static bool VerifyPassword(string password, string storedHash)
    {
        if (IsLegacyHash(storedHash))
        {
            var legacyHash = Convert.ToHexString(
                SHA256.HashData(Encoding.UTF8.GetBytes(password))).ToLower();

            return CryptographicOperations.FixedTimeEquals(
                Encoding.UTF8.GetBytes(legacyHash),
                Encoding.UTF8.GetBytes(storedHash));
        }

        var parts = storedHash.Split('.');

        if (parts.Length != 4 ||
            !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out var iterations))
        {
            return false;
        }

        byte[] salt;
        byte[] expected;

        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        var actual = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password),
            salt,
            iterations,
            HashAlgorithmName.SHA256,
            expected.Length);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
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

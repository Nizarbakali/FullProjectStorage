namespace StudentApi.Models.Entities;

public class AppUser
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    /// <summary>
    /// Salted PBKDF2 hash ("PBKDF2.iterations.salt.hash"). Accounts created
    /// before this scheme existed may still carry a legacy unsalted SHA-256
    /// hex hash; AuthService upgrades it automatically on next login.
    /// </summary>
    public string PasswordHash { get; set; } = null!;

    /// <summary>"admin" or "user"</summary>
    public string Role { get; set; } = "user";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

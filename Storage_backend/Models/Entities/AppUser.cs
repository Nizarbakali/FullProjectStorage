namespace StudentApi.Models.Entities;

public class AppUser
{
    public int UserId { get; set; }

    public string Username { get; set; } = null!;

    /// <summary>SHA-256 hex hash of the password.</summary>
    public string PasswordHash { get; set; } = null!;

    /// <summary>"admin" or "user"</summary>
    public string Role { get; set; } = "user";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

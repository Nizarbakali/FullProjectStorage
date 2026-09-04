namespace StudentApi.DTOs;

// ── Inbound ───────────────────────────────────────────────────────────────────

public class CreateUserDto
{
    public string Username { get; set; } = null!;
    public string Password { get; set; } = null!;

    /// <summary>"admin" or "user". Defaults to "user" if omitted.</summary>
    public string Role { get; set; } = "user";
}

public class UpdateUserDto
{
    /// <summary>Leave null to keep the current password.</summary>
    public string? Password { get; set; }

    /// <summary>Leave null to keep the current role.</summary>
    public string? Role { get; set; }
}

// ── Outbound ──────────────────────────────────────────────────────────────────

public class UserResponseDto
{
    public int    UserId    { get; set; }
    public string Username  { get; set; } = null!;
    public string Role      { get; set; } = null!;
    public DateTime CreatedAt { get; set; }
}

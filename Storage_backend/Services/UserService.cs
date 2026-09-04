using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class UserService : IUserService
{
    private readonly StorageDbContext _db;
    private readonly IConfiguration   _config;

    public UserService(StorageDbContext db, IConfiguration config)
    {
        _db     = db;
        _config = config;
    }

    // ── List ───────────────────────────────────────────────────────────────────

    public async Task<List<UserResponseDto>> GetAllAsync()
    {
        return await _db.AppUsers
            .OrderBy(u => u.CreatedAt)
            .Select(u => new UserResponseDto
            {
                UserId    = u.UserId,
                Username  = u.Username,
                Role      = u.Role,
                CreatedAt = u.CreatedAt
            })
            .ToListAsync();
    }

    // ── Create ─────────────────────────────────────────────────────────────────

    public async Task<UserResponseDto> CreateAsync(CreateUserDto dto)
    {
        var role = dto.Role?.ToLower() == "admin" ? "admin" : "user";

        // Enforce unique username (case-insensitive)
        var exists = await _db.AppUsers
            .AnyAsync(u => u.Username.ToLower() == dto.Username.ToLower());

        if (exists)
            throw new InvalidOperationException(
                $"Le nom d'utilisateur \"{dto.Username}\" est déjà pris.");

        var user = new AppUser
        {
            Username     = dto.Username.Trim(),
            PasswordHash = AuthService.HashPassword(dto.Password),
            Role         = role,
            CreatedAt    = DateTime.UtcNow
        };

        _db.AppUsers.Add(user);
        await _db.SaveChangesAsync();

        return ToDto(user);
    }

    // ── Update ─────────────────────────────────────────────────────────────────

    public async Task<UserResponseDto?> UpdateAsync(int id, UpdateUserDto dto)
    {
        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return null;

        if (!string.IsNullOrWhiteSpace(dto.Password))
            user.PasswordHash = AuthService.HashPassword(dto.Password);

        if (!string.IsNullOrWhiteSpace(dto.Role))
            user.Role = dto.Role.ToLower() == "admin" ? "admin" : "user";

        await _db.SaveChangesAsync();
        return ToDto(user);
    }

    // ── Delete ─────────────────────────────────────────────────────────────────

    public async Task<bool> DeleteAsync(int id, string requestingUsername)
    {
        // Find the requesting user to get their ID
        var requester = await _db.AppUsers
            .FirstOrDefaultAsync(u => u.Username.ToLower() == requestingUsername.ToLower());

        // Prevent self-deletion
        if (requester != null && requester.UserId == id)
            throw new InvalidOperationException(
                "Vous ne pouvez pas supprimer votre propre compte.");

        var user = await _db.AppUsers.FindAsync(id);
        if (user == null) return false;

        _db.AppUsers.Remove(user);
        await _db.SaveChangesAsync();
        return true;
    }

    // ── Seed default admin ─────────────────────────────────────────────────────

    public async Task SeedDefaultAdminAsync()
    {
        var anyAdmin = await _db.AppUsers
            .AnyAsync(u => u.Role == "admin");

        if (anyAdmin) return; // At least one admin already exists

        var section  = _config.GetSection("SeedAdmin");
        var username = section["Username"] ?? "admin";
        var password = section["Password"] ?? "Admin123!";

        _db.AppUsers.Add(new AppUser
        {
            Username     = username,
            PasswordHash = AuthService.HashPassword(password),
            Role         = "admin",
            CreatedAt    = DateTime.UtcNow
        });

        await _db.SaveChangesAsync();
    }

    // ── Helper ─────────────────────────────────────────────────────────────────

    private static UserResponseDto ToDto(AppUser u) => new()
    {
        UserId    = u.UserId,
        Username  = u.Username,
        Role      = u.Role,
        CreatedAt = u.CreatedAt
    };
}

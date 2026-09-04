using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentApi.DTOs;
using StudentApi.Services;

namespace StudentApi.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = "admin")]
public class UsersController : ControllerBase
{
    private readonly IUserService _users;

    public UsersController(IUserService users) => _users = users;

    // ── GET /api/users ─────────────────────────────────────────────────────────
    [HttpGet]
    public async Task<IActionResult> GetAll()
        => Ok(await _users.GetAllAsync());

    // ── POST /api/users ────────────────────────────────────────────────────────
    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username) ||
            string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest("Nom d'utilisateur et mot de passe requis.");

        try
        {
            var created = await _users.CreateAsync(dto);
            return CreatedAtAction(nameof(GetAll), new { id = created.UserId }, created);
        }
        catch (InvalidOperationException ex)
        {
            return Conflict(ex.Message);
        }
    }

    // ── PUT /api/users/{id} ────────────────────────────────────────────────────
    [HttpPut("{id:int}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateUserDto dto)
    {
        var updated = await _users.UpdateAsync(id, dto);
        if (updated == null) return NotFound();
        return Ok(updated);
    }

    // ── DELETE /api/users/{id} ─────────────────────────────────────────────────
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        var requestingUsername = User.Identity?.Name ?? "";

        try
        {
            var deleted = await _users.DeleteAsync(id, requestingUsername);
            if (!deleted) return NotFound();
            return NoContent();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(ex.Message);
        }
    }
}

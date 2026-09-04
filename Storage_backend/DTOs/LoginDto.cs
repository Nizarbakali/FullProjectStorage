namespace StudentApi.DTOs;

public record LoginRequestDto(string Username, string Password);

public record LoginResponseDto(string Token, string Role, string Username);

public record RegisterRequestDto(string Username, string Password);

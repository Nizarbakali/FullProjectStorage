using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IZoneService
{
    Task<IEnumerable<ZoneDto>> GetAllAsync();
    Task<ZoneDto?>             GetByIdAsync(int id);
    Task<ZoneDto>              CreateAsync(CreateZoneDto dto);
    Task<ZoneDto?>             UpdateAsync(int id, UpdateZoneDto dto);
    Task<bool>                 DeleteAsync(int id);
}

using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IRayonService
{
    Task<IEnumerable<RayonDto>> GetAllAsync();
    Task<RayonDto?>             GetByIdAsync(int id);
    Task<RayonDto>              CreateAsync(CreateRayonDto dto);
    Task<RayonDto?>             UpdateAsync(int id, UpdateRayonDto dto);
    Task<bool>                  DeleteAsync(int id);
}

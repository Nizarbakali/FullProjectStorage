using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IMagasinService
{
    Task<IEnumerable<MagasinDto>> GetAllAsync();
    Task<MagasinDto?>             GetByIdAsync(int id);
    Task<MagasinDto>              CreateAsync(CreateMagasinDto dto);
    Task<MagasinDto?>             UpdateAsync(int id, UpdateMagasinDto dto);
    Task<bool>                    DeleteAsync(int id);
}

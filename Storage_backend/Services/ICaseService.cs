using StudentApi.DTOs;

namespace StudentApi.Services;

public interface ICaseService
{
    Task<IEnumerable<CaseDto>> GetAllAsync();
    Task<CaseDto?>             GetByIdAsync(int id);
    Task<CaseDto>              CreateAsync(CreateCaseDto dto);
    Task<CaseDto?>             UpdateAsync(int id, UpdateCaseDto dto);
    Task<bool>                 DeleteAsync(int id);
}

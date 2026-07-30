using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IDonneeService
{
    Task<IEnumerable<DonneeRowDto>> GetAllAsync();

    Task<DonneeRowDto?> GetByIdAsync(int id);

    Task<DonneeRowDto> CreateAsync(CreateDonneeDto dto);

    Task<DonneeRowDto?> UpdateAsync(
        int id,
        UpdateDonneeDto dto);

    Task<bool> DeleteAsync(int id);

    Task<CsvScanResultDto> ScanCsvAsync(IFormFile file);

    Task<CsvUploadResultDto> UploadCsvAsync(IFormFile file);
}
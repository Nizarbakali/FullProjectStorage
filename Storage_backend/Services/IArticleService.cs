using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IArticleService
{
    Task<IEnumerable<ArticleDto>> GetAllAsync();
    Task<ArticleDto?> GetByIdAsync(int id);
    Task<ArticleDto> CreateAsync(CreateArticleDto dto);
    Task<ArticleDto?> UpdateAsync(int id, UpdateArticleDto dto);
    Task<DeleteResultDto?> DeleteAsync(int id);

    Task<IEnumerable<ArticleThresholdDto>> GetThresholdsAsync();
    Task<bool> UpdateThresholdsAsync(
        int id,
        UpdateArticleThresholdsDto dto);
}
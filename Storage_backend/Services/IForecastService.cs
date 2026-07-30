using StudentApi.DTOs;

namespace StudentApi.Services;

public interface IForecastService
{
    Task<ForecastDto> ForecastNextYearAsync(string articleName);
}

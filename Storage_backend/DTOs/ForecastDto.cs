namespace StudentApi.DTOs;

public class ForecastRequestDto
{
    public string ArticleName { get; set; } = string.Empty;
}

public class ForecastDto
{
    public string ArticleName { get; set; } = string.Empty;
    public int Year { get; set; }
    public List<int> MonthlyQuantiteEntrer { get; set; } = [];
    public List<int> MonthlyQuantiteSortie { get; set; } = [];
}

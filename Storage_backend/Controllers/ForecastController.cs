using Microsoft.AspNetCore.Mvc;
using StudentApi.DTOs;
using StudentApi.Services;

namespace StudentApi.Controllers;

[ApiController]
[Route("api/forecast")]
public class ForecastController : ControllerBase
{
    private readonly IForecastService _forecastService;
    public ForecastController(IForecastService forecastService) => _forecastService = forecastService;

    [HttpPost]
    public async Task<IActionResult> Predict(ForecastRequestDto request)
    {
        if (string.IsNullOrWhiteSpace(request.ArticleName)) return BadRequest("Un article est requis.");
        try { return Ok(await _forecastService.ForecastNextYearAsync(request.ArticleName)); }
        catch (KeyNotFoundException ex) { return NotFound(ex.Message); }
        catch (Exception ex) { return Problem(ex.Message); }
    }
}

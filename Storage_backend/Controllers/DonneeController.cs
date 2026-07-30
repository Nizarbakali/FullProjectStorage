using Microsoft.AspNetCore.Mvc;
using StudentApi.DTOs;
using StudentApi.Services;

namespace StudentApi.Controllers;

[ApiController]
[Route("api/MonthlyData")]
public class MonthlyDataController : ControllerBase
{
    private readonly IDonneeService _donneeService;

    public MonthlyDataController(IDonneeService donneeService)
    {
        _donneeService = donneeService;
    }

    // GET api/MonthlyData
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DonneeRowDto>>> GetAll()
    {
        var data = await _donneeService.GetAllAsync();
        return Ok(data);
    }

    // GET api/MonthlyData/5
    [HttpGet("{id:int}")]
    public async Task<ActionResult<DonneeRowDto>> GetById(int id)
    {
        var data = await _donneeService.GetByIdAsync(id);

        if (data == null)
            return NotFound($"Le mouvement {id} est introuvable.");

        return Ok(data);
    }

    // POST api/MonthlyData
    [HttpPost]
    public async Task<ActionResult<DonneeRowDto>> Create(
        [FromBody] CreateDonneeDto dto)
    {
        try
        {
            var created = await _donneeService.CreateAsync(dto);

            return CreatedAtAction(
                nameof(GetById),
                new { id = created.DonneeId },
                created);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // PUT api/MonthlyData/5
    [HttpPut("{id:int}")]
    public async Task<ActionResult<DonneeRowDto>> Update(
        int id,
        [FromBody] UpdateDonneeDto dto)
    {
        try
        {
            var updated = await _donneeService.UpdateAsync(id, dto);

            if (updated == null)
                return NotFound($"Le mouvement {id} est introuvable.");

            return Ok(updated);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // DELETE api/MonthlyData/5
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Delete(int id)
    {
        try
        {
            var deleted = await _donneeService.DeleteAsync(id);

            if (!deleted)
                return NotFound($"Le mouvement {id} est introuvable.");

            return NoContent();
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // POST api/MonthlyData/scan
    [HttpPost("scan")]
    public async Task<ActionResult<CsvScanResultDto>> Scan(
        [FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Aucun fichier fourni.");

        if (!file.FileName.EndsWith(
                ".csv",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(
                "Seuls les fichiers .csv sont acceptés.");
        }

        try
        {
            var result = await _donneeService.ScanCsvAsync(file);
            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // POST api/MonthlyData/upload
    [HttpPost("upload")]
    public async Task<ActionResult<CsvUploadResultDto>> Upload(
        [FromForm] IFormFile file)
    {
        if (file == null || file.Length == 0)
            return BadRequest("Aucun fichier fourni.");

        if (!file.FileName.EndsWith(
                ".csv",
                StringComparison.OrdinalIgnoreCase))
        {
            return BadRequest(
                "Seuls les fichiers .csv sont acceptés.");
        }

        try
        {
            var result = await _donneeService.UploadCsvAsync(file);

            if (!result.Succes)
                return BadRequest(result);

            return Ok(result);
        }
        catch (ArgumentException exception)
        {
            return BadRequest(exception.Message);
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }
}
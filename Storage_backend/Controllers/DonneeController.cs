using Microsoft.AspNetCore.Authorization;
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
    [Authorize]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<DonneeRowDto>>> GetAll()
    {
        var data = await _donneeService.GetAllAsync();
        return Ok(data);
    }

    // GET api/MonthlyData/5
    [Authorize]
    [HttpGet("{id:int}")]
    public async Task<ActionResult<DonneeRowDto>> GetById(int id)
    {
        var data = await _donneeService.GetByIdAsync(id);

        if (data == null)
            return NotFound($"Le mouvement {id} est introuvable.");

        return Ok(data);
    }

    // POST api/MonthlyData
    [Authorize(Roles = "admin")]
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
    [Authorize(Roles = "admin")]
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
    [Authorize(Roles = "admin")]
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

    // DELETE api/MonthlyData/purge
    // Vide les données mensuelles et les Articles. L'infrastructure
    // (Magasins, Rayons, Zones, Cases) et les comptes sont conservés.
    [Authorize(Roles = "admin")]
    [HttpDelete("purge")]
    public async Task<ActionResult<PurgeResultDto>> Purge()
    {
        try
        {
            return Ok(await _donneeService.PurgeAllAsync());
        }
        catch (InvalidOperationException exception)
        {
            return BadRequest(exception.Message);
        }
    }

    // POST api/MonthlyData/scan
    // Simulation : renvoie exactement le rapport qu'aurait produit l'import,
    // corrections comprises, sans rien écrire. Alimente l'aperçu.
    [Authorize(Roles = "admin")]
    [HttpPost("scan")]
    public async Task<ActionResult<CsvUploadResultDto>> Scan(
        [FromForm] IFormFile file,
        [FromQuery] bool replace = false)
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
            // Une simulation dont le verdict est « invalide » reste un
            // résultat exploitable : l'aperçu doit pouvoir afficher pourquoi.
            var result = await _donneeService.SimulateCsvAsync(
                file,
                replace);
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
    [Authorize(Roles = "admin")]
    [HttpPost("upload")]
    // replace=true : purge les mouvements et les Articles avant d'écrire.
    // L'infrastructure (Magasins, Rayons, Zones, Cases) est conservée.
    public async Task<ActionResult<CsvUploadResultDto>> Upload(
        [FromForm] IFormFile file,
        [FromQuery] bool replace = false)
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
            var result = await _donneeService.UploadCsvAsync(
                file,
                replace);

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
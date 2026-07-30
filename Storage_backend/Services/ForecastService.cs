using System.Diagnostics;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class ForecastService : IForecastService
{
    private readonly StorageDbContext _context;
    private readonly IWebHostEnvironment _environment;

    public ForecastService(StorageDbContext context, IWebHostEnvironment environment)
    {
        _context = context;
        _environment = environment;
    }

    public async Task<ForecastDto> ForecastNextYearAsync(string articleName)
    {
        var normalizedName = articleName.Trim();
        var query = _context.Donnees.AsNoTracking().AsQueryable();

        if (normalizedName.ToLower() != "general")
        {
            query = query.Include(d => d.Article).Where(d => d.Article.NomArticle == normalizedName);
        }

        var rawRows = await query.ToListAsync();
        var rows = rawRows
            .GroupBy(d => d.Mois.ToString("yyyy-MM"))
            .Select(g => new { month = g.Key, quantiteEntrer = g.Sum(x => x.QuantiteEntrer), quantiteSortie = g.Sum(x => x.QuantiteSortie) })
            .OrderBy(d => d.month)
            .ToList();

        if (rows.Count == 0) throw new KeyNotFoundException("Aucune donnée n'existe pour cet article.");

        var scriptPath = Path.Combine(_environment.ContentRootPath, "Python", "forecast.py");
        // Windows' Python launcher is available even when the optional `python` app alias is disabled.
        var startInfo = new ProcessStartInfo("py", $"\"{scriptPath}\"")
        {
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using var process = Process.Start(startInfo) ?? throw new InvalidOperationException("Impossible de lancer Python.");
        await process.StandardInput.WriteAsync(JsonSerializer.Serialize(new { articleName = normalizedName, rows }));
        process.StandardInput.Close();
        var outputTask = process.StandardOutput.ReadToEndAsync();
        var errorTask = process.StandardError.ReadToEndAsync();
        await process.WaitForExitAsync();
        var output = await outputTask;
        var error = await errorTask;

        if (process.ExitCode != 0) throw new InvalidOperationException($"La prévision Python a échoué : {error}");
        return JsonSerializer.Deserialize<ForecastDto>(output, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })
            ?? throw new InvalidOperationException("Réponse de prévision Python invalide.");
    }
}

using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class CaseService : ICaseService
{
    private readonly StorageDbContext _context;

    public CaseService(StorageDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CaseDto>> GetAllAsync()
    {
        var cases = await CaseQuery()
            .AsNoTracking()
            .AsSplitQuery()
            .ToListAsync();

        return cases
            .Select(MapToDto)
            .OrderBy(c => c.FullLocation)
            .ToList();
    }

    public async Task<CaseDto?> GetByIdAsync(int id)
    {
        var @case = await CaseQuery()
            .AsNoTracking()
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.CaseId == id);

        return @case == null
            ? null
            : MapToDto(@case);
    }

    public async Task<CaseDto> CreateAsync(
        CreateCaseDto dto)
    {
        var code = ValidateAndNormalize(dto);

        var zoneExists = await _context.Zones
            .AnyAsync(z => z.ZoneId == dto.ZoneId);

        if (!zoneExists)
        {
            throw new ArgumentException(
                $"La Zone {dto.ZoneId} est introuvable.");
        }

        await EnsureUniqueCodeAsync(
            dto.ZoneId,
            code);

        var @case = new Case
        {
            ZoneId = dto.ZoneId,
            CodeCase = code,
            PositionCase = dto.PositionCase,
            CapaciteMaximum = dto.CapaciteMaximum,
            Statut = "Disponible"
        };

        _context.Cases.Add(@case);
        await _context.SaveChangesAsync();

        var created = await GetByIdAsync(@case.CaseId);
        return created!;
    }

    public async Task<CaseDto?> UpdateAsync(
        int id,
        UpdateCaseDto dto)
    {
        var code = ValidateAndNormalize(dto);

        var @case = await CaseQuery()
            .AsSplitQuery()
            .FirstOrDefaultAsync(c => c.CaseId == id);

        if (@case == null)
            return null;

        var zoneExists = await _context.Zones
            .AnyAsync(z => z.ZoneId == dto.ZoneId);

        if (!zoneExists)
        {
            throw new ArgumentException(
                $"La Zone {dto.ZoneId} est introuvable.");
        }

        await EnsureUniqueCodeAsync(
            dto.ZoneId,
            code,
            id);

        var affectedArticleIds = @case.Articles
            .Select(a => a.ArticleId)
            .ToList();

        var currentQuantity = @case.Donnees.Sum(
            d => d.QuantiteEntrer - d.QuantiteSortie);

        @case.ZoneId = dto.ZoneId;
        @case.CodeCase = code;
        @case.PositionCase = dto.PositionCase;
        @case.CapaciteMaximum = dto.CapaciteMaximum;
        @case.Statut = ComputeStatut(
            currentQuantity,
            dto.CapaciteMaximum);

        await _context.SaveChangesAsync();

        var zoneReference = _context.Entry(@case)
            .Reference(c => c.Zone);

        zoneReference.IsLoaded = false;

        await zoneReference
            .Query()
            .Include(z => z.Rayon)
                .ThenInclude(r => r.Magasin)
            .LoadAsync();

        foreach (var articleId in affectedArticleIds)
            await RecomputeArticleFullLocationAsync(articleId);

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var @case = await _context.Cases
            .Include(c => c.Articles)
            .Include(c => c.Donnees)
            .FirstOrDefaultAsync(c => c.CaseId == id);

        if (@case == null)
            return false;

        if (@case.Donnees.Any())
        {
            throw new InvalidOperationException(
                "Impossible de supprimer cette Case : elle possède " +
                "un historique de mouvements. Supprimez ou déplacez " +
                "d'abord ses mouvements depuis Données Mensuelles.");
        }

        var affectedArticles = @case.Articles.ToList();

        foreach (var article in affectedArticles)
            article.Cases.Remove(@case);

        _context.Cases.Remove(@case);
        await _context.SaveChangesAsync();

        foreach (var article in affectedArticles)
        {
            article.FullLocation =
                BuildArticleFullLocation(article.Cases);
        }

        await _context.SaveChangesAsync();
        return true;
    }

    internal static string ComputeStatut(
        int currentQuantity,
        int maximumCapacity)
    {
        return currentQuantity > 0 &&
               currentQuantity >= maximumCapacity
            ? "Plein"
            : "Disponible";
    }

    private IQueryable<Case> CaseQuery()
    {
        return _context.Cases
            .Include(c => c.Zone)
                .ThenInclude(z => z.Rayon)
                    .ThenInclude(r => r.Magasin)
            .Include(c => c.Articles)
            .Include(c => c.Donnees);
    }

    private async Task RecomputeArticleFullLocationAsync(
        int articleId)
    {
        var article = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .FirstOrDefaultAsync(
                a => a.ArticleId == articleId);

        if (article == null)
            return;

        article.FullLocation =
            BuildArticleFullLocation(article.Cases);
    }

    private async Task EnsureUniqueCodeAsync(
        int zoneId,
        string code,
        int? excludedCaseId = null)
    {
        var duplicate = await _context.Cases.AnyAsync(c =>
            c.ZoneId == zoneId &&
            c.CodeCase == code &&
            (!excludedCaseId.HasValue ||
             c.CaseId != excludedCaseId.Value));

        if (duplicate)
        {
            throw new InvalidOperationException(
                $"La Case {code} existe déjà dans cette Zone.");
        }
    }

    private static string ValidateAndNormalize(
        CreateCaseDto dto)
    {
        return ValidateAndNormalize(
            dto.CodeCase,
            dto.CapaciteMaximum);
    }

    private static string ValidateAndNormalize(
        UpdateCaseDto dto)
    {
        return ValidateAndNormalize(
            dto.CodeCase,
            dto.CapaciteMaximum);
    }

    private static string ValidateAndNormalize(
        string codeCase,
        int maximumCapacity)
    {
        var code = (codeCase ?? string.Empty)
            .Trim()
            .ToUpperInvariant();

        if (string.IsNullOrWhiteSpace(code))
        {
            throw new ArgumentException(
                "Le code de la Case est obligatoire.");
        }

        if (maximumCapacity <= 0)
        {
            throw new ArgumentException(
                "La capacité maximale doit être supérieure à 0.");
        }

        return code;
    }

    private static CaseDto MapToDto(
        Case @case)
    {
        var currentQuantity = @case.Donnees.Sum(
            d => d.QuantiteEntrer - d.QuantiteSortie);

        var exceeded =
            currentQuantity > @case.CapaciteMaximum;

        var remaining = Math.Max(
            0,
            @case.CapaciteMaximum - currentQuantity);

        var occupancyRate =
            @case.CapaciteMaximum <= 0
                ? 0
                : Math.Round(
                    currentQuantity * 100m /
                    @case.CapaciteMaximum,
                    2);

        return new CaseDto
        {
            CaseId = @case.CaseId,
            ZoneId = @case.ZoneId,
            CodeZone = @case.Zone.CodeZone,
            CodeCase = @case.CodeCase,
            FullLocation = BuildCaseLocation(@case),
            PositionCase = @case.PositionCase,
            CapaciteMaximum = @case.CapaciteMaximum,
            QuantiteActuelle = currentQuantity,
            CapaciteRestante = remaining,
            CapaciteDepassee = exceeded,
            QuantiteDepassee = exceeded
                ? currentQuantity - @case.CapaciteMaximum
                : 0,
            TauxOccupation = occupancyRate,
            ArticlesCount = @case.Articles.Count,
            Statut = ComputeStatut(
                currentQuantity,
                @case.CapaciteMaximum)
        };
    }

    private static string BuildCaseLocation(
        Case @case)
    {
        return
            $"{@case.Zone.Rayon.Magasin.NomMagasin} > " +
            $"{@case.Zone.Rayon.CodeRayon} > " +
            $"{@case.Zone.CodeZone} > " +
            $"{@case.CodeCase}";
    }

    private static string? BuildArticleFullLocation(
        IEnumerable<Case> cases)
    {
        var locations = cases
            .Where(c => c.Zone?.Rayon?.Magasin != null)
            .Select(BuildCaseLocation)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(location => location)
            .ToList();

        return locations.Count == 0
            ? null
            : string.Join(" | ", locations);
    }
}
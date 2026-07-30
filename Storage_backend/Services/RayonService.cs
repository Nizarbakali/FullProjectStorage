using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class RayonService : IRayonService
{
    private readonly StorageDbContext _context;

    public RayonService(StorageDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<RayonDto>> GetAllAsync()
    {
        return await _context.Rayons
            .AsNoTracking()
            .Include(r => r.Magasin)
            .Select(r => new RayonDto
            {
                RayonId = r.RayonId,
                MagasinId = r.MagasinId,
                CodeMagasin =
                    r.Magasin.CodeMagasin,
                NomMagasin =
                    r.Magasin.NomMagasin,
                CodeRayon = r.CodeRayon,
                NomRayon = r.NomRayon,
                Actif = r.Actif,
                ZonesCount = r.Zones.Count
            })
            .OrderBy(r => r.CodeMagasin)
            .ThenBy(r => r.CodeRayon)
            .ToListAsync();
    }

    public async Task<RayonDto?> GetByIdAsync(int id)
    {
        var rayon = await _context.Rayons
            .AsNoTracking()
            .Include(r => r.Magasin)
            .Include(r => r.Zones)
            .FirstOrDefaultAsync(
                r => r.RayonId == id);

        return rayon == null
            ? null
            : MapToDto(rayon);
    }

    public async Task<RayonDto> CreateAsync(
        CreateRayonDto dto)
    {
        var rayon = new Rayon
        {
            MagasinId = dto.MagasinId,

            CodeRayon = dto.CodeRayon
                .Trim()
                .ToUpperInvariant(),

            NomRayon = dto.NomRayon?.Trim(),

            Actif = dto.Actif
        };

        _context.Rayons.Add(rayon);
        await _context.SaveChangesAsync();

        await _context.Entry(rayon)
            .Reference(r => r.Magasin)
            .LoadAsync();

        return MapToDto(rayon);
    }

    public async Task<RayonDto?> UpdateAsync(
        int id,
        UpdateRayonDto dto)
    {
        var rayon = await _context.Rayons
            .Include(r => r.Magasin)
            .Include(r => r.Zones)
            .FirstOrDefaultAsync(
                r => r.RayonId == id);

        if (rayon == null)
            return null;

        rayon.MagasinId = dto.MagasinId;

        rayon.CodeRayon = dto.CodeRayon
            .Trim()
            .ToUpperInvariant();

        rayon.NomRayon = dto.NomRayon?.Trim();

        rayon.Actif = dto.Actif;

        await _context.SaveChangesAsync();

        var magasinReference = _context.Entry(rayon)
            .Reference(r => r.Magasin);

        magasinReference.IsLoaded = false;
        await magasinReference.LoadAsync();

        await RecomputeFullLocationsAsync(id);

        return MapToDto(rayon);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var rayon = await _context.Rayons
            .FirstOrDefaultAsync(
                r => r.RayonId == id);

        if (rayon == null)
            return false;

        await using var transaction =
            await _context.Database
                .BeginTransactionAsync();

        try
        {
            var zoneIds = await _context.Zones
                .Where(z => z.RayonId == id)
                .Select(z => z.ZoneId)
                .ToListAsync();

            var caseIds = await _context.Cases
                .Where(c =>
                    zoneIds.Contains(c.ZoneId))
                .Select(c => c.CaseId)
                .ToListAsync();

            var hasMovements = await _context.Donnees
                .AnyAsync(d =>
                    d.CaseId.HasValue &&
                    caseIds.Contains(d.CaseId.Value));

            if (hasMovements)
            {
                throw new InvalidOperationException(
                    "Impossible de supprimer ce Rayon : une ou " +
                    "plusieurs Cases possèdent un historique de " +
                    "mouvements. Supprimez ou déplacez d'abord ces " +
                    "mouvements depuis Données Mensuelles.");
            }

            var impactedArticleIds =
                await _context.Articles
                    .Where(a => a.Cases.Any(c =>
                        caseIds.Contains(c.CaseId)))
                    .Select(a => a.ArticleId)
                    .Distinct()
                    .ToListAsync();

            if (caseIds.Count > 0)
            {
                await _context.Cases
                    .Where(c =>
                        caseIds.Contains(c.CaseId))
                    .ExecuteDeleteAsync();
            }

            if (zoneIds.Count > 0)
            {
                await _context.Zones
                    .Where(z =>
                        zoneIds.Contains(z.ZoneId))
                    .ExecuteDeleteAsync();
            }

            _context.Rayons.Remove(rayon);
            await _context.SaveChangesAsync();

            await RecomputeArticlesFullLocationsAsync(
                impactedArticleIds);

            await transaction.CommitAsync();

            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    private async Task RecomputeFullLocationsAsync(
        int rayonId)
    {
        var articles = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .Where(a =>
                a.Cases.Any(c =>
                    c.Zone.RayonId == rayonId))
            .ToListAsync();

        foreach (var article in articles)
        {
            article.FullLocation =
                MagasinService.BuildFullLocation(
                    article.Cases);
        }

        await _context.SaveChangesAsync();
    }

    private async Task
        RecomputeArticlesFullLocationsAsync(
            IEnumerable<int> articleIds)
    {
        var ids = articleIds
            .Distinct()
            .ToList();

        if (ids.Count == 0)
            return;

        var articles = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .Where(a =>
                ids.Contains(a.ArticleId))
            .ToListAsync();

        foreach (var article in articles)
        {
            article.FullLocation =
                MagasinService.BuildFullLocation(
                    article.Cases);
        }

        await _context.SaveChangesAsync();
    }

    private static RayonDto MapToDto(
        Rayon rayon)
    {
        return new RayonDto
        {
            RayonId = rayon.RayonId,
            MagasinId = rayon.MagasinId,

            CodeMagasin =
                rayon.Magasin?.CodeMagasin ??
                string.Empty,

            NomMagasin =
                rayon.Magasin?.NomMagasin ??
                string.Empty,

            CodeRayon = rayon.CodeRayon,

            NomRayon = rayon.NomRayon,

            Actif = rayon.Actif,

            ZonesCount =
                rayon.Zones?.Count ?? 0
        };
    }
}
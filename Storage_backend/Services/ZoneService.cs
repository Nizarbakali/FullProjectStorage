using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class ZoneService : IZoneService
{
    private readonly StorageDbContext _context;

    public ZoneService(StorageDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ZoneDto>> GetAllAsync()
    {
        return await _context.Zones
            .AsNoTracking()
            .Include(z => z.Rayon)
            .Select(z => new ZoneDto
            {
                ZoneId = z.ZoneId,
                RayonId = z.RayonId,
                CodeRayon = z.Rayon.CodeRayon,
                NomRayon = z.Rayon.NomRayon,
                CodeZone = z.CodeZone,
                NumeroLigne = z.NumeroLigne,
                Actif = z.Actif,
                CasesCount = z.Cases.Count
            })
            .OrderBy(z => z.CodeRayon)
            .ThenBy(z => z.CodeZone)
            .ToListAsync();
    }

    public async Task<ZoneDto?> GetByIdAsync(int id)
    {
        var zone = await _context.Zones
            .AsNoTracking()
            .Include(z => z.Rayon)
            .Include(z => z.Cases)
            .FirstOrDefaultAsync(
                z => z.ZoneId == id);

        return zone == null
            ? null
            : MapToDto(zone);
    }

    public async Task<ZoneDto> CreateAsync(
        CreateZoneDto dto)
    {
        var zone = new Zone
        {
            RayonId = dto.RayonId,

            CodeZone = dto.CodeZone
                .Trim()
                .ToUpperInvariant(),

            NumeroLigne = dto.NumeroLigne,

            Actif = dto.Actif
        };

        _context.Zones.Add(zone);
        await _context.SaveChangesAsync();

        await _context.Entry(zone)
            .Reference(z => z.Rayon)
            .LoadAsync();

        return MapToDto(zone);
    }

    public async Task<ZoneDto?> UpdateAsync(
        int id,
        UpdateZoneDto dto)
    {
        var zone = await _context.Zones
            .Include(z => z.Rayon)
            .Include(z => z.Cases)
            .FirstOrDefaultAsync(
                z => z.ZoneId == id);

        if (zone == null)
            return null;

        // Réaffecter le FK ne remplace pas la navigation déjà chargée : après
        // SaveChanges, zone.Rayon pointerait encore sur l'ancien Rayon et
        // FullLocation serait reconstruit depuis le mauvais parent. On charge
        // donc le Rayon cible (avec son Magasin) et on l'affecte directement.
        // Cette lecture vaut aussi validation : un RayonId inconnu remonte en
        // 400 au lieu d'une violation de clé étrangère.
        var rayon = await _context.Rayons
            .Include(r => r.Magasin)
            .FirstOrDefaultAsync(
                r => r.RayonId == dto.RayonId);

        if (rayon == null)
        {
            throw new ArgumentException(
                $"Le Rayon {dto.RayonId} est introuvable.");
        }

        zone.Rayon = rayon;
        zone.RayonId = dto.RayonId;

        zone.CodeZone = dto.CodeZone
            .Trim()
            .ToUpperInvariant();

        zone.NumeroLigne = dto.NumeroLigne;

        zone.Actif = dto.Actif;

        await _context.SaveChangesAsync();

        await RecomputeFullLocationsAsync(id);

        return MapToDto(zone);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var zone = await _context.Zones
            .FirstOrDefaultAsync(
                z => z.ZoneId == id);

        if (zone == null)
            return false;

        await using var transaction =
            await _context.Database
                .BeginTransactionAsync();

        try
        {
            var caseIds = await _context.Cases
                .Where(c => c.ZoneId == id)
                .Select(c => c.CaseId)
                .ToListAsync();

            var hasMovements = await _context.Donnees
                .AnyAsync(d =>
                    d.CaseId.HasValue &&
                    caseIds.Contains(d.CaseId.Value));

            if (hasMovements)
            {
                throw new InvalidOperationException(
                    "Impossible de supprimer cette Zone : une ou " +
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

            _context.Zones.Remove(zone);
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
        int zoneId)
    {
        var articles = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .Where(a =>
                a.Cases.Any(c =>
                    c.ZoneId == zoneId))
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

    private static ZoneDto MapToDto(
        Zone zone)
    {
        return new ZoneDto
        {
            ZoneId = zone.ZoneId,

            RayonId = zone.RayonId,

            CodeRayon =
                zone.Rayon?.CodeRayon ??
                string.Empty,

            NomRayon =
                zone.Rayon?.NomRayon,

            CodeZone = zone.CodeZone,

            NumeroLigne = zone.NumeroLigne,

            Actif = zone.Actif,

            CasesCount =
                zone.Cases?.Count ?? 0
        };
    }
}
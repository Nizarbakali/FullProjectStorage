using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class MagasinService : IMagasinService
{
    private readonly StorageDbContext _context;
    private readonly IGeocodingService _geocodingService;
    private readonly ILogger<MagasinService> _logger;

    public MagasinService(
        StorageDbContext context,
        IGeocodingService geocodingService,
        ILogger<MagasinService> logger)
    {
        _context = context;
        _geocodingService = geocodingService;
        _logger = logger;
    }

    public async Task<IEnumerable<MagasinDto>> GetAllAsync()
    {
        var magasins = await _context.Magasins
            .Include(m => m.Rayons)
            .OrderBy(m => m.CodeMagasin)
            .ToListAsync();

        var coordinatesChanged = false;

        foreach (var magasin in magasins.Where(
            NeedsCoordinates))
        {
            try
            {
                var coordinates =
                    await _geocodingService
                        .FindCoordinatesAsync(
                            magasin.Ville,
                            magasin.Pays);

                if (coordinates is null)
                    continue;

                magasin.Latitude =
                    coordinates.Latitude;

                magasin.Longitude =
                    coordinates.Longitude;

                coordinatesChanged = true;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Impossible de localiser le magasin " +
                    "{CodeMagasin}.",
                    magasin.CodeMagasin);
            }
        }

        if (coordinatesChanged)
            await _context.SaveChangesAsync();

        return magasins
            .Select(MapToDto)
            .ToList();
    }

    public async Task<MagasinDto?> GetByIdAsync(int id)
    {
        var magasin = await _context.Magasins
            .Include(m => m.Rayons)
            .FirstOrDefaultAsync(
                m => m.MagasinId == id);

        if (magasin is null)
            return null;

        if (NeedsCoordinates(magasin))
        {
            try
            {
                var coordinates =
                    await FindRequiredCoordinatesAsync(
                        magasin.Ville,
                        magasin.Pays);

                magasin.Latitude =
                    coordinates.Latitude;

                magasin.Longitude =
                    coordinates.Longitude;

                await _context.SaveChangesAsync();
            }
            catch (Exception ex)
            {
                _logger.LogWarning(
                    ex,
                    "Impossible de localiser le magasin " +
                    "{CodeMagasin}.",
                    magasin.CodeMagasin);
            }
        }

        return MapToDto(magasin);
    }

    public async Task<MagasinDto> CreateAsync(
        CreateMagasinDto dto)
    {
        var coordinates =
            await FindRequiredCoordinatesAsync(
                dto.Ville,
                dto.Pays);

        var magasin = new Magasin
        {
            CodeMagasin = dto.CodeMagasin
                .Trim()
                .ToUpperInvariant(),

            NomMagasin = dto.NomMagasin.Trim(),

            Ville = dto.Ville.Trim(),

            Pays = dto.Pays.Trim(),

            Latitude = coordinates.Latitude,

            Longitude = coordinates.Longitude,

            Actif = dto.Actif
        };

        _context.Magasins.Add(magasin);
        await _context.SaveChangesAsync();

        return MapToDto(magasin);
    }

    public async Task<MagasinDto?> UpdateAsync(
        int id,
        UpdateMagasinDto dto)
    {
        var magasin = await _context.Magasins
            .Include(m => m.Rayons)
            .FirstOrDefaultAsync(
                m => m.MagasinId == id);

        if (magasin is null)
            return null;

        var locationChanged =
            !string.Equals(
                magasin.Ville.Trim(),
                dto.Ville.Trim(),
                StringComparison.OrdinalIgnoreCase)
            ||
            !string.Equals(
                magasin.Pays.Trim(),
                dto.Pays.Trim(),
                StringComparison.OrdinalIgnoreCase)
            ||
            NeedsCoordinates(magasin);

        if (locationChanged)
        {
            var coordinates =
                await FindRequiredCoordinatesAsync(
                    dto.Ville,
                    dto.Pays);

            magasin.Latitude =
                coordinates.Latitude;

            magasin.Longitude =
                coordinates.Longitude;
        }

        magasin.CodeMagasin = dto.CodeMagasin
            .Trim()
            .ToUpperInvariant();

        magasin.NomMagasin =
            dto.NomMagasin.Trim();

        magasin.Ville = dto.Ville.Trim();

        magasin.Pays = dto.Pays.Trim();

        magasin.Actif = dto.Actif;

        await _context.SaveChangesAsync();

        await RecomputeFullLocationsForMagasinAsync(id);

        return MapToDto(magasin);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var magasin = await _context.Magasins
            .FirstOrDefaultAsync(
                m => m.MagasinId == id);

        if (magasin is null)
            return false;

        await using var transaction =
            await _context.Database
                .BeginTransactionAsync();

        try
        {
            var rayonIds = await _context.Rayons
                .Where(r => r.MagasinId == id)
                .Select(r => r.RayonId)
                .ToListAsync();

            var zoneIds = await _context.Zones
                .Where(z =>
                    rayonIds.Contains(z.RayonId))
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
                    "Impossible de supprimer ce Magasin : une ou " +
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

            if (rayonIds.Count > 0)
            {
                await _context.Rayons
                    .Where(r =>
                        rayonIds.Contains(r.RayonId))
                    .ExecuteDeleteAsync();
            }

            _context.Magasins.Remove(magasin);

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

    private async Task<GeoCoordinates>
        FindRequiredCoordinatesAsync(
            string ville,
            string pays)
    {
        GeoCoordinates? coordinates;

        try
        {
            coordinates =
                await _geocodingService
                    .FindCoordinatesAsync(
                        ville,
                        pays);
        }
        catch (HttpRequestException)
        {
            throw new InvalidOperationException(
                "Le service de localisation est " +
                "temporairement indisponible. " +
                "Réessayez dans quelques instants.");
        }
        catch (TaskCanceledException)
        {
            throw new InvalidOperationException(
                "Le service de localisation a mis " +
                "trop de temps à répondre. Réessayez.");
        }

        if (coordinates is null)
        {
            throw new InvalidOperationException(
                $"La ville « {ville.Trim()} » et le pays " +
                $"« {pays.Trim()} » sont introuvables. " +
                "Vérifiez leur orthographe.");
        }

        return coordinates;
    }

    private static bool NeedsCoordinates(
        Magasin magasin)
    {
        return !magasin.Latitude.HasValue
            || !magasin.Longitude.HasValue
            || magasin.Latitude is < -90 or > 90
            || magasin.Longitude is < -180 or > 180;
    }

    private static MagasinDto MapToDto(
        Magasin magasin)
    {
        return new MagasinDto
        {
            MagasinId = magasin.MagasinId,
            CodeMagasin = magasin.CodeMagasin,
            NomMagasin = magasin.NomMagasin,
            Ville = magasin.Ville,
            Pays = magasin.Pays,
            Latitude = magasin.Latitude,
            Longitude = magasin.Longitude,
            Actif = magasin.Actif,
            RayonsCount =
                magasin.Rayons?.Count ?? 0
        };
    }

    private async Task
        RecomputeFullLocationsForMagasinAsync(
            int magasinId)
    {
        var articles = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .Where(a =>
                a.Cases.Any(c =>
                    c.Zone.Rayon.MagasinId ==
                    magasinId))
            .ToListAsync();

        foreach (var article in articles)
        {
            article.FullLocation =
                BuildFullLocation(article.Cases);
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
            .Where(a => ids.Contains(a.ArticleId))
            .ToListAsync();

        foreach (var article in articles)
        {
            article.FullLocation =
                BuildFullLocation(article.Cases);
        }

        await _context.SaveChangesAsync();
    }

    internal static string? BuildFullLocation(
        IEnumerable<Case> cases)
    {
        var locations = cases
            .Where(c => c.Zone?.Rayon?.Magasin != null)
            .Select(c =>
                $"{c.Zone.Rayon.Magasin.NomMagasin} > " +
                $"{c.Zone.Rayon.CodeRayon} > " +
                $"{c.Zone.CodeZone} > " +
                $"{c.CodeCase}")
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(location => location)
            .ToList();

        return locations.Count == 0
            ? null
            : string.Join(" | ", locations);
    }
}
using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class ArticleService : IArticleService
{
    private readonly StorageDbContext _context;

    public ArticleService(StorageDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<ArticleDto>> GetAllAsync()
    {
        var articles = await ArticleQuery()
            .AsNoTracking()
            .AsSplitQuery()
            .ToListAsync();

        return articles
            .OrderBy(a => a.CodeArticle)
            .Select(MapToDto)
            .ToList();
    }

    public async Task<ArticleDto?> GetByIdAsync(int id)
    {
        var article = await ArticleQuery()
            .AsNoTracking()
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.ArticleId == id);

        return article == null
            ? null
            : MapToDto(article);
    }

    public async Task<ArticleDto> CreateAsync(
        CreateArticleDto dto)
    {
        var code = ValidateAndNormalize(
            dto.CodeArticle,
            dto.NomArticle);

        await EnsureUniqueCodeAsync(code);

        var caseIds = NormalizeCaseIds(dto.CaseIds);
        var cases = await LoadCasesAsync(caseIds);

        EnsureAllCasesWereFound(caseIds, cases);

        var article = new Article
        {
            CodeArticle = code,
            NomArticle = dto.NomArticle.Trim(),
            Actif = dto.Actif,
            Seuil = ValidateThreshold(dto.Seuil),
            FullLocation = BuildFullLocation(cases)
        };

        foreach (var @case in cases)
            article.Cases.Add(@case);

        _context.Articles.Add(article);
        await _context.SaveChangesAsync();

        return (await GetByIdAsync(article.ArticleId))!;
    }

    public async Task<ArticleDto?> UpdateAsync(
        int id,
        UpdateArticleDto dto)
    {
        var article = await ArticleQuery()
            .AsSplitQuery()
            .FirstOrDefaultAsync(a => a.ArticleId == id);

        if (article == null)
            return null;

        var code = ValidateAndNormalize(
            dto.CodeArticle,
            dto.NomArticle);

        await EnsureUniqueCodeAsync(code, id);

        var caseIds = NormalizeCaseIds(dto.CaseIds);
        var selectedCases = await LoadCasesAsync(caseIds);

        EnsureAllCasesWereFound(
            caseIds,
            selectedCases);

        var selectedCaseIds = selectedCases
            .Select(c => c.CaseId)
            .ToHashSet();

        var removedCases = article.Cases
            .Where(c => !selectedCaseIds.Contains(c.CaseId))
            .ToList();

        foreach (var removedCase in removedCases)
        {
            var hasMovements = article.Donnees.Any(d =>
                d.CaseId == removedCase.CaseId);

            if (hasMovements)
            {
                throw new InvalidOperationException(
                    $"Impossible de retirer la Case " +
                    $"{removedCase.CodeCase} de cet Article : " +
                    "elle possède un historique de mouvements. " +
                    "Modifiez ou supprimez d'abord ces mouvements " +
                    "dans Données Mensuelles.");
            }
        }

        foreach (var removedCase in removedCases)
            article.Cases.Remove(removedCase);

        var currentCaseIds = article.Cases
            .Select(c => c.CaseId)
            .ToHashSet();

        foreach (var selectedCase in selectedCases)
        {
            if (!currentCaseIds.Contains(selectedCase.CaseId))
                article.Cases.Add(selectedCase);
        }

        article.CodeArticle = code;
        article.NomArticle = dto.NomArticle.Trim();
        article.Actif = dto.Actif;
        article.Seuil = ValidateThreshold(dto.Seuil);
        article.FullLocation =
            BuildFullLocation(article.Cases);

        await _context.SaveChangesAsync();

        return await GetByIdAsync(id);
    }

    public async Task<bool> DeleteAsync(int id)
    {
        var article = await _context.Articles
            .Include(a => a.Cases)
            .Include(a => a.Donnees)
            .FirstOrDefaultAsync(a => a.ArticleId == id);

        if (article == null)
            return false;

        if (article.Donnees.Any())
        {
            throw new InvalidOperationException(
                "Impossible de supprimer cet Article : il possède " +
                "un historique de mouvements. Supprimez d'abord ses " +
                "mouvements dans Données Mensuelles.");
        }

        article.Cases.Clear();
        _context.Articles.Remove(article);
        await _context.SaveChangesAsync();

        return true;
    }

    public async Task<IEnumerable<ArticleThresholdDto>>
        GetThresholdsAsync()
    {
        return await _context.Articles
            .AsNoTracking()
            .Select(a => new ArticleThresholdDto
            {
                ArticleId = a.ArticleId,
                CodeArticle = a.CodeArticle,
                NomArticle = a.NomArticle,
                Seuil = a.Seuil
            })
            .OrderBy(a => a.CodeArticle)
            .ToListAsync();
    }

    public async Task<bool> UpdateThresholdsAsync(
        int id,
        UpdateArticleThresholdsDto dto)
    {
        var article = await _context.Articles
            .FirstOrDefaultAsync(a => a.ArticleId == id);

        if (article == null)
            return false;

        article.Seuil = ValidateThreshold(dto.Seuil);
        await _context.SaveChangesAsync();

        return true;
    }

    private IQueryable<Article> ArticleQuery()
    {
        return _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .Include(a => a.Donnees);
    }

    private async Task<List<Case>> LoadCasesAsync(
        IEnumerable<int> caseIds)
    {
        var ids = caseIds
            .Where(id => id > 0)
            .Distinct()
            .ToList();

        if (ids.Count == 0)
            return [];

        return await _context.Cases
            .Include(c => c.Zone)
                .ThenInclude(z => z.Rayon)
                    .ThenInclude(r => r.Magasin)
            .Where(c => ids.Contains(c.CaseId))
            .ToListAsync();
    }

    private async Task EnsureUniqueCodeAsync(
        string code,
        int? excludedArticleId = null)
    {
        var duplicate = await _context.Articles.AnyAsync(a =>
            a.CodeArticle == code &&
            (!excludedArticleId.HasValue ||
             a.ArticleId != excludedArticleId.Value));

        if (duplicate)
        {
            throw new InvalidOperationException(
                $"L'Article {code} existe déjà.");
        }
    }

    private static List<int> NormalizeCaseIds(
        IEnumerable<int>? caseIds)
    {
        return (caseIds ?? [])
            .Where(id => id > 0)
            .Distinct()
            .ToList();
    }

    private static void EnsureAllCasesWereFound(
        IReadOnlyCollection<int> requestedIds,
        IReadOnlyCollection<Case> cases)
    {
        var foundIds = cases
            .Select(c => c.CaseId)
            .ToHashSet();

        var missingId = requestedIds.FirstOrDefault(
            id => !foundIds.Contains(id));

        if (missingId > 0)
        {
            throw new InvalidOperationException(
                $"La Case {missingId} est introuvable.");
        }
    }

    private static string ValidateAndNormalize(
        string codeArticle,
        string articleName)
    {
        var code = CsvDataCleaner.NormalizeCode(codeArticle);
        var name = CsvDataCleaner.CleanText(articleName);

        if (!CsvDataCleaner.IsValidArticleCode(code))
        {
            throw new ArgumentException(
                "Format du code invalide : ART- suivi exactement " +
                "de 3 chiffres est requis.");
        }

        if (string.IsNullOrWhiteSpace(name))
        {
            throw new ArgumentException(
                "Le nom de l'Article est obligatoire.");
        }

        return code;
    }

    private static int? ValidateThreshold(int? threshold)
    {
        if (threshold.HasValue &&
            threshold.Value < 0)
        {
            throw new ArgumentException(
                "Le seuil doit être supérieur ou égal à 0.");
        }

        return threshold;
    }

    private static string? BuildFullLocation(
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

    private static ArticleDto MapToDto(
        Article article)
    {
        var linkedCases = article.Cases
            .OrderBy(c => c.Zone.Rayon.Magasin.NomMagasin)
            .ThenBy(c => c.Zone.Rayon.CodeRayon)
            .ThenBy(c => c.Zone.CodeZone)
            .ThenBy(c => c.CodeCase)
            .ToList();

        var totalIn = article.Donnees.Sum(
            d => d.QuantiteEntrer);

        var totalOut = article.Donnees.Sum(
            d => d.QuantiteSortie);

        return new ArticleDto
        {
            ArticleId = article.ArticleId,
            CodeArticle = article.CodeArticle,
            NomArticle = article.NomArticle,
            CaseIds = linkedCases
                .Select(c => c.CaseId)
                .ToList(),
            CodeCase = linkedCases.Count == 0
                ? null
                : string.Join(
                    ", ",
                    linkedCases.Select(c => c.CodeCase)),
            FullLocation =
                BuildFullLocation(linkedCases),
            Actif = article.Actif,
            TotalQuantiteEntrer = totalIn,
            TotalQuantiteSortie = totalOut,
            StockNet = totalIn - totalOut,
            TotalCaseCapacity = linkedCases.Sum(
                c => c.CapaciteMaximum),
            Seuil = article.Seuil
        };
    }
}
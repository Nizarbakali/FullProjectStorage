using System.Globalization;
using CsvHelper;
using CsvHelper.Configuration;
using Microsoft.EntityFrameworkCore;
using StudentApi.Data;
using StudentApi.DTOs;
using StudentApi.Models;
using StudentApi.Models.Entities;

namespace StudentApi.Services;

public class DonneeService : IDonneeService
{
    private static readonly string[] RequiredHeaders =
    [
        "codeArticle",
        "nomArticle",
        "fullLocation",
        "mois",
        "QuantiteEntrer",
        "QuantiteSortie"
    ];

    private readonly StorageDbContext _context;

    public DonneeService(StorageDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<DonneeRowDto>> GetAllAsync()
    {
        var movements = await MovementQuery()
            .AsNoTracking()
            .OrderBy(d => d.Article.CodeArticle)
            .ThenBy(d => d.CaseId)
            .ThenBy(d => d.Mois)
            .ToListAsync();

        var caseTotals = movements
            .Where(d => d.CaseId.HasValue)
            .GroupBy(d => d.CaseId!.Value)
            .ToDictionary(
                group => group.Key,
                group => group.Sum(
                    d => d.QuantiteEntrer - d.QuantiteSortie));

        var articleCaseStocks = movements
            .Where(d => d.CaseId.HasValue)
            .GroupBy(d => (d.ArticleId, CaseId: d.CaseId!.Value))
            .ToDictionary(
                group => group.Key,
                group => group.Sum(
                    d => d.QuantiteEntrer - d.QuantiteSortie));

        return movements.Select(movement =>
        {
            var caseTotal = movement.CaseId.HasValue
                ? caseTotals.GetValueOrDefault(movement.CaseId.Value)
                : 0;

            var articleCaseStock = movement.CaseId.HasValue
                ? articleCaseStocks.GetValueOrDefault(
                    (movement.ArticleId, movement.CaseId.Value))
                : 0;

            return MapToDto(
                movement,
                articleCaseStock,
                caseTotal);
        }).ToList();
    }

    public async Task<DonneeRowDto?> GetByIdAsync(int id)
    {
        var movement = await MovementQuery()
            .AsNoTracking()
            .FirstOrDefaultAsync(d => d.DonneeId == id);

        if (movement == null)
            return null;

        if (!movement.CaseId.HasValue)
            return MapToDto(movement, 0, 0);

        var caseId = movement.CaseId.Value;

        var articleCaseStock = await _context.Donnees
            .Where(d =>
                d.ArticleId == movement.ArticleId &&
                d.CaseId == caseId)
            .SumAsync(d =>
                (int?)(d.QuantiteEntrer - d.QuantiteSortie)) ?? 0;

        var caseTotal = await GetCaseTotalAsync(caseId);

        return MapToDto(
            movement,
            articleCaseStock,
            caseTotal);
    }

    public async Task<DonneeRowDto> CreateAsync(
        CreateDonneeDto dto)
    {
        ValidateQuantities(
            dto.QuantiteEntrer,
            dto.QuantiteSortie);

        var month = ParseMonthOrThrow(dto.Mois);

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            var article = await LoadArticleAsync(dto.ArticleId)
                ?? throw new ArgumentException(
                    $"L'article {dto.ArticleId} est introuvable.");

            var @case = await LoadCaseAsync(dto.CaseId)
                ?? throw new ArgumentException(
                    $"La Case {dto.CaseId} est introuvable.");

            await EnsureUniqueMovementAsync(
                dto.ArticleId,
                dto.CaseId,
                month);

            await EnsureNonNegativeStockAsync(
                dto.ArticleId,
                dto.CaseId,
                excludedMovementId: null,
                new ProposedMovement(
                    month,
                    dto.QuantiteEntrer,
                    dto.QuantiteSortie));

            if (article.Cases.All(c => c.CaseId != @case.CaseId))
                article.Cases.Add(@case);

            var legacyMovement = await _context.Donnees
                .FirstOrDefaultAsync(d =>
                    d.ArticleId == dto.ArticleId &&
                    d.CaseId == null &&
                    d.Mois == month);

            Donnee movement;

            if (legacyMovement != null)
            {
                if (legacyMovement.QuantiteEntrer !=
                        dto.QuantiteEntrer ||
                    legacyMovement.QuantiteSortie !=
                        dto.QuantiteSortie)
                {
                    throw new InvalidOperationException(
                        "Un mouvement Legacy existe déjà pour cet " +
                        $"Article au mois {month:yyyy-MM}. Pour éviter " +
                        "un double comptage, utilisez les mêmes " +
                        "quantités afin de lui attribuer cette Case, " +
                        "ou modifiez directement le mouvement Legacy.");
                }

                movement = legacyMovement;
                movement.CaseId = @case.CaseId;
                movement.Source = "Manuel";
            }
            else
            {
                movement = new Donnee
                {
                    ArticleId = article.ArticleId,
                    CaseId = @case.CaseId,
                    Mois = month,
                    QuantiteEntrer = dto.QuantiteEntrer,
                    QuantiteSortie = dto.QuantiteSortie,
                    Source = "Manuel"
                };

                _context.Donnees.Add(movement);
            }

            await _context.SaveChangesAsync();

            await SynchronizeStateAsync(
                [article.ArticleId],
                [@case.CaseId]);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return (await GetByIdAsync(movement.DonneeId))!;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<DonneeRowDto?> UpdateAsync(
        int id,
        UpdateDonneeDto dto)
    {
        ValidateQuantities(
            dto.QuantiteEntrer,
            dto.QuantiteSortie);

        var month = ParseMonthOrThrow(dto.Mois);

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            var movement = await _context.Donnees
                .FirstOrDefaultAsync(d => d.DonneeId == id);

            if (movement == null)
            {
                await transaction.RollbackAsync();
                return null;
            }

            var oldArticleId = movement.ArticleId;
            var oldCaseId = movement.CaseId;

            var article = await LoadArticleAsync(dto.ArticleId)
                ?? throw new ArgumentException(
                    $"L'article {dto.ArticleId} est introuvable.");

            var @case = await LoadCaseAsync(dto.CaseId)
                ?? throw new ArgumentException(
                    $"La Case {dto.CaseId} est introuvable.");

            await EnsureUniqueMovementAsync(
                dto.ArticleId,
                dto.CaseId,
                month,
                excludedMovementId: id);

            var pairChanged =
                oldArticleId != dto.ArticleId ||
                oldCaseId != dto.CaseId;

            if (pairChanged && oldCaseId.HasValue)
            {
                await EnsureNonNegativeStockAsync(
                    oldArticleId,
                    oldCaseId.Value,
                    excludedMovementId: id,
                    proposed: null);
            }

            await EnsureNonNegativeStockAsync(
                dto.ArticleId,
                dto.CaseId,
                excludedMovementId: id,
                new ProposedMovement(
                    month,
                    dto.QuantiteEntrer,
                    dto.QuantiteSortie));

            if (article.Cases.All(c => c.CaseId != @case.CaseId))
                article.Cases.Add(@case);

            movement.ArticleId = dto.ArticleId;
            movement.CaseId = dto.CaseId;
            movement.Mois = month;
            movement.QuantiteEntrer = dto.QuantiteEntrer;
            movement.QuantiteSortie = dto.QuantiteSortie;
            movement.Source = "Manuel";

            await _context.SaveChangesAsync();

            if (pairChanged && oldCaseId.HasValue)
            {
                await RemoveUnusedArticleCaseLinkAsync(
                    oldArticleId,
                    oldCaseId.Value);
            }

            var articleIds = new HashSet<int>
            {
                oldArticleId,
                dto.ArticleId
            };

            var caseIds = new HashSet<int>
            {
                dto.CaseId
            };

            if (oldCaseId.HasValue)
                caseIds.Add(oldCaseId.Value);

            await SynchronizeStateAsync(
                articleIds,
                caseIds);

            await _context.SaveChangesAsync();
            await transaction.CommitAsync();

            return await GetByIdAsync(id);
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<bool> DeleteAsync(int id)
    {
        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            var movement = await _context.Donnees
                .FirstOrDefaultAsync(d => d.DonneeId == id);

            if (movement == null)
            {
                await transaction.RollbackAsync();
                return false;
            }

            var articleId = movement.ArticleId;
            var caseId = movement.CaseId;

            if (caseId.HasValue)
            {
                await EnsureNonNegativeStockAsync(
                    articleId,
                    caseId.Value,
                    excludedMovementId: id,
                    proposed: null);
            }

            _context.Donnees.Remove(movement);
            await _context.SaveChangesAsync();

            if (caseId.HasValue)
            {
                await RemoveUnusedArticleCaseLinkAsync(
                    articleId,
                    caseId.Value);

                await SynchronizeStateAsync(
                    [articleId],
                    [caseId.Value]);

                await _context.SaveChangesAsync();
            }

            await transaction.CommitAsync();
            return true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }
    }

    public async Task<CsvScanResultDto> ScanCsvAsync(
        IFormFile file)
    {
        var report = new CsvScanResultDto();

        var articles = await _context.Articles
            .AsNoTracking()
            .ToListAsync();

        var articleCodes = articles
            .Select(a => CsvDataCleaner.NormalizeCode(a.CodeArticle))
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        var cases = await CaseQuery()
            .AsNoTracking()
            .ToListAsync();

        var caseLookup = BuildCaseLookup(cases);

        using var reader =
            new StreamReader(file.OpenReadStream());

        using var csv = CreateReader(reader);

        if (!await csv.ReadAsync())
        {
            report.Errors.Add("Le fichier est vide.");
            return report;
        }

        csv.ReadHeader();

        if (!HasExpectedHeaders(csv.HeaderRecord))
        {
            report.Errors.Add(
                "En-têtes invalides. Colonnes attendues : " +
                string.Join(',', RequiredHeaders) + ".");

            return report;
        }

        csv.Context.RegisterClassMap<CsvRowMap>();

        var unknownCodes =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var unknownLocations =
            new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        while (await csv.ReadAsync())
        {
            var line = csv.Parser.Row;
            report.TotalRows++;

            if (csv.Parser.Count != RequiredHeaders.Length)
            {
                report.Errors.Add(
                    $"Ligne {line} : {csv.Parser.Count} colonnes " +
                    $"trouvées, {RequiredHeaders.Length} attendues.");

                continue;
            }

            CsvRow source;

            try
            {
                source = csv.GetRecord<CsvRow>();
            }
            catch
            {
                report.Errors.Add(
                    $"Ligne {line} : ligne CSV illisible.");
                continue;
            }

            var code =
                CsvDataCleaner.NormalizeCode(source.CodeArticle);

            if (!articleCodes.Contains(code))
                unknownCodes.Add(code);

            var cleanLocation =
                NormalizeLocation(source.FullLocation);

            if (!caseLookup.TryGetValue(
                    cleanLocation,
                    out var matchingCases) ||
                matchingCases.Count != 1)
            {
                unknownLocations.Add(
                    CsvDataCleaner.CleanText(
                        source.FullLocation));
            }
        }

        report.UnknownCodeArticles =
            unknownCodes.OrderBy(code => code).ToList();

        report.UnknownFullLocations =
            unknownLocations
                .OrderBy(location => location)
                .ToList();

        return report;
    }

    public async Task<CsvUploadResultDto> UploadCsvAsync(
        IFormFile file)
    {
        var report = new CsvUploadResultDto();
        var rawRows = new List<RawCsvRow>();

        using (var reader =
               new StreamReader(file.OpenReadStream()))
        using (var csv = CreateReader(reader))
        {
            if (!await csv.ReadAsync())
            {
                AddInvalid(
                    report,
                    1,
                    null,
                    "fichier",
                    null,
                    string.Empty,
                    "Le fichier est vide.");

                return report;
            }

            csv.ReadHeader();

            if (!HasExpectedHeaders(csv.HeaderRecord))
            {
                AddInvalid(
                    report,
                    1,
                    null,
                    "en-têtes",
                    null,
                    string.Join(',', csv.HeaderRecord ?? []),
                    "En-têtes invalides. Colonnes attendues : " +
                    string.Join(',', RequiredHeaders) + ".");

                return report;
            }

            csv.Context.RegisterClassMap<CsvRowMap>();

            while (await csv.ReadAsync())
            {
                var line = csv.Parser.Row;
                var rawLine = csv.Parser.RawRecord
                    .TrimEnd('\r', '\n');

                report.TotalLignesLues++;

                if (csv.Parser.Count != RequiredHeaders.Length)
                {
                    AddInvalid(
                        report,
                        line,
                        null,
                        "structure",
                        csv.Parser.Count.ToString(
                            CultureInfo.InvariantCulture),
                        rawLine,
                        "Nombre de colonnes incorrect : " +
                        $"{csv.Parser.Count} colonnes trouvées, " +
                        $"{RequiredHeaders.Length} attendues.");

                    continue;
                }

                try
                {
                    rawRows.Add(new RawCsvRow(
                        line,
                        rawLine,
                        csv.GetRecord<CsvRow>()));
                }
                catch
                {
                    AddInvalid(
                        report,
                        line,
                        null,
                        "structure",
                        null,
                        rawLine,
                        "Ligne CSV illisible.");
                }
            }
        }

        var articles = await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .ToListAsync();

        var articleLookup = articles.ToDictionary(
            article =>
                CsvDataCleaner.NormalizeCode(
                    article.CodeArticle),
            article => article,
            StringComparer.OrdinalIgnoreCase);

        var cases = await CaseQuery().ToListAsync();
        var caseLookup = BuildCaseLookup(cases);

        var candidates =
            new Dictionary<ImportKey, ImportCandidate>();

        var conflictingKeys =
            new HashSet<ImportKey>();

        foreach (var rawRow in rawRows)
        {
            var source = rawRow.Source;
            var code =
                CsvDataCleaner.NormalizeCode(
                    source.CodeArticle);

            if (!CsvDataCleaner.IsValidArticleCode(code))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "codeArticle",
                    source.CodeArticle,
                    rawRow.RawLine,
                    "Format invalide : ART- suivi exactement " +
                    "de 3 chiffres est requis.");

                continue;
            }

            if (!articleLookup.TryGetValue(
                    code,
                    out var article))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "codeArticle",
                    source.CodeArticle,
                    rawRow.RawLine,
                    "Article inexistant. L'import CSV ne crée " +
                    "et ne supprime aucun Article.");

                continue;
            }

            var name =
                CsvDataCleaner.CleanText(
                    source.NomArticle);

            if (!string.Equals(
                    name,
                    CsvDataCleaner.CleanText(
                        article.NomArticle),
                    StringComparison.OrdinalIgnoreCase))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "nomArticle",
                    source.NomArticle,
                    rawRow.RawLine,
                    $"Nom incorrect pour {code}. Nom attendu : " +
                    $"{article.NomArticle}.");

                continue;
            }

            var location =
                NormalizeLocation(source.FullLocation);

            if (string.IsNullOrWhiteSpace(location) ||
                !caseLookup.TryGetValue(
                    location,
                    out var matchingCases))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "fullLocation",
                    source.FullLocation,
                    rawRow.RawLine,
                    "Emplacement inconnu. Utilisez un emplacement " +
                    "existant au format Magasin > Rayon > Zone > Case.");

                continue;
            }

            if (matchingCases.Count != 1)
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "fullLocation",
                    source.FullLocation,
                    rawRow.RawLine,
                    "Emplacement ambigu : plusieurs Cases " +
                    "correspondent à ce chemin.");

                continue;
            }

            var @case = matchingCases[0];

            if (!CsvDataCleaner.TryParseMonth(
                    source.Mois,
                    out var month))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "mois",
                    source.Mois,
                    rawRow.RawLine,
                    "Format invalide : YYYY-MM, MM/YYYY, YYYY/M " +
                    "ou Jan-YYYY attendu.");

                continue;
            }

            if (!CsvDataCleaner.TryParseNonNegativeInt(
                    source.QuantiteEntrer,
                    out var quantityIn))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "QuantiteEntrer",
                    source.QuantiteEntrer,
                    rawRow.RawLine,
                    "Entier supérieur ou égal à 0 requis.");

                continue;
            }

            if (!CsvDataCleaner.TryParseNonNegativeInt(
                    source.QuantiteSortie,
                    out var quantityOut))
            {
                AddInvalid(
                    report,
                    rawRow.Line,
                    code,
                    "QuantiteSortie",
                    source.QuantiteSortie,
                    rawRow.RawLine,
                    "Entier supérieur ou égal à 0 requis.");

                continue;
            }

            report.LignesValidesAvantDoublons++;

            var key = new ImportKey(
                article.ArticleId,
                @case.CaseId,
                month);

            var candidate = new ImportCandidate(
                key,
                rawRow.Line,
                rawRow.RawLine,
                code,
                article,
                @case,
                quantityIn,
                quantityOut);

            if (conflictingKeys.Contains(key))
            {
                report.LignesEnConflit++;

                AddError(
                    report,
                    rawRow.Line,
                    code,
                    "doublon",
                    null,
                    rawRow.RawLine,
                    $"Conflit pour {code}, " +
                    $"{BuildCaseLocation(@case)}, " +
                    $"{month:yyyy-MM}.");

                continue;
            }

            if (!candidates.TryGetValue(
                    key,
                    out var first))
            {
                candidates[key] = candidate;
                continue;
            }

            if (first.QuantityIn == quantityIn &&
                first.QuantityOut == quantityOut)
            {
                report.DoublonsExactsIgnores++;
                continue;
            }

            candidates.Remove(key);
            conflictingKeys.Add(key);
            report.GroupesEnConflit++;
            report.LignesEnConflit += 2;

            var conflictReason =
                $"Conflit pour {code}, " +
                $"{BuildCaseLocation(@case)}, " +
                $"{month:yyyy-MM}.";

            AddError(
                report,
                first.Line,
                code,
                "doublon",
                null,
                first.RawLine,
                conflictReason);

            AddError(
                report,
                rawRow.Line,
                code,
                "doublon",
                null,
                rawRow.RawLine,
                conflictReason);
        }

        var allExistingMovements = await _context.Donnees
            .AsNoTracking()
            .ToListAsync();

        var existingCaseMovements = allExistingMovements
            .Where(d => d.CaseId.HasValue)
            .ToList();

        var legacyMovements = allExistingMovements
            .Where(d => !d.CaseId.HasValue)
            .ToList();

        var existingByKey = existingCaseMovements
            .ToDictionary(
                movement => new ImportKey(
                    movement.ArticleId,
                    movement.CaseId!.Value,
                    movement.Mois));

        var existingConversions = new Dictionary<ImportKey, int>();

        foreach (var pair in candidates.ToList())
        {
            if (!existingByKey.TryGetValue(
                    pair.Key,
                    out var existing))
            {
                continue;
            }

            var candidate = pair.Value;

            if (existing.QuantiteEntrer ==
                    candidate.QuantityIn &&
                existing.QuantiteSortie ==
                    candidate.QuantityOut)
            {
                candidates.Remove(pair.Key);
                report.LignesDejaExistantes++;
                continue;
            }

            existingConversions[pair.Key] = existing.DonneeId;
        }

        RemoveCandidatesThatCreateNegativeStock(
            candidates,
            existingCaseMovements,
            report);

        var legacyConversions =
            ReconcileLegacyMovements(
                candidates,
                legacyMovements,
                report);

        if (candidates.Count == 0)
        {
            report.Succes = true;
            return report;
        }

        var insertedMovements = new List<Donnee>();

        await using var transaction =
            await _context.Database.BeginTransactionAsync();

        try
        {
            foreach (var candidate in candidates.Values)
            {
                if (candidate.Article.Cases.All(
                        c => c.CaseId != candidate.Case.CaseId))
                {
                    candidate.Article.Cases.Add(candidate.Case);
                }

                Donnee movement;

                var conversionId = legacyConversions.GetValueOrDefault(candidate.Key) != 0 
                    ? legacyConversions.GetValueOrDefault(candidate.Key) 
                    : existingConversions.GetValueOrDefault(candidate.Key);

                if (conversionId != 0)
                {
                    movement = await _context.Donnees
                        .FirstAsync(d =>
                            d.DonneeId == conversionId);

                    movement.CaseId =
                        candidate.Case.CaseId;
                    movement.QuantiteEntrer =
                        candidate.QuantityIn;
                    movement.QuantiteSortie =
                        candidate.QuantityOut;
                    movement.Source = "CSV";

                    if (legacyConversions.ContainsKey(candidate.Key))
                    {
                        report.LignesLegacyConverties++;
                    }
                }
                else
                {
                    movement = new Donnee
                    {
                        ArticleId =
                            candidate.Article.ArticleId,
                        CaseId = candidate.Case.CaseId,
                        Mois = candidate.Key.Month,
                        QuantiteEntrer =
                            candidate.QuantityIn,
                        QuantiteSortie =
                            candidate.QuantityOut,
                        Source = "CSV"
                    };

                    _context.Donnees.Add(movement);
                }

                insertedMovements.Add(movement);
            }

            await _context.SaveChangesAsync();

            var affectedArticleIds = candidates.Keys
                .Select(key => key.ArticleId)
                .ToHashSet();

            var affectedCaseIds = candidates.Keys
                .Select(key => key.CaseId)
                .ToHashSet();

            await SynchronizeStateAsync(
                affectedArticleIds,
                affectedCaseIds);

            await _context.SaveChangesAsync();

            var finalCaseTotals =
                await GetCaseTotalsAsync(
                    affectedCaseIds);

            var exceededCaseIds = new HashSet<int>();

            foreach (var caseId in affectedCaseIds)
            {
                var @case = cases.First(
                    c => c.CaseId == caseId);

                var total =
                    finalCaseTotals.GetValueOrDefault(caseId);

                if (total <= @case.CapaciteMaximum)
                    continue;

                exceededCaseIds.Add(caseId);

                report.Warnings.Add(
                    BuildCapacityWarning(@case, total));
            }

            report.LignesCapaciteDepassee =
                candidates.Values.Count(candidate =>
                    exceededCaseIds.Contains(
                        candidate.Case.CaseId));

            await transaction.CommitAsync();

            report.LignesReellementInserees =
                candidates.Count -
                report.LignesLegacyConverties -
                existingConversions.Count;

            report.Succes = true;
        }
        catch
        {
            await transaction.RollbackAsync();
            throw;
        }

        foreach (var movement in insertedMovements.Take(20))
        {
            var preview =
                await GetByIdAsync(movement.DonneeId);

            if (preview != null)
                report.ApercuInserts.Add(preview);
        }

        return report;
    }

    private IQueryable<Donnee> MovementQuery()
    {
        return _context.Donnees
            .Include(d => d.Article)
            .Include(d => d.Case)
                .ThenInclude(c => c!.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin);
    }

    private IQueryable<Case> CaseQuery()
    {
        return _context.Cases
            .Include(c => c.Zone)
                .ThenInclude(z => z.Rayon)
                    .ThenInclude(r => r.Magasin);
    }

    private async Task<Article?> LoadArticleAsync(
        int articleId)
    {
        return await _context.Articles
            .Include(a => a.Cases)
                .ThenInclude(c => c.Zone)
                    .ThenInclude(z => z.Rayon)
                        .ThenInclude(r => r.Magasin)
            .FirstOrDefaultAsync(
                a => a.ArticleId == articleId);
    }

    private async Task<Case?> LoadCaseAsync(
        int caseId)
    {
        return await CaseQuery()
            .FirstOrDefaultAsync(c => c.CaseId == caseId);
    }

    private async Task EnsureUniqueMovementAsync(
        int articleId,
        int caseId,
        DateOnly month,
        int? excludedMovementId = null)
    {
        var exists = await _context.Donnees.AnyAsync(d =>
            d.ArticleId == articleId &&
            d.CaseId == caseId &&
            d.Mois == month &&
            (!excludedMovementId.HasValue ||
             d.DonneeId != excludedMovementId.Value));

        if (exists)
        {
            throw new InvalidOperationException(
                "Un mouvement existe déjà pour cet Article, " +
                $"cette Case et le mois {month:yyyy-MM}.");
        }
    }

    private async Task EnsureNonNegativeStockAsync(
        int articleId,
        int caseId,
        int? excludedMovementId,
        ProposedMovement? proposed)
    {
        var existing = await _context.Donnees
            .AsNoTracking()
            .Where(d =>
                d.ArticleId == articleId &&
                d.CaseId == caseId &&
                (!excludedMovementId.HasValue ||
                 d.DonneeId != excludedMovementId.Value))
            .Select(d => new
            {
                d.Mois,
                d.QuantiteEntrer,
                d.QuantiteSortie
            })
            .ToListAsync();

        var timeline = existing
            .Select(d => new ProposedMovement(
                d.Mois,
                d.QuantiteEntrer,
                d.QuantiteSortie))
            .ToList();

        if (proposed != null)
            timeline.Add(proposed);

        var runningStock = 0;

        foreach (var movement in timeline.OrderBy(m => m.Month))
        {
            runningStock +=
                movement.QuantityIn -
                movement.QuantityOut;

            if (runningStock < 0)
            {
                throw new InvalidOperationException(
                    "Mouvement refusé : le stock de l'Article " +
                    $"dans cette Case deviendrait négatif au mois " +
                    $"{movement.Month:yyyy-MM}.");
            }
        }
    }

    private async Task RemoveUnusedArticleCaseLinkAsync(
        int articleId,
        int caseId)
    {
        var stillUsed = await _context.Donnees.AnyAsync(d =>
            d.ArticleId == articleId &&
            d.CaseId == caseId);

        if (stillUsed)
            return;

        var article = await LoadArticleAsync(articleId);
        var linkedCase = article?.Cases
            .FirstOrDefault(c => c.CaseId == caseId);

        if (linkedCase != null)
            article!.Cases.Remove(linkedCase);
    }

    private async Task SynchronizeStateAsync(
        IEnumerable<int> articleIds,
        IEnumerable<int> caseIds)
    {
        foreach (var caseId in caseIds.Distinct())
        {
            var @case =
                await _context.Cases.FindAsync(caseId);

            if (@case == null)
                continue;

            var total =
                await GetCaseTotalAsync(caseId);

            @case.Statut = CaseService.ComputeStatut(
                total,
                @case.CapaciteMaximum);
        }

        foreach (var articleId in articleIds.Distinct())
        {
            var article =
                await LoadArticleAsync(articleId);

            if (article == null)
                continue;

            article.FullLocation =
                BuildArticleFullLocation(
                    article.Cases);
        }
    }

    private async Task<int> GetCaseTotalAsync(
        int caseId)
    {
        return await _context.Donnees
            .Where(d => d.CaseId == caseId)
            .SumAsync(d =>
                (int?)(d.QuantiteEntrer -
                       d.QuantiteSortie)) ?? 0;
    }

    private async Task<Dictionary<int, int>>
        GetCaseTotalsAsync(IEnumerable<int> caseIds)
    {
        var ids = caseIds.Distinct().ToList();

        return await _context.Donnees
            .Where(d =>
                d.CaseId.HasValue &&
                ids.Contains(d.CaseId.Value))
            .GroupBy(d => d.CaseId!.Value)
            .Select(group => new
            {
                CaseId = group.Key,
                Total = group.Sum(d =>
                    d.QuantiteEntrer -
                    d.QuantiteSortie)
            })
            .ToDictionaryAsync(
                item => item.CaseId,
                item => item.Total);
    }

    private static Dictionary<ImportKey, int>
        ReconcileLegacyMovements(
            Dictionary<ImportKey, ImportCandidate> candidates,
            IReadOnlyCollection<Donnee> legacyMovements,
            CsvUploadResultDto report)
    {
        var legacyByArticleMonth = legacyMovements
            .ToDictionary(
                movement => (
                    movement.ArticleId,
                    movement.Mois));

        var conversionKeys =
            new Dictionary<ImportKey, int>();

        var candidateGroups = candidates.Values
            .GroupBy(candidate => (
                candidate.Key.ArticleId,
                candidate.Key.Month))
            .Select(group => group
                .OrderBy(candidate => candidate.Line)
                .ToList())
            .ToList();

        foreach (var group in candidateGroups)
        {
            var first = group[0];
            var articleMonth = (
                first.Key.ArticleId,
                first.Key.Month);

            if (!legacyByArticleMonth.TryGetValue(
                    articleMonth,
                    out var legacy))
            {
                continue;
            }

            conversionKeys[first.Key] =
                legacy.DonneeId;
        }

        return conversionKeys;
    }

    private static void RemoveCandidatesThatCreateNegativeStock(
        Dictionary<ImportKey, ImportCandidate> candidates,
        IReadOnlyCollection<Donnee> existingMovements,
        CsvUploadResultDto report)
    {
        var candidateGroups = candidates.Values
            .GroupBy(candidate => (
                candidate.Key.ArticleId,
                candidate.Key.CaseId));

        var invalidKeys = new HashSet<ImportKey>();

        foreach (var group in candidateGroups)
        {
            var timeline = existingMovements
                .Where(movement =>
                    movement.ArticleId ==
                        group.Key.ArticleId &&
                    movement.CaseId ==
                        group.Key.CaseId &&
                    !group.Any(c => c.Key.Month == movement.Mois))
                .Select(movement => new StockEvent(
                    movement.Mois,
                    movement.QuantiteEntrer,
                    movement.QuantiteSortie,
                    null))
                .Concat(group.Select(candidate =>
                    new StockEvent(
                        candidate.Key.Month,
                        candidate.QuantityIn,
                        candidate.QuantityOut,
                        candidate)))
                .OrderBy(item => item.Month)
                .ThenBy(item =>
                    item.Candidate == null ? 0 : 1)
                .ToList();

            var runningStock = 0;

            foreach (var item in timeline)
            {
                var nextStock =
                    runningStock +
                    item.QuantityIn -
                    item.QuantityOut;

                if (item.Candidate != null &&
                    nextStock < 0)
                {
                    invalidKeys.Add(
                        item.Candidate.Key);

                    AddInvalid(
                        report,
                        item.Candidate.Line,
                        item.Candidate.CodeArticle,
                        "QuantiteSortie",
                        item.Candidate.QuantityOut.ToString(
                            CultureInfo.InvariantCulture),
                        item.Candidate.RawLine,
                        "Mouvement refusé : le stock de cet Article " +
                        "dans cette Case deviendrait négatif au mois " +
                        $"{item.Month:yyyy-MM}.");

                    continue;
                }

                runningStock = nextStock;
            }
        }

        foreach (var key in invalidKeys)
            candidates.Remove(key);
    }

    private static Dictionary<string, List<Case>>
        BuildCaseLookup(IEnumerable<Case> cases)
    {
        return cases
            .GroupBy(
                @case => NormalizeLocation(
                    BuildCaseLocation(@case)),
                StringComparer.OrdinalIgnoreCase)
            .ToDictionary(
                group => group.Key,
                group => group.ToList(),
                StringComparer.OrdinalIgnoreCase);
    }

    private static string BuildCaseLocation(
        Case @case)
    {
        if (@case.Zone?.Rayon?.Magasin == null)
            return string.Empty;

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
            .Select(BuildCaseLocation)
            .Where(location =>
                !string.IsNullOrWhiteSpace(location))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(location => location)
            .ToList();

        return locations.Count == 0
            ? null
            : string.Join(" | ", locations);
    }

    private static string NormalizeLocation(
        string? location)
    {
        var parts = (location ?? string.Empty)
            .Split(
                '>',
                StringSplitOptions.TrimEntries |
                StringSplitOptions.RemoveEmptyEntries)
            .Select(CsvDataCleaner.CleanText);

        return string.Join(" > ", parts)
            .ToUpperInvariant();
    }

    private static string BuildCapacityWarning(
        Case @case,
        int total)
    {
        var overflow =
            total - @case.CapaciteMaximum;

        return
            $"Capacité dépassée dans " +
            $"{BuildCaseLocation(@case)} : " +
            $"{total}/{@case.CapaciteMaximum} " +
            $"(+{overflow}). Le mouvement a été accepté. " +
            "Sélectionnez explicitement une autre Case pour les " +
            "prochains mouvements; aucun déplacement automatique " +
            "n'a été effectué.";
    }

    private static DonneeRowDto MapToDto(
        Donnee movement,
        int articleCaseStock,
        int caseTotal)
    {
        var maximum =
            movement.Case?.CapaciteMaximum ?? 0;

        var exceeded =
            movement.CaseId.HasValue &&
            caseTotal > maximum;

        return new DonneeRowDto
        {
            DonneeId = movement.DonneeId,
            ArticleId = movement.ArticleId,
            CaseId = movement.CaseId,
            CodeArticle =
                movement.Article.CodeArticle,
            NomArticle =
                movement.Article.NomArticle,
            FullLocation = movement.Case == null
                ? string.Empty
                : BuildCaseLocation(movement.Case),
            Mois = movement.Mois,
            QuantiteEntrer =
                movement.QuantiteEntrer,
            QuantiteSortie =
                movement.QuantiteSortie,
            Source = string.IsNullOrWhiteSpace(
                movement.Source)
                    ? "Legacy"
                    : movement.Source,
            StockArticleCase =
                articleCaseStock,
            QuantiteTotaleCase =
                caseTotal,
            CapaciteMaximumCase =
                maximum,
            CapaciteRestanteCase =
                movement.CaseId.HasValue
                    ? Math.Max(0, maximum - caseTotal)
                    : 0,
            CapaciteDepassee =
                exceeded,
            QuantiteDepassee =
                exceeded
                    ? caseTotal - maximum
                    : 0,
            Warning = exceeded
                ? BuildCapacityWarning(
                    movement.Case!,
                    caseTotal)
                : null
        };
    }

    private static void ValidateQuantities(
        int quantityIn,
        int quantityOut)
    {
        if (quantityIn < 0)
        {
            throw new ArgumentException(
                "QuantiteEntrer doit être supérieure " +
                "ou égale à 0.");
        }

        if (quantityOut < 0)
        {
            throw new ArgumentException(
                "QuantiteSortie doit être supérieure " +
                "ou égale à 0.");
        }
    }

    private static DateOnly ParseMonthOrThrow(
        string month)
    {
        if (CsvDataCleaner.TryParseMonth(
                month,
                out var parsed))
        {
            return parsed;
        }

        throw new ArgumentException(
            "Format du mois invalide. Utilisez YYYY-MM.");
    }

    private static CsvReader CreateReader(
        TextReader reader)
    {
        return new CsvReader(
            reader,
            new CsvConfiguration(
                CultureInfo.InvariantCulture)
            {
                HasHeaderRecord = true,
                TrimOptions = TrimOptions.Trim,
                IgnoreBlankLines = true,
                HeaderValidated = null,
                MissingFieldFound = null,
                BadDataFound = null
            });
    }

    private static bool HasExpectedHeaders(
        string[]? headers)
    {
        return headers?.Length ==
                   RequiredHeaders.Length &&
               RequiredHeaders.All(required =>
                   headers.Contains(
                       required,
                       StringComparer.OrdinalIgnoreCase));
    }

    private static void AddInvalid(
        CsvUploadResultDto report,
        int line,
        string? code,
        string? field,
        string? value,
        string raw,
        string reason)
    {
        report.LignesInvalides++;

        AddError(
            report,
            line,
            code,
            field,
            value,
            raw,
            reason);
    }

    private static void AddError(
        CsvUploadResultDto report,
        int line,
        string? code,
        string? field,
        string? value,
        string raw,
        string reason)
    {
        report.Erreurs.Add(new CsvImportErrorDto
        {
            NumeroLigne = line,
            CodeArticle = code,
            Champ = field,
            Valeur = value,
            ValeurOriginale = raw,
            Raison = reason
        });
    }

    private sealed record RawCsvRow(
        int Line,
        string RawLine,
        CsvRow Source);

    private readonly record struct ImportKey(
        int ArticleId,
        int CaseId,
        DateOnly Month);

    private sealed record ImportCandidate(
        ImportKey Key,
        int Line,
        string RawLine,
        string CodeArticle,
        Article Article,
        Case Case,
        int QuantityIn,
        int QuantityOut);

    private sealed record ProposedMovement(
        DateOnly Month,
        int QuantityIn,
        int QuantityOut);

    private sealed record StockEvent(
        DateOnly Month,
        int QuantityIn,
        int QuantityOut,
        ImportCandidate? Candidate);
}

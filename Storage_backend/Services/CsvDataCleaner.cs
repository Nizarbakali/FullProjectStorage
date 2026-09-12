using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace StudentApi.Services;

/// <summary>
/// Primitives de nettoyage appliquées aux fichiers importés.
///
/// Principe : corriger plutôt que rejeter. Chaque correction potentiellement
/// discutable renvoie une note (`note`) que l'appelant journalise, afin que
/// rien ne soit modifié en silence — l'aperçu avant import les affiche toutes.
/// </summary>
public static partial class CsvDataCleaner
{
    public static string CleanText(string? value) => string.Join(' ', (value ?? string.Empty).Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static string NormalizeCode(string? value) => CleanText(value).ToUpperInvariant();

    public static bool IsValidArticleCode(string code) => ArticleCodePattern().IsMatch(code);

    public static bool TryParsePositiveInt(string? value, out int result) => TryParseInteger(value, 1, out result);

    public static bool TryParseNonNegativeInt(string? value, out int result) => TryParseInteger(value, 0, out result);

    // ── Encodage ────────────────────────────────────────────────────────
    // Un CSV enregistré par Excel en Europe occidentale est en Windows-1252,
    // pas en UTF-8. Lu en UTF-8 il donne soit des octets invalides, soit du
    // mojibake (« CylindreÂ moteur »). On détecte les deux cas.

    /// <summary>
    /// Lit le flux en déterminant son encodage : BOM s'il y en a un, sinon
    /// UTF-8 strict, sinon Latin-1. Répare ensuite le mojibake éventuel.
    /// </summary>
    public static string ReadAllText(Stream stream, out string? note)
    {
        note = null;

        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        var bytes = buffer.ToArray();

        if (HasBom(bytes))
        {
            // Un BOM est une déclaration explicite : on la respecte.
            return RepairMojibake(new UTF8Encoding(true).GetString(bytes, 3, bytes.Length - 3), out note);
        }

        try
        {
            var strict = new UTF8Encoding(false, throwOnInvalidBytes: true);
            var text = strict.GetString(bytes);
            return RepairMojibake(text, out note);
        }
        catch (DecoderFallbackException)
        {
            note = "Fichier non UTF-8 : relu en Windows-1252 (Latin-1).";
            return Encoding.Latin1.GetString(bytes);
        }
    }

    private static bool HasBom(byte[] b) =>
        b.Length >= 3 && b[0] == 0xEF && b[1] == 0xBB && b[2] == 0xBF;

    /// <summary>
    /// Répare le double encodage : du texte Latin-1 interprété comme de l'UTF-8.
    /// On ne l'applique que si la réparation supprime réellement des séquences
    /// suspectes, pour ne jamais abîmer un fichier déjà correct.
    /// </summary>
    public static string RepairMojibake(string text, out string? note)
    {
        note = null;
        var before = CountMojibake(text);
        if (before == 0) return text;

        string repaired;
        try
        {
            repaired = Encoding.UTF8.GetString(Encoding.Latin1.GetBytes(text));
        }
        catch
        {
            return text;
        }

        if (CountMojibake(repaired) >= before) return text;

        note = $"Accents corrigés : {before} séquence(s) mal encodée(s) réparée(s).";
        return repaired;
    }

    private static int CountMojibake(string text) => MojibakePattern().Matches(text).Count;

    // ── Séparateur ──────────────────────────────────────────────────────

    /// <summary>
    /// Détecte le séparateur d'un CSV. Un Excel français enregistre en « ; »,
    /// ce qui donnerait une seule colonne et un rejet incompréhensible.
    /// On retient le séparateur qui découpe l'en-tête en <paramref name="expectedFields"/> champs ;
    /// à défaut, le plus fréquent sur cette ligne.
    /// </summary>
    public static char DetectDelimiter(string headerLine, int expectedFields, out string? note)
    {
        note = null;
        var candidates = new[] { ',', ';', '\t', '|' };

        foreach (var candidate in candidates)
        {
            if (SplitCount(headerLine, candidate) == expectedFields)
            {
                if (candidate != ',')
                    note = $"Séparateur détecté : « {Describe(candidate)} » au lieu de la virgule.";
                return candidate;
            }
        }

        var best = candidates
            .Select(c => (Char: c, Count: SplitCount(headerLine, c)))
            .OrderByDescending(x => x.Count)
            .First();

        if (best.Count > 1 && best.Char != ',')
            note = $"Séparateur détecté : « {Describe(best.Char)} » au lieu de la virgule.";

        return best.Count > 1 ? best.Char : ',';
    }

    private static string Describe(char c) => c switch
    {
        '\t' => "tabulation",
        ';' => "point-virgule",
        '|' => "barre verticale",
        _ => c.ToString(),
    };

    // Découpage respectant les guillemets, pour ne pas compter un séparateur
    // qui se trouve à l'intérieur d'un champ cité.
    private static int SplitCount(string line, char delimiter)
    {
        var count = 1;
        var inQuotes = false;
        foreach (var c in line)
        {
            if (c == '"') inQuotes = !inQuotes;
            else if (c == delimiter && !inQuotes) count++;
        }
        return count;
    }

    // ── Code article ────────────────────────────────────────────────────

    /// <summary>
    /// Ramène un code au format canonique ART-000 quand l'intention est
    /// certaine : séparateur absent ou différent, zéros manquants, casse.
    /// « ART 1 », « art_1 », « ART-1 », « ART1 » donnent tous ART-001.
    /// Renvoie le code inchangé si aucune règle sûre ne s'applique.
    /// </summary>
    public static string RepairArticleCode(string? value, out string? note)
    {
        note = null;
        var original = CleanText(value);
        if (original.Length == 0) return original;

        var code = original.ToUpperInvariant();
        if (IsValidArticleCode(code))
            return code;

        // Sépare la partie lettres de la partie chiffres, quels que soient
        // les séparateurs employés entre les deux.
        var match = LooseArticleCodePattern().Match(code);
        if (match.Success)
        {
            var digits = match.Groups["n"].Value.TrimStart('0');
            if (digits.Length == 0) digits = "0";

            if (digits.Length <= 3)
            {
                var repaired = "ART-" + digits.PadLeft(3, '0');
                if (repaired != original)
                    note = $"Code « {original} » interprété comme {repaired}.";
                return repaired;
            }
        }

        // Aucune règle sûre : on renvoie au moins la version normalisée.
        if (code != original)
            note = $"Code « {original} » normalisé en {code}.";
        return code;
    }

    // ── Mois ────────────────────────────────────────────────────────────

    public static bool TryParseMonth(string? value, out DateOnly month)
        => TryParseMonth(value, out month, out _);

    /// <summary>
    /// Accepte les écritures usuelles du mois, y compris les dates complètes
    /// produites par Excel quand la cellule a été convertie en date.
    /// </summary>
    public static bool TryParseMonth(string? value, out DateOnly month, out string? note)
    {
        note = null;
        var raw = CleanText(value);
        var text = raw.Replace('/', '-').Replace('.', '-');

        var monthFormats = new[] { "yyyy-MM", "yyyy-M", "MM-yyyy", "M-yyyy", "MMM-yyyy", "MMMM-yyyy" };
        foreach (var format in monthFormats)
        {
            if (DateOnly.TryParseExact(text, format, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var parsed))
            {
                month = new DateOnly(parsed.Year, parsed.Month, 1);
                return true;
            }
        }

        // Date complète : on ne garde que l'année et le mois.
        var dayFormats = new[]
        {
            "yyyy-MM-dd", "dd-MM-yyyy", "d-M-yyyy", "MM-dd-yyyy",
            "yyyy-MM-ddTHH:mm:ss", "yyyy-MM-dd HH:mm:ss",
        };
        foreach (var format in dayFormats)
        {
            if (DateTime.TryParseExact(text, format, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var parsed))
            {
                month = new DateOnly(parsed.Year, parsed.Month, 1);
                note = $"Date « {raw} » ramenée au mois {month:yyyy-MM}.";
                return true;
            }
        }

        // Dernier recours : les dates textuelles longues (« 1 janvier 2024 »),
        // et surtout la forme que JavaScript produit quand Excel a converti la
        // cellule en vraie date — « Mon Jan 01 2024 00:00:00 GMT+0100 (…) ».
        // On coupe le fuseau, que DateTime.TryParse ne sait pas lire.
        var trimmed = TimezoneTailPattern().Replace(raw, string.Empty).Trim();

        foreach (var candidate in new[] { raw, trimmed })
        {
            if (candidate.Length == 0) continue;

            foreach (var culture in new[] { CultureInfo.InvariantCulture, CultureInfo.GetCultureInfo("fr-FR") })
            {
                if (DateTime.TryParse(candidate, culture, DateTimeStyles.AllowWhiteSpaces, out var loose))
                {
                    month = new DateOnly(loose.Year, loose.Month, 1);
                    note = $"Date « {raw} » ramenée au mois {month:yyyy-MM}.";
                    return true;
                }
            }
        }

        month = default;
        return false;
    }

    // ── Quantités ───────────────────────────────────────────────────────

    /// <summary>
    /// Lit une quantité en tolérant les décimales et les valeurs négatives.
    /// Une décimale est arrondie à l'entier le plus proche, un négatif est
    /// ramené à 0 — les deux avec une note explicite.
    /// </summary>
    public static bool TryParseQuantity(string? value, out int result, out string? note)
    {
        note = null;
        var raw = CleanText(value);

        if (raw.Length == 0)
        {
            result = 0;
            note = "Quantité vide, lue comme 0.";
            return true;
        }

        var text = raw.Replace(" ", string.Empty).Replace(" ", string.Empty);

        // Un seul séparateur décimal, point ou virgule, avec 1 à 2 décimales :
        // « 12,5 » ou « 12.50 ». La virgule de milliers a déjà été traitée
        // par TryParseInteger, il n'y a donc plus d'ambiguïté ici.
        var match = DecimalPattern().Match(text);
        if (match.Success)
        {
            var normalized = match.Groups["sign"].Value
                + match.Groups["i"].Value + "." + match.Groups["d"].Value;
            if (decimal.TryParse(normalized, NumberStyles.Float, CultureInfo.InvariantCulture, out var number))
            {
                var rounded = (int)Math.Round(number, MidpointRounding.AwayFromZero);
                if (rounded < 0)
                {
                    note = $"Quantité négative ({raw}) ramenée à 0.";
                    result = 0;
                    return true;
                }

                note = number == rounded
                    ? $"Quantité « {raw} » lue comme {rounded}."
                    : $"Quantité décimale « {raw} » arrondie à {rounded}.";
                result = rounded;
                return true;
            }
        }

        if (TryParseInteger(raw, int.MinValue, out var whole))
        {
            if (whole < 0)
            {
                note = $"Quantité négative ({whole}) ramenée à 0.";
                result = 0;
                return true;
            }
            result = whole;
            return true;
        }

        result = 0;
        return false;
    }

    private static bool TryParseInteger(string? value, int minimum, out int result)
    {
        var text = CleanText(value).Replace(" ", string.Empty).Replace(" ", string.Empty);
        // La virgule n'est acceptée comme séparateur de milliers que si elle
        // en a la forme exacte : 1,002 -> 1002. Surtout pas AllowThousands,
        // qui lirait « 12,7 » comme 127 — une erreur d'un facteur 10 sur une
        // quantité de stock.
        if (ThousandsPattern().IsMatch(text)) text = text.Replace(",", string.Empty);
        if (int.TryParse(text, NumberStyles.Integer, CultureInfo.InvariantCulture, out result) && result >= minimum) return true;

        result = 0;
        return false;
    }

    [GeneratedRegex("^ART-[0-9]{3}$", RegexOptions.CultureInvariant)]
    private static partial Regex ArticleCodePattern();

    [GeneratedRegex(@"^\s*ART[\s\-_.]*(?<n>[0-9]+)\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex LooseArticleCodePattern();

    [GeneratedRegex("^[0-9]{1,3}(,[0-9]{3})+$", RegexOptions.CultureInvariant)]
    private static partial Regex ThousandsPattern();

    [GeneratedRegex(@"^(?<sign>-?)(?<i>[0-9]+)[.,](?<d>[0-9]{1,2})$", RegexOptions.CultureInvariant)]
    private static partial Regex DecimalPattern();

    // « … 00:00:00 GMT+0100 (GMT+01:00) » : la queue de fuseau que produit
    // JavaScript et que DateTime.TryParse ne sait pas interpréter.
    [GeneratedRegex(@"\s*(GMT|UTC)[+\-]?[0-9:]*\s*(\(.*\))?\s*$", RegexOptions.CultureInvariant)]
    private static partial Regex TimezoneTailPattern();

    // Séquences typiques d'un texte Latin-1 relu en UTF-8.
    [GeneratedRegex("Ã[©¨ ¢´ªàçèé»]|Â[ °«»´]|â€[™œ\"]", RegexOptions.CultureInvariant)]
    private static partial Regex MojibakePattern();
}

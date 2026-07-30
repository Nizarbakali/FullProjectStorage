using System.Globalization;
using System.Text.RegularExpressions;

namespace StudentApi.Services;

public static partial class CsvDataCleaner
{
    public static string CleanText(string? value) => string.Join(' ', (value ?? string.Empty).Trim().Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries));

    public static string NormalizeCode(string? value) => CleanText(value).ToUpperInvariant();

    public static bool IsValidArticleCode(string code) => ArticleCodePattern().IsMatch(code);

    public static bool TryParsePositiveInt(string? value, out int result) => TryParseInteger(value, 1, out result);

    public static bool TryParseNonNegativeInt(string? value, out int result) => TryParseInteger(value, 0, out result);

    public static bool TryParseMonth(string? value, out DateOnly month)
    {
        var text = CleanText(value).Replace('/', '-').Replace('.', '-');
        var formats = new[] { "yyyy-MM", "yyyy-M", "MM-yyyy", "M-yyyy", "MMM-yyyy", "MMMM-yyyy" };
        foreach (var format in formats)
        {
            if (DateOnly.TryParseExact(text, format, CultureInfo.InvariantCulture, DateTimeStyles.AllowWhiteSpaces, out var parsed))
            {
                month = new DateOnly(parsed.Year, parsed.Month, 1);
                return true;
            }
        }

        month = default;
        return false;
    }

    private static bool TryParseInteger(string? value, int minimum, out int result)
    {
        var text = CleanText(value).Replace("\u00A0", string.Empty).Replace(" ", string.Empty);
        // Only accept commas as thousands separators: 1,002 -> 1002. Decimal quantities are not valid.
        if (ThousandsPattern().IsMatch(text)) text = text.Replace(",", string.Empty);
        if (int.TryParse(text, NumberStyles.Integer | NumberStyles.AllowThousands, CultureInfo.InvariantCulture, out result) && result >= minimum) return true;

        result = 0;
        return false;
    }

    [GeneratedRegex("^ART-[0-9]{3}$", RegexOptions.CultureInvariant)]
    private static partial Regex ArticleCodePattern();

    [GeneratedRegex("^[0-9]{1,3}(,[0-9]{3})+$", RegexOptions.CultureInvariant)]
    private static partial Regex ThousandsPattern();
}

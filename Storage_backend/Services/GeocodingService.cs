using System.Globalization;
using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace StudentApi.Services;

public record GeoCoordinates(double Latitude, double Longitude);

public interface IGeocodingService
{
    Task<GeoCoordinates?> FindCoordinatesAsync(
        string ville,
        string pays,
        CancellationToken cancellationToken = default);
}

public sealed class NominatimGeocodingService : IGeocodingService
{
    private static readonly SemaphoreSlim RequestGate = new(1, 1);
    private static DateTimeOffset _lastRequestAt = DateTimeOffset.MinValue;

    private readonly HttpClient _httpClient;

    public NominatimGeocodingService(HttpClient httpClient)
    {
        _httpClient = httpClient;
    }

    public async Task<GeoCoordinates?> FindCoordinatesAsync(
        string ville,
        string pays,
        CancellationToken cancellationToken = default)
    {
        var city = ville.Trim();
        var country = pays.Trim();

        if (string.IsNullOrWhiteSpace(city) || string.IsNullOrWhiteSpace(country))
            return null;

        await RequestGate.WaitAsync(cancellationToken);

        try
        {
            // The public Nominatim service allows at most one request per second.
            var elapsed = DateTimeOffset.UtcNow - _lastRequestAt;
            var remainingDelay = TimeSpan.FromMilliseconds(1100) - elapsed;

            if (remainingDelay > TimeSpan.Zero)
                await Task.Delay(remainingDelay, cancellationToken);

            var url =
                "search" +
                $"?city={Uri.EscapeDataString(city)}" +
                $"&country={Uri.EscapeDataString(country)}" +
                "&format=jsonv2&limit=1";

            var results = await _httpClient.GetFromJsonAsync<List<NominatimResult>>(
                url,
                cancellationToken);

            var first = results?.FirstOrDefault();

            if (first is null ||
                !double.TryParse(
                    first.Latitude,
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out var latitude) ||
                !double.TryParse(
                    first.Longitude,
                    NumberStyles.Float,
                    CultureInfo.InvariantCulture,
                    out var longitude))
            {
                return null;
            }

            return new GeoCoordinates(latitude, longitude);
        }
        finally
        {
            _lastRequestAt = DateTimeOffset.UtcNow;
            RequestGate.Release();
        }
    }

    private sealed class NominatimResult
    {
        [JsonPropertyName("lat")]
        public string Latitude { get; set; } = string.Empty;

        [JsonPropertyName("lon")]
        public string Longitude { get; set; } = string.Empty;
    }
}

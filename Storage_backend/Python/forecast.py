"""Read historical monthly data from stdin and return a 12-month read-only forecast for both QuantiteEntrer and QuantiteSortie."""
import json
import sys
from collections import defaultdict

def forecast_series(rows, series_key):
    by_year = defaultdict(lambda: [None] * 12)
    for row in rows:
        year, month = map(int, row["month"].split("-"))
        by_year[year][month - 1] = max(0, int(row.get(series_key, 0)))

    if not by_year:
        return [0]*12, 0

    years = sorted(by_year)
    latest_year = years[-1]
    
    monthly_baseline = []
    for month in range(12):
        samples = [by_year[y][month] for y in years if by_year[y][month] is not None]
        monthly_baseline.append(sum(samples) / len(samples) if samples else 0)

    annual_totals = [sum(v for v in by_year[y] if v is not None) for y in years]
    if len(annual_totals) > 1:
        indexes = list(range(len(annual_totals)))
        mean_x = sum(indexes) / len(indexes)
        mean_y = sum(annual_totals) / len(annual_totals)
        denominator = sum((x - mean_x) ** 2 for x in indexes)
        slope = sum((x - mean_x) * (y - mean_y) for x, y in zip(indexes, annual_totals)) / denominator if denominator else 0
        target_total = max(0, annual_totals[-1] + slope)
    else:
        target_total = annual_totals[0]

    baseline_total = sum(monthly_baseline)
    scale = target_total / baseline_total if baseline_total else 0
    forecast = [max(0, round(value * scale)) for value in monthly_baseline]
    return forecast, latest_year

def main():
    payload = json.load(sys.stdin)
    rows = payload.get("rows", [])
    
    entrer_forecast, latest_year = forecast_series(rows, "quantiteEntrer")
    sortie_forecast, _ = forecast_series(rows, "quantiteSortie")

    print(json.dumps({
        "articleName": payload.get("articleName", ""),
        "year": latest_year + 1,
        "monthlyQuantiteEntrer": entrer_forecast,
        "monthlyQuantiteSortie": sortie_forecast
    }))

if __name__ == "__main__":
    main()

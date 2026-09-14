# Calcul de la prévision — GMD Metal

Les cinq étapes du calcul, de la moyenne mensuelle historique jusqu'aux douze
valeurs prévisionnelles, telles qu'implémentées dans
`Storage_backend/Python/forecast.py` (fonction `forecast_series()`).

![Formules de calcul de la prévision](./formules-prevision.svg)

*Figure — Enchaînement des formules de calcul de la prévision.*

## Notations

| Symbole | Signification |
|---------|---------------|
| `q(y,m)` | Quantité relevée pour l'année `y` et le mois `m` |
| `B(m)` | Moyenne de référence du mois `m` |
| `n(m)` | Nombre d'années où le mois `m` est renseigné |
| `T(i)` | Total de l'année d'indice `i` |
| `x(i)` | Indice de l'année : 0, 1, …, n − 1 |
| `a` | Pente de tendance (moindres carrés) |
| `k` | Facteur de mise à l'échelle |
| `P(m)` | Valeur prévisionnelle du mois `m` |

## Les cinq étapes

1. **Moyenne mensuelle de référence** — `B(m) = ( Σ_y q(y,m) ) / n(m)`
   Moyenne des quantités du mois `m` sur les années disponibles.
2. **Total de chaque année** — `T(i) = Σ_{m=1..12} q(y_i, m)`
3. **Pente de tendance** — `a = Σ (x_i − x̄)(T_i − T̄) / Σ (x_i − x̄)²`
   Régression linéaire sur les totaux annuels. Si une seule année est
   disponible, aucune pente n'est calculée.
4. **Total annuel prévu** — `T_prévu = max( 0, T_n + a )`
5. **Répartition sur les 12 mois** — `k = T_prévu / Σ B(m)` puis
   `P(m) = arrondi( B(m) × k )`

La série `P(1) … P(12)` correspond à l'année `y_n + 1`.

## Exemple chiffré

| Étape | Calcul | Résultat |
|-------|--------|----------|
| Historique | Totaux annuels 2023 puis 2024 | T₁ = 1 200 · T₂ = 1 400 |
| Moyennes | x̄ = (0 + 1) / 2 · T̄ = (1 200 + 1 400) / 2 | x̄ = 0,5 · T̄ = 1 300 |
| Pente | [ (−0,5)(−100) + (0,5)(100) ] / [ (−0,5)² + (0,5)² ] | a = 200 |
| Total prévu | max( 0 , 1 400 + 200 ) | T_prévu = 1 600 |
| Facteur | 1 600 / 1 300 | k ≈ 1,2308 |
| Un mois | Si B(janvier) = 100 : arrondi( 100 × 1,2308 ) | P(janvier) = 123 |

## À noter

Le calcul est exécuté **deux fois**, indépendamment : une fois sur les quantités
entrées (`quantiteEntrer`) et une fois sur les quantités sorties
(`quantiteSortie`). La réponse renvoyée au frontend contient donc **deux
séries** de douze valeurs.

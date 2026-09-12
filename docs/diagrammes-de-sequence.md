# Diagrammes de séquence — GMD Metal

Modélisation UML des cas d'utilisation clés de l'application de gestion de
stock. Les diagrammes ci-dessous se rendent automatiquement sur GitHub (blocs
Mermaid) et peuvent être exportés en image pour le rapport de stage.

## Combien de diagrammes ?

On ne modélise pas chaque CRUD, mais les **cas d'utilisation les plus
représentatifs** — ceux dont les interactions portent une vraie valeur
technique. **5 diagrammes** sont retenus :

| # | Cas d'utilisation | Priorité | Intérêt technique |
|---|-------------------|----------|-------------------|
| 1 | Authentification | Essentiel | Hachage SHA-256 + génération de jeton JWT |
| 2 | Import CSV (scan + upload) | Essentiel | Nettoyage Python, dry-run, persistance |
| 3 | Prévision de la demande | Essentiel | Interop C# → sous-processus Python |
| 4 | Création d'un article (CRUD) | Complémentaire | Cas type de tous les CRUD hiérarchiques |
| 5 | Carte des magasins | Complémentaire | Appel à un service externe (Nominatim) |

> **Version allégée :** les 3 premiers suffisent pour un rapport concis.
> Les 5 offrent une couverture complète, CRUD et service externe compris.

### Architecture
`React (IHM) → api.js (Axios) → ASP.NET Core (Contrôleur → Service) → EF Core → Base de données`,
avec des sous-processus **Python** (prévision) et un appel **externe** (géocodage).

---

## 1 — Authentification

`POST /api/Auth/login`

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant IHM as IHM React (LoginPage)
    participant API as api.js (Axios)
    participant AC as AuthController
    participant AS as AuthService
    participant DB as Base de données
    U->>IHM: Saisit identifiants + « Se connecter »
    IHM->>API: login(username, password)
    API->>AC: POST /api/Auth/login
    AC->>AS: LoginAsync(request)
    AS->>AS: HashPassword (SHA-256)
    AS->>DB: SELECT AppUser (username + hash)
    alt Identifiants valides
        DB-->>AS: Utilisateur trouvé
        AS->>AS: GenerateToken (JWT)
        AS-->>AC: LoginResponse(token, rôle)
        AC-->>API: 200 OK + token
        API-->>IHM: token + rôle
        IHM->>IHM: localStorage « gmd_auth_token »
        IHM-->>U: Redirection vers le tableau de bord
    else Identifiants incorrects
        DB-->>AS: null
        AS-->>AC: null
        AC-->>API: 401 Unauthorized
        API-->>IHM: Erreur 401
        IHM-->>U: « Identifiants incorrects »
    end
```

---

## 2 — Import CSV (aperçu + import)

`POST /api/MonthlyData/scan` · `POST /api/MonthlyData/upload`

```mermaid
sequenceDiagram
    autonumber
    actor A as Gestionnaire
    participant IHM as IHM React (CsvUploadPage)
    participant API as api.js (Axios)
    participant DC as DonneeController
    participant DS as DonneeService
    participant CL as CsvDataCleaner
    participant DB as Base de données
    Note over A,DB: Étape 1 — Aperçu sans écriture (dry-run)
    A->>IHM: Sélectionne le fichier CSV
    IHM->>API: scanCsv(file)
    API->>DC: POST /api/MonthlyData/scan
    DC->>DS: ScanCsvAsync(file)
    DS->>CL: Normalisation + validation des lignes
    CL-->>DS: Lignes nettoyées + avertissements
    DS-->>DC: CsvScanResult (aperçu, aucune écriture)
    DC-->>IHM: 200 OK — inserts, doublons, erreurs
    IHM-->>A: Affiche l'aperçu à valider
    Note over A,DB: Étape 2 — Import réel
    A->>IHM: Confirme l'import
    IHM->>API: uploadCsv(file)
    API->>DC: POST /api/MonthlyData/upload
    DC->>DS: UploadCsvAsync(file)
    DS->>CL: Nettoyage + validation
    DS->>DB: Insert / Replace des lignes mensuelles
    DB-->>DS: SaveChangesAsync()
    DS-->>DC: CsvUploadResult (n lignes importées)
    DC-->>IHM: 200 OK
    IHM-->>A: « Import terminé »
```

---

## 3 — Prévision de la demande

`POST /api/forecast`

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant IHM as IHM React (ForecastPage)
    participant API as api.js (Axios)
    participant FC as ForecastController
    participant FS as ForecastService
    participant DB as Base de données
    participant PY as Processus Python (forecast.py)
    U->>IHM: Choisit un article + « Prévoir »
    IHM->>API: forecast(articleName)
    API->>FC: POST /api/forecast
    FC->>FS: PredictAsync(request)
    FS->>DB: Historique mensuel de l'article
    DB-->>FS: Lignes (mois, quantités)
    FS->>PY: Lance « py forecast.py » + JSON via stdin
    PY->>PY: Calcul de la prévision
    PY-->>FS: Résultat JSON via stdout
    FS->>FS: Désérialise ForecastDto
    FS-->>FC: ForecastDto (prévisions)
    FC-->>API: 200 OK
    API-->>IHM: Prévisions
    IHM-->>U: Affiche la courbe de prévision
```

---

## 4 — Création d'un article (CRUD type)

`POST /api/Article`

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant IHM as IHM React (ArticlePage)
    participant API as api.js (Axios)
    participant AC as ArticleController
    participant AS as ArticleService
    participant DB as Base de données
    U->>IHM: Remplit le formulaire d'article
    IHM->>API: createArticle(dto)
    Note right of API: En-tête Authorization: Bearer <JWT>
    API->>AC: POST /api/Article
    AC->>AC: Validation du modèle
    AC->>AS: CreateAsync(dto)
    AS->>DB: INSERT Article (rattaché à une Case)
    DB-->>AS: SaveChangesAsync()
    AS-->>AC: ArticleDto créé
    AC-->>API: 201 Created
    API-->>IHM: Article
    IHM-->>U: Ligne ajoutée à la liste
```

---

## 5 — Carte des magasins (géocodage)

`GET /api/Magasin`

```mermaid
sequenceDiagram
    autonumber
    actor U as Utilisateur
    participant IHM as IHM React (MagasinMapPage)
    participant API as api.js (Axios)
    participant MC as MagasinController
    participant GS as GeocodingService
    participant OSM as Nominatim (OpenStreetMap)
    participant DB as Base de données
    U->>IHM: Ouvre la carte des magasins
    IHM->>API: getMagasins()
    API->>MC: GET /api/Magasin
    MC->>DB: SELECT Magasins
    DB-->>MC: Liste des magasins
    loop Pour chaque magasin sans coordonnées
        MC->>GS: Geocode(ville, pays)
        GS->>OSM: GET /search?city=…&country=…
        OSM-->>GS: latitude / longitude
        GS-->>MC: Coordonnées
    end
    MC-->>API: 200 OK — magasins + coordonnées
    API-->>IHM: Données géolocalisées
    IHM-->>U: Affiche les marqueurs sur la carte
```

# Storage_backend

ASP.NET Core (.NET 10) Web API backing the GMD Metal storage app. EF Core +
SQL Server, JWT auth with `admin`/`user` roles, CSV import, and a Python
forecast helper (`Python/forecast.py`).

## First-time setup

The app needs three secrets that are **not** committed to the repo (they used
to be, in plaintext, in `appsettings.json` — since fixed):

- `ConnectionStrings:DefaultConnection` — your SQL Server connection string
- `Jwt:Key` — the HMAC signing key for auth tokens (any long random string)
- `SeedAdmin:Password` — password for the auto-seeded admin account, only used
  the very first time the app runs against an empty database

Set them locally with [user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets)
(stored outside the repo, per machine, never committed):

```bash
cd Storage_backend
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "Server=Nizar\SQLEXPRESS;Database=StorageDb;User ID=sa;Password=YOUR_PASSWORD;Trusted_Connection=True;TrustServerCertificate=True;"
dotnet user-secrets set "Jwt:Key" "some long random string, at least 32 characters"
dotnet user-secrets set "SeedAdmin:Password" "a password for the first admin account"
```

For a deployed environment instead of user-secrets, set the equivalent
environment variables (ASP.NET Core maps `__` to a config section separator):

```bash
ConnectionStrings__DefaultConnection="..."
Jwt__Key="..."
SeedAdmin__Password="..."
```

`SeedAdmin:Username` defaults to `admin` and isn't sensitive; override it in
`appsettings.json` directly if you want a different default username.

**If you've already run this project before this change:** your database
already has an admin account, so `SeedAdmin:Password` won't be used again —
you only need `ConnectionStrings:DefaultConnection` and `Jwt:Key`.

⚠️ The old JWT key, SQL `sa` password, and seed admin password were committed
to git history in this repo before this cleanup. If this repo has ever been
pushed somewhere others can read it, treat those three values as compromised
and change them (a new `Jwt:Key` invalidates existing login tokens; a new SQL
password needs updating on the SQL Server side too).

## Running

```bash
dotnet run
```

Serves on `http://localhost:5130` (see `Properties/launchSettings.json`).
Applies no migrations automatically — run `dotnet ef database update` after
pulling schema changes.

## Database migrations

This repo hand-edits entity classes but never hand-edits `Migrations/*.cs` —
those are generated. After changing an entity or `StorageDbContext`, generate
the migration yourself (only your machine has both the SDK and your current
database's actual state to diff against):

```bash
dotnet ef migrations add <DescriptiveName>
dotnet ef database update
```

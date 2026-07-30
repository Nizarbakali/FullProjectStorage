namespace StudentApi.DTOs;

public class MagasinDto
{
    public int MagasinId { get; set; }
    public string CodeMagasin { get; set; } = string.Empty;
    public string NomMagasin { get; set; } = string.Empty;
    public string Ville { get; set; } = string.Empty;
    public string Pays { get; set; } = string.Empty;
    public double? Latitude { get; set; }
    public double? Longitude { get; set; }
    public bool Actif { get; set; }
    public int RayonsCount { get; set; }
}

public class CreateMagasinDto
{
    public string CodeMagasin { get; set; } = string.Empty;
    public string NomMagasin { get; set; } = string.Empty;
    public string Ville { get; set; } = string.Empty;
    public string Pays { get; set; } = string.Empty;
    public bool Actif { get; set; } = true;
}

public class UpdateMagasinDto
{
    public string CodeMagasin { get; set; } = string.Empty;
    public string NomMagasin { get; set; } = string.Empty;
    public string Ville { get; set; } = string.Empty;
    public string Pays { get; set; } = string.Empty;
    public bool Actif { get; set; }
}

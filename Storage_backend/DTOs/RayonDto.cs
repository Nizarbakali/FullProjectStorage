namespace StudentApi.DTOs;

public class RayonDto
{
    public int     RayonId    { get; set; }
    public int     MagasinId  { get; set; }
    public string  CodeMagasin { get; set; } = string.Empty;
    public string  NomMagasin  { get; set; } = string.Empty;
    public string  CodeRayon  { get; set; } = string.Empty;
    public string? NomRayon   { get; set; }
    public bool    Actif      { get; set; }
    public int     ZonesCount { get; set; }
}

public class CreateRayonDto
{
    public int     MagasinId { get; set; }
    public string  CodeRayon { get; set; } = string.Empty;
    public string? NomRayon  { get; set; }
    public bool    Actif     { get; set; } = true;
}

public class UpdateRayonDto
{
    public int     MagasinId { get; set; }
    public string  CodeRayon { get; set; } = string.Empty;
    public string? NomRayon  { get; set; }
    public bool    Actif     { get; set; }
}

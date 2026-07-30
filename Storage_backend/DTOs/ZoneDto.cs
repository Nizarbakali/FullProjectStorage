namespace StudentApi.DTOs;

public class ZoneDto
{
    public int    ZoneId      { get; set; }
    public int    RayonId     { get; set; }
    public string CodeRayon   { get; set; } = string.Empty;
    public string? NomRayon   { get; set; }
    public string CodeZone    { get; set; } = string.Empty;
    public int?   NumeroLigne { get; set; }
    public bool   Actif       { get; set; }
    public int    CasesCount  { get; set; }
}

public class CreateZoneDto
{
    public int    RayonId     { get; set; }
    public string CodeZone    { get; set; } = string.Empty;
    public int?   NumeroLigne { get; set; }
    public bool   Actif       { get; set; } = true;
}

public class UpdateZoneDto
{
    public int    RayonId     { get; set; }
    public string CodeZone    { get; set; } = string.Empty;
    public int?   NumeroLigne { get; set; }
    public bool   Actif       { get; set; }
}

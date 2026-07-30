namespace StudentApi.DTOs;

public class CaseDto
{
    public int CaseId { get; set; }
    public int ZoneId { get; set; }
    public string CodeZone { get; set; } = string.Empty;
    public string CodeCase { get; set; } = string.Empty;
    public string FullLocation { get; set; } = string.Empty;
    public int? PositionCase { get; set; }
    public int CapaciteMaximum { get; set; }
    public int QuantiteActuelle { get; set; }
    public int CapaciteRestante { get; set; }
    public bool CapaciteDepassee { get; set; }
    public int QuantiteDepassee { get; set; }
    public decimal TauxOccupation { get; set; }
    public int ArticlesCount { get; set; }
    public string Statut { get; set; } = string.Empty;
}

public class CreateCaseDto
{
    public int ZoneId { get; set; }
    public string CodeCase { get; set; } = string.Empty;
    public int? PositionCase { get; set; }
    public int CapaciteMaximum { get; set; }
}

public class UpdateCaseDto
{
    public int ZoneId { get; set; }
    public string CodeCase { get; set; } = string.Empty;
    public int? PositionCase { get; set; }
    public int CapaciteMaximum { get; set; }
}
namespace StudentApi.DTOs;

/// <summary>
/// Result of a delete that may, instead of a hard delete, have archived or
/// deactivated something to preserve movement history.
/// </summary>
public class DeleteResultDto
{
    /// <summary>"deleted" | "archived" | "deactivated"</summary>
    public string Status { get; set; } = "deleted";
    public string Message { get; set; } = string.Empty;
    public int MovementsAffected { get; set; }
    public DateOnly? Date { get; set; }
}

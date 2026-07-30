using System;
using System.Collections.Generic;

namespace StudentApi.Models.Entities;

public partial class Zone
{
    public int ZoneId { get; set; }

    public int RayonId { get; set; }

    public string CodeZone { get; set; } = null!;

    public int? NumeroLigne { get; set; }

    public bool Actif { get; set; }

    public virtual ICollection<Case> Cases { get; set; } = new List<Case>();

    public virtual Rayon Rayon { get; set; } = null!;
}

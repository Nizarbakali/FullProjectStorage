using System;
using System.Collections.Generic;

namespace StudentApi.Models.Entities;

public partial class Rayon
{
    public int RayonId { get; set; }

    public int MagasinId { get; set; }

    public string CodeRayon { get; set; } = null!;

    public string? NomRayon { get; set; }

    public bool Actif { get; set; }

    public virtual Magasin Magasin { get; set; } = null!;

    public virtual ICollection<Zone> Zones { get; set; } = new List<Zone>();
}

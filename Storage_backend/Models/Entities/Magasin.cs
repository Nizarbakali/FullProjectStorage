using System;
using System.Collections.Generic;

namespace StudentApi.Models.Entities;

public partial class Magasin
{
    public int MagasinId { get; set; }

    public string CodeMagasin { get; set; } = null!;

    public string NomMagasin { get; set; } = null!;

    public string Ville { get; set; } = null!;

    public string Pays { get; set; } = null!;

    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public bool Actif { get; set; }

    public virtual ICollection<Rayon> Rayons { get; set; } = new List<Rayon>();
}

const FORMAT_EURO = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const FORMAT_ENTIER = new Intl.NumberFormat("fr-FR");

export function formaterPrix(centimes: number | null): string | null {
  return centimes === null ? null : FORMAT_EURO.format(centimes / 100);
}

export function formaterNombre(valeur: number): string {
  return FORMAT_ENTIER.format(valeur);
}

const MOIS_COURT = new Intl.DateTimeFormat("fr-FR", { month: "short", year: "2-digit" });

export function formaterMoisSortie(iso: string): string {
  return MOIS_COURT.format(new Date(iso)).replace(".", "");
}

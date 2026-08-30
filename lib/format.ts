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

const MOIS_LONG = new Intl.DateTimeFormat("fr-FR", { month: "long", year: "numeric" });
const JOUR_COURT = new Intl.DateTimeFormat("fr-FR", { weekday: "short", day: "numeric" });

export function formaterMoisLong(iso: string): string {
  const rendu = MOIS_LONG.format(new Date(iso));
  return rendu.charAt(0).toUpperCase() + rendu.slice(1);
}

export function formaterJour(iso: string): string {
  return JOUR_COURT.format(new Date(iso)).replace(".", "");
}

export function cleMois(iso: string): string {
  return iso.slice(0, 7);
}

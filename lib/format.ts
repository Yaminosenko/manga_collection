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

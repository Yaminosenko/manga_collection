type CoverProps = {
  couvertureUrl: string | null;
  numero: number | null;
  titre: string;
  afficherNumero?: boolean;
  placeholderClassName?: string;
};

export function Cover({
  couvertureUrl,
  numero,
  titre,
  afficherNumero = true,
  placeholderClassName = "p-[6px] text-neutral-600",
}: CoverProps) {
  if (couvertureUrl) {
    return (
      <img
        src={couvertureUrl}
        alt={numero === null ? titre : `${titre} — tome ${numero}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
      />
    );
  }

  return (
    <div
      className={`cover-placeholder flex h-full w-full items-end justify-end font-medium ${placeholderClassName}`}
    >
      {afficherNumero && numero !== null ? numero : null}
    </div>
  );
}

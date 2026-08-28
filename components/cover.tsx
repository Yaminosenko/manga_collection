type CoverProps = {
  couvertureUrl: string | null;
  numero: number | null;
  titre: string;
  afficherNumero?: boolean;
  className?: string;
};

export function Cover({
  couvertureUrl,
  numero,
  titre,
  afficherNumero = true,
  className = "",
}: CoverProps) {
  if (couvertureUrl) {
    return (
      <img
        src={couvertureUrl}
        alt={numero === null ? titre : `${titre} — tome ${numero}`}
        loading="lazy"
        decoding="async"
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div
      className={`cover-placeholder flex h-full w-full items-end justify-end p-[6px] font-medium text-neutral-600 ${className}`}
    >
      {afficherNumero && numero !== null ? numero : null}
    </div>
  );
}

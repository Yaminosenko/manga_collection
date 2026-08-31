"use client";

import { useState } from "react";

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
  const [urlEnEchec, setUrlEnEchec] = useState<string | null>(null);

  if (couvertureUrl && couvertureUrl !== urlEnEchec) {
    return (
      <img
        src={couvertureUrl}
        alt={numero === null ? titre : `${titre} — tome ${numero}`}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        ref={(image) => {
          if (image && image.complete && image.naturalWidth === 0) {
            setUrlEnEchec(couvertureUrl);
          }
        }}
        onError={() => setUrlEnEchec(couvertureUrl)}
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

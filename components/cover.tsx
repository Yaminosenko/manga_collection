"use client";

import { useState } from "react";

import { MENTION_SANS_COUVERTURE } from "@/lib/constants";

const LARGEUR_REPERE = 100;
const HAUTEUR_REPERE = 141;
const TAILLE_MENTION = 11;
const LARGEUR_MENTION = 76;

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
      className={`cover-placeholder relative flex h-full w-full items-end justify-end font-medium ${placeholderClassName}`}
    >
      <svg
        viewBox={`0 0 ${LARGEUR_REPERE} ${HAUTEUR_REPERE}`}
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
        className="absolute inset-0 h-full w-full"
      >
        <text
          x={LARGEUR_REPERE / 2}
          y={HAUTEUR_REPERE / 2}
          textLength={LARGEUR_MENTION}
          fontSize={TAILLE_MENTION}
          textAnchor="middle"
          dominantBaseline="central"
          fill="currentColor"
        >
          {MENTION_SANS_COUVERTURE}
        </text>
      </svg>
      {afficherNumero && numero !== null ? <span className="relative">{numero}</span> : null}
    </div>
  );
}

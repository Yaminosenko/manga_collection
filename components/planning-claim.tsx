"use client";

import { useTransition } from "react";
import { marquerSortieObtenue } from "@/lib/actions";
import { LIBELLE_SORTIE_EN_COURS, LIBELLE_SORTIE_OBTENUE } from "@/lib/constants";

export function PlanningClaim({ slug, numero }: { slug: string; numero: number }) {
  const [enCours, demarrer] = useTransition();

  return (
    <button
      type="button"
      disabled={enCours}
      onClick={() => demarrer(() => marquerSortieObtenue(slug, numero))}
      className="border-accent-700 text-accent hover:bg-accent-800/40 min-h-[44px] flex-none rounded-[8px] border px-[12px] text-[12.5px] font-medium transition-colors disabled:opacity-50"
    >
      {enCours ? LIBELLE_SORTIE_EN_COURS : LIBELLE_SORTIE_OBTENUE}
    </button>
  );
}

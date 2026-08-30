"use client";

import { LIBELLE_PLANNING_ERREUR } from "@/lib/constants";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-[14px] px-[18px] text-center">
      <p className="text-[13px] text-neutral-400">{LIBELLE_PLANNING_ERREUR}</p>
      <button
        type="button"
        onClick={reset}
        className="border-accent text-accent min-h-11 rounded-md border px-[14px] text-[13px] font-medium transition-colors hover:bg-accent/12"
      >
        Réessayer
      </button>
    </div>
  );
}

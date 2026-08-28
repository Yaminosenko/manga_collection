"use client";

import { useState } from "react";
import { CaretDown, CaretRight } from "@/components/icons";

type CollapsibleSectionProps = {
  libelle: string;
  compteur: number;
  children: React.ReactNode;
};

export function CollapsibleSection({ libelle, compteur, children }: CollapsibleSectionProps) {
  const [ouverte, setOuverte] = useState(false);

  return (
    <section className="mt-[8px]">
      <button
        type="button"
        onClick={() => setOuverte((precedent) => !precedent)}
        aria-expanded={ouverte}
        className="flex min-h-11 w-full items-center gap-[6px] text-[12px] text-neutral-600"
      >
        {ouverte ? <CaretDown className="size-[12px]" /> : <CaretRight className="size-[12px]" />}
        {libelle}
        <span className="text-neutral-700">{compteur}</span>
      </button>

      {ouverte ? children : null}
    </section>
  );
}

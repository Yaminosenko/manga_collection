"use client";

import { useOptimistic, useTransition } from "react";
import { basculerTome, definirTousLesTomes } from "@/lib/actions";
import { Cover } from "@/components/cover";
import { Check } from "@/components/icons";
import { CASES_A_PARAITRE } from "@/lib/constants";
import { useEnLigne } from "@/lib/use-online";
import type { Tome } from "@/lib/domain";

type Mutation = { type: "bascule"; numero: number } | { type: "tous"; possede: boolean };

type VolumeGridProps = {
  slug: string;
  titre: string;
  tomesParus: number;
  aParaitre: boolean;
  tomes: Tome[];
};

const MENTION_ENREGISTREMENT =
  "Un tap coche ou décoche. Les modifications sont enregistrées au fil de l'eau.";

function reduire(etat: number[], mutation: Mutation, tomesParus: number): number[] {
  if (mutation.type === "tous") {
    return mutation.possede
      ? Array.from({ length: tomesParus }, (_, index) => index + 1)
      : [];
  }
  return etat.includes(mutation.numero)
    ? etat.filter((numero) => numero !== mutation.numero)
    : [...etat, mutation.numero];
}

export function VolumeGrid({ slug, titre, tomesParus, aParaitre, tomes }: VolumeGridProps) {
  const enLigne = useEnLigne();
  const [, demarrerTransition] = useTransition();
  const [possedes, appliquer] = useOptimistic(
    tomes.filter((tome) => tome.possede).map((tome) => tome.numero),
    (etat: number[], mutation: Mutation) => reduire(etat, mutation, tomesParus),
  );

  const parNumero = new Map(tomes.map((tome) => [tome.numero, tome]));
  const possedesSet = new Set(possedes);

  function basculer(numero: number) {
    if (!enLigne) {
      return;
    }
    const cible = !possedesSet.has(numero);
    demarrerTransition(async () => {
      appliquer({ type: "bascule", numero });
      await basculerTome(slug, numero, cible);
    });
  }

  function definirTous(possede: boolean) {
    if (!enLigne) {
      return;
    }
    demarrerTransition(async () => {
      appliquer({ type: "tous", possede });
      await definirTousLesTomes(slug, possede);
    });
  }

  return (
    <>
      <div className="flex items-center justify-between px-[18px] pb-[14px]">
        <span className="text-[17px] font-medium text-text">
          {possedes.length} / {tomesParus} tomes
        </span>
        <div className="flex gap-[7px]">
          <button
            type="button"
            onClick={() => definirTous(true)}
            className="min-h-11 rounded-md border border-neutral-800 px-[11px] text-[11px] font-medium text-neutral-300 transition-colors hover:border-accent-600 hover:text-accent-200"
          >
            Tout
          </button>
          <button
            type="button"
            onClick={() => definirTous(false)}
            className="min-h-11 rounded-md border border-neutral-800 px-[11px] text-[11px] font-medium text-neutral-300 transition-colors hover:border-accent-600 hover:text-accent-200"
          >
            Aucun
          </button>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-[14px] overflow-y-auto px-[18px] pb-[18px]">
        <div className="grid grid-cols-4 gap-[9px]">
          {Array.from({ length: tomesParus }, (_, index) => index + 1).map((numero) => {
            const possede = possedesSet.has(numero);
            const tome = parNumero.get(numero) ?? null;
            return (
              <button
                key={numero}
                type="button"
                aria-pressed={possede}
                aria-label={`Tome ${numero}`}
                onClick={() => basculer(numero)}
                className={`case-tome relative aspect-cover overflow-hidden rounded-cover ${
                  possede ? "case-possede" : "case-manquant"
                }`}
              >
                <span
                  className={`absolute inset-0 ${possede ? "" : "couverture-manquante"}`}
                >
                  <Cover
                    couvertureUrl={tome?.couvertureUrl ?? null}
                    numero={numero}
                    titre={titre}
                    afficherNumero={false}
                  />
                </span>
                <span
                  className={`absolute bottom-0 left-0 m-[5px] rounded-[3px] px-[6px] py-[2px] text-[11px] font-medium ${
                    possede ? "bg-accent-800 text-accent-200" : "bg-scrim text-neutral-500"
                  }`}
                >
                  {numero}
                </span>
                {possede ? (
                  <span className="absolute top-[5px] right-[5px] flex size-[18px] items-center justify-center rounded-full bg-accent-700">
                    <Check className="size-[10px] text-accent-100" />
                  </span>
                ) : null}
              </button>
            );
          })}

          {aParaitre
            ? Array.from({ length: CASES_A_PARAITRE }, (_, index) => (
                <div
                  key={`a-paraitre-${index}`}
                  aria-hidden="true"
                  className="case-a-paraitre aspect-cover rounded-cover"
                />
              ))
            : null}
        </div>

        <div className="flex gap-[14px] text-[10.5px] text-neutral-600">
          <span className="flex items-center gap-[5px]">
            <span className="case-possede size-[9px] rounded-[2px] bg-surface" />
            Possédé
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="couverture-manquante size-[9px] rounded-[2px] bg-surface" />
            Manquant
          </span>
          <span className="flex items-center gap-[5px]">
            <span className="size-[9px] rounded-[2px] border border-dashed border-neutral-800" />
            À paraître
          </span>
        </div>

        <span className="text-[11px]/[1.5] text-neutral-600">{MENTION_ENREGISTREMENT}</span>
      </div>
    </>
  );
}

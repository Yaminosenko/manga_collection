import Link from "next/link";
import { Cover } from "@/components/cover";
import { ProgressBar } from "@/components/progress-bar";
import { Check, FlagCheckered, PauseCircle, WarningCircle } from "@/components/icons";
import {
  aDesTomesAParaitre,
  estComplete,
  etiquetteStatutLigne,
  sousTitreLigne,
  type LigneCollection,
} from "@/lib/domain";
import { LIBELLES_STATUT } from "@/lib/constants";

const PLACEHOLDER_LIGNE = "p-[6px] text-[12px] text-neutral-700";

function IconeEtat({ ligne }: { ligne: LigneCollection }) {
  const className = "size-[14px] flex-none text-neutral-600";

  if (ligne.aVerifier) {
    return <WarningCircle className={className} />;
  }
  if (ligne.termineeForcee) {
    return <FlagCheckered className={className} />;
  }
  return null;
}

function EtiquetteStatut({ libelle }: { libelle: string }) {
  return (
    <span className="flex flex-none items-center gap-[5px] rounded-sm border border-neutral-800 px-[7px] py-[2px] text-[10px] font-medium text-neutral-400">
      <PauseCircle className="size-[11px]" />
      {libelle}
    </span>
  );
}

export function CollectionRow({ ligne }: { ligne: LigneCollection }) {
  const desature = ligne.statut === "ABANDONNEE" || ligne.statut === "EN_PAUSE";
  const vendue = ligne.statut === "VENDUE";
  const statut = etiquetteStatutLigne(ligne);
  const complete = estComplete(ligne);

  return (
    <Link
      href={`/edition/${ligne.slug}`}
      className="border-row-divider flex items-center gap-[14px] border-b py-[9px] transition-colors hover:bg-text/2"
    >
      <div
        className={`shadow-edge h-[120px] w-[84px] flex-none overflow-hidden rounded-cover ${
          desature ? "opacity-50" : ""
        }`}
      >
        <Cover
          couvertureUrl={ligne.couvertureUrl}
          numero={ligne.dernierNumeroPossede}
          titre={ligne.titre}
          placeholderClassName={PLACEHOLDER_LIGNE}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-[6px]">
        <div className="flex items-center gap-[6px]">
          <span
            className={`titre-serie truncate text-[15.5px] font-medium ${
              desature ? "text-neutral-500" : "text-text"
            }`}
          >
            {ligne.titre}
          </span>
          <IconeEtat ligne={ligne} />
          {statut ? <EtiquetteStatut libelle={statut} /> : null}
        </div>

        <span className="truncate text-[12.5px] text-neutral-600">{sousTitreLigne(ligne)}</span>

        {vendue ? (
          <span className="mt-[5px] text-[12.5px] font-medium text-neutral-600">
            {LIBELLES_STATUT.VENDUE}
          </span>
        ) : (
          <div className="mt-[5px] flex items-center gap-[9px]">
            <ProgressBar
              possedes={ligne.possedes}
              tomesParus={ligne.tomesParus}
              aParaitre={aDesTomesAParaitre(ligne.editionTerminee)}
              desature={desature}
            />
            {complete ? (
              <span className="bg-accent-800 text-accent-200 flex flex-none items-center gap-[4px] rounded-[3px] px-[6px] py-[2px] text-[10px] font-medium">
                <Check className="size-[9px]" />
                {ligne.possedes} / {ligne.tomesParus}
              </span>
            ) : (
              <span
                className={`text-[12.5px] font-medium whitespace-nowrap ${
                  desature ? "text-neutral-600" : "text-neutral-300"
                }`}
              >
                {ligne.possedes} / {ligne.tomesParus}
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}

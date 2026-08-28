import Link from "next/link";
import { Cover } from "@/components/cover";
import { ProgressBar } from "@/components/progress-bar";
import { FlagCheckered, PauseCircle, WarningCircle } from "@/components/icons";
import { LIBELLES_STATUT } from "@/lib/constants";
import { aDesTomesAParaitre, sousTitreLigne, type LigneCollection } from "@/lib/domain";

const PLACEHOLDER_LIGNE = "p-[4px] text-[10px] text-neutral-700";

function IconeEtat({ ligne }: { ligne: LigneCollection }) {
  const className = "size-[13px] flex-none text-neutral-600";

  if (ligne.aVerifier) {
    return <WarningCircle className={className} />;
  }
  if (ligne.termineeForcee) {
    return <FlagCheckered className={className} />;
  }
  if (ligne.statut === "ABANDONNEE" || ligne.statut === "EN_PAUSE") {
    return <PauseCircle className={className} />;
  }
  return null;
}

export function CollectionRow({ ligne }: { ligne: LigneCollection }) {
  const desature = ligne.statut === "ABANDONNEE" || ligne.statut === "EN_PAUSE";
  const vendue = ligne.statut === "VENDUE";

  return (
    <Link
      href={`/edition/${ligne.slug}`}
      className="border-row-divider flex items-center gap-[12px] border-b py-[13px] transition-colors hover:bg-text/2"
    >
      <div
        className={`shadow-edge h-[74px] w-[52px] flex-none overflow-hidden rounded-cover ${
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

      <div className="flex min-w-0 flex-1 flex-col gap-[4px]">
        <div className="flex items-center gap-[5px]">
          <span
            className={`truncate text-[14px] font-medium ${
              desature ? "text-neutral-500" : "text-text"
            }`}
          >
            {ligne.titre}
          </span>
          <IconeEtat ligne={ligne} />
        </div>

        <span className="truncate text-[11.5px] text-neutral-600">{sousTitreLigne(ligne)}</span>

        {vendue ? (
          <span className="mt-[3px] text-[11.5px] font-medium text-neutral-600">
            {LIBELLES_STATUT.VENDUE}
          </span>
        ) : (
          <div className="mt-[3px] flex items-center gap-[8px]">
            <ProgressBar
              possedes={ligne.possedes}
              tomesParus={ligne.tomesParus}
              aParaitre={aDesTomesAParaitre(ligne.editionTerminee)}
              desature={desature}
            />
            <span
              className={`text-[11.5px] font-medium whitespace-nowrap ${
                desature ? "text-neutral-600" : "text-neutral-300"
              }`}
            >
              {ligne.possedes} / {ligne.tomesParus}
            </span>
          </div>
        )}
      </div>
    </Link>
  );
}

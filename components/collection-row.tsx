import Link from "next/link";
import { Cover } from "@/components/cover";
import { ProgressBar } from "@/components/progress-bar";
import { FlagCheckered, PauseCircle, WarningCircle } from "@/components/icons";
import { LIBELLES_STATUT } from "@/lib/constants";
import { aDesTomesAParaitre, sousTitreLigne, type LigneCollection } from "@/lib/domain";

const PLACEHOLDER_LIGNE = "p-[6px] text-[12px] text-neutral-700";

function IconeEtat({ ligne }: { ligne: LigneCollection }) {
  const className = "size-[14px] flex-none text-neutral-600";

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
        <div className="flex items-center gap-[5px]">
          <span
            className={`titre-serie truncate text-[15.5px] font-medium ${
              desature ? "text-neutral-500" : "text-text"
            }`}
          >
            {ligne.titre}
          </span>
          <IconeEtat ligne={ligne} />
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
            <span
              className={`text-[12.5px] font-medium whitespace-nowrap ${
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

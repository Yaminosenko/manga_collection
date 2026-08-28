import { MissingGroup } from "@/components/missing-group";
import { chargerManquants } from "@/lib/editions";
import { LIBELLE_AUCUN_MANQUANT, TITRE_MANQUANTS } from "@/lib/constants";
import { formaterNombre } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Page() {
  const { editions, tomesManquants } = await chargerManquants();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-[12px] px-[18px] pt-[14px] pb-[10px]">
        <h1 className="text-[20px] font-medium text-text">{TITRE_MANQUANTS}</h1>
        <span className="text-[11.5px] whitespace-nowrap text-neutral-500">
          {formaterNombre(tomesManquants)} tomes · {formaterNombre(editions.length)} éditions
        </span>
      </header>

      <div className="flex flex-1 flex-col px-[18px] pb-[18px]">
        {editions.length === 0 ? (
          <p className="py-[24px] text-[13px] text-neutral-600">{LIBELLE_AUCUN_MANQUANT}</p>
        ) : (
          <ul className="flex flex-col">
            {editions.map((edition) => (
              <MissingGroup key={edition.slug} edition={edition} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

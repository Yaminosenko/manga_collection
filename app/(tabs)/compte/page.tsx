import { AccountForm } from "@/components/account-form";
import { chargerCompteCourant } from "@/lib/compte";
import { LIBELLE_ROLE_PROPRIETAIRE, TITRE_COMPTE } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page() {
  const compte = await chargerCompteCourant();

  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-baseline justify-between gap-[12px] px-[18px] pt-[22px] pb-[16px]">
        <h1 className="text-text text-[22px] font-semibold">{TITRE_COMPTE}</h1>
        {compte.proprietaire ? (
          <span className="text-[12px] text-neutral-500">{LIBELLE_ROLE_PROPRIETAIRE}</span>
        ) : null}
      </header>

      <AccountForm compte={compte} />
    </main>
  );
}

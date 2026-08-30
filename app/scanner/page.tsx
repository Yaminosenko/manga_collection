import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "@/components/icons";
import { Scanner } from "@/components/scanner";
import { estProprietaire } from "@/lib/guard";
import { TITRE_SCANNER } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default async function Page() {
  if (!(await estProprietaire())) {
    notFound();
  }

  return (
    <main className="flex min-h-dvh flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[16px]">
        <Link href="/ajouter" aria-label="Retour à l’ajout" className="text-accent flex min-h-11 items-center">
          <ArrowLeft className="size-[18px]" />
        </Link>
        <span className="text-text text-[15px] font-medium">{TITRE_SCANNER}</span>
      </header>

      <Scanner />
    </main>
  );
}

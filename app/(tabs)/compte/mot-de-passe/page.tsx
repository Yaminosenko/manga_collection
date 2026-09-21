import Link from "next/link";
import { AccountPasswordForm } from "@/components/account-password-form";
import { ArrowLeft } from "@/components/icons";
import {
  CHEMIN_COMPTE,
  LIBELLE_RETOUR_COMPTE,
  TITRE_COMPTE,
  TITRE_SECTION_MOT_DE_PASSE,
} from "@/lib/constants";

export default function Page() {
  return (
    <main className="flex flex-1 flex-col">
      <header className="flex items-center gap-[12px] px-[18px] pt-[22px] pb-[20px]">
        <Link
          href={CHEMIN_COMPTE}
          aria-label={LIBELLE_RETOUR_COMPTE}
          className="text-accent flex min-h-11 items-center"
        >
          <ArrowLeft className="size-[18px]" />
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-text truncate text-[14px] font-medium">
            {TITRE_SECTION_MOT_DE_PASSE}
          </span>
          <span className="truncate text-[11px] text-neutral-600">{TITRE_COMPTE}</span>
        </div>
      </header>

      <AccountPasswordForm />
    </main>
  );
}

import { AccessForm } from "@/components/access-form";
import { accesConfigure } from "@/lib/auth";
import { LIBELLE_ACCES_NON_CONFIGURE, TITRE_ACCES } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[18px] px-[18px]">
      <h1 className="text-[15px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
        {TITRE_ACCES}
      </h1>
      {accesConfigure() ? (
        <AccessForm />
      ) : (
        <p className="text-center text-[13px] text-neutral-400">
          {LIBELLE_ACCES_NON_CONFIGURE}
        </p>
      )}
    </main>
  );
}

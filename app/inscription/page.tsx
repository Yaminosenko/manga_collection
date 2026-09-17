import { SignupForm } from "@/components/signup-form";
import { signatureConfiguree } from "@/lib/auth";
import { LIBELLE_SIGNATURE_NON_CONFIGUREE, TITRE_INSCRIPTION } from "@/lib/constants";

export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-[18px] px-[18px]">
      <h1 className="text-[15px] font-medium tracking-[0.08em] text-neutral-500 uppercase">
        {TITRE_INSCRIPTION}
      </h1>
      {signatureConfiguree() ? (
        <SignupForm />
      ) : (
        <p className="text-center text-[13px] text-neutral-400">
          {LIBELLE_SIGNATURE_NON_CONFIGUREE}
        </p>
      )}
    </main>
  );
}

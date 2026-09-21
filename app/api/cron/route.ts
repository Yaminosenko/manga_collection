import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { BUDGET_COUVERTURES_MS } from "@/lib/constants";
import { acquerirCouverturesManquantes } from "@/lib/couvertures";
import { promouvoirSortiesEchues } from "@/lib/promotion";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PREFIXE_AUTORISATION = "Bearer ";

function autorise(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const entete = request.headers.get("authorization");
  return entete === `${PREFIXE_AUTORISATION}${secret}`;
}

export async function GET(request: NextRequest) {
  if (!autorise(request)) {
    return new NextResponse(null, { status: 401 });
  }

  const debut = Date.now();
  const maintenant = new Date();
  const { promues, horsSequence, retirees } = await promouvoirSortiesEchues(maintenant);

  if (retirees.length > 0) {
    revalidatePath("/planning");
  }

  if (promues.length > 0) {
    revalidatePath("/planning");
    revalidatePath("/manquants");
    revalidatePath("/");
    for (const promue of promues) {
      revalidatePath(`/edition/${promue.slug}`);
      revalidatePath(`/edition/${promue.slug}/tomes`);
    }
  }

  const couvertures = await acquerirCouverturesManquantes(
    maintenant,
    BUDGET_COUVERTURES_MS - (Date.now() - debut),
  );

  if (couvertures.obtenues > 0) {
    revalidatePath("/");
  }

  return NextResponse.json({
    promues: promues.length,
    sorties: promues.map((promue) => `${promue.slug} t${promue.numero}`),
    horsSequence,
    retirees,
    couvertures,
  });
}

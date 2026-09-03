import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { promouvoirSortiesEchues } from "@/lib/promotion";

export const dynamic = "force-dynamic";

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

  const promues = await promouvoirSortiesEchues(new Date());

  if (promues.length > 0) {
    revalidatePath("/planning");
    revalidatePath("/manquants");
    revalidatePath("/");
    for (const promue of promues) {
      revalidatePath(`/edition/${promue.slug}`);
      revalidatePath(`/edition/${promue.slug}/tomes`);
    }
  }

  return NextResponse.json({
    promues: promues.length,
    sorties: promues.map((promue) => `${promue.slug} t${promue.numero}`),
  });
}

import { Community } from "@/components/community";
import { classerComptes } from "@/lib/communaute";
import { exigerAcces } from "@/lib/guard";

export const dynamic = "force-dynamic";

export default async function Page() {
  await exigerAcces();
  const classement = await classerComptes("");

  return <Community classementInitial={classement} />;
}

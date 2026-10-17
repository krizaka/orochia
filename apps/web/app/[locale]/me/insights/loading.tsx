import { BlocksSkeleton } from "@/components/loading/skeletons";
import { getI18n } from "@/lib/i18n-server";

export default async function Loading() {
  const { t } = await getI18n();
  return <BlocksSkeleton label={t("insights.loading")} />;
}

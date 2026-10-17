import { BlocksSkeleton } from "@/components/loading/skeletons";
import { t } from "@/lib/i18n";

export default function Loading() {
  return <BlocksSkeleton label={t("dashboard.loading")} />;
}

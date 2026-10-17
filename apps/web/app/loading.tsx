import { BlocksSkeleton } from "@/components/loading/skeletons";
import { t } from "@/lib/i18n";

/** Any route without a loading state of its own: a header and a few blocks, never a spinner on an empty page. */
export default function Loading() {
  return <BlocksSkeleton label={t("common.loading")} />;
}

import { getI18n } from "@/lib/i18n-server";

/**
 * A calm line under the footer of a deployment that is not open to the public (APP_SEARCH_INDEXING=off: dev, preview) —
 * the same flag that keeps it out of search engines. Tokens only: it reads in dark and light.
 */
export async function DevEnvironmentNotice() {
  const { t } = await getI18n();
  return (
    <p data-testid="dev-environment-notice" className="mx-auto max-w-6xl px-4 pb-24 text-center text-xs text-fg-muted md:pb-6">
      {t("footer.devNotice")}
    </p>
  );
}

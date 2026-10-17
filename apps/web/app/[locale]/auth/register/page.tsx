import Link from "next/link";

import { RegisterForm } from "@/components/RegisterForm";
import { buttonVariants, cn, EmptyState } from "@/components/ui";
import { signupEnabled } from "@/lib/features";
import { getI18n } from "@/lib/i18n-server";

export const dynamic = "force-dynamic";

/** The sign-up form — or, while `AUTH_SIGNUP_ENABLED` is off, a calm note that sign-ups are closed. */
export default async function RegisterPage() {
  const { t } = await getI18n();
  if (signupEnabled()) return <RegisterForm />;
  return (
    <div className="mx-auto max-w-lg px-4 py-24" data-testid="signup-closed">
      <EmptyState
        bird="owl"
        title={t("auth.register.closedTitle")}
        description={t("auth.register.closedBody")}
        action={
          <Link href="/auth/login" className={cn(buttonVariants({ variant: "secondary", size: "md", shape: "pill" }))}>
            {t("auth.register.closedSignIn")}
          </Link>
        }
      />
    </div>
  );
}

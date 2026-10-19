import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { setAccountLocale } from "@/lib/account-locale";
import { requireUserWithRole } from "@/lib/auth";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

const Body = z.object({ locale: z.enum(["en", "fr"]) });

/** Sets the language of the signed-in account (`en` or `fr`), which its e-mails, push and live notifications are written in. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    const { locale } = Body.parse(await req.json());
    await setAccountLocale(user.id, locale);
    return NextResponse.json({ success: true, locale });
  } catch (error) {
    return errorResponse(error, "me/locale");
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { PAYOUT_METHODS, getPayoutAccount, savePayoutAccount } from "@/lib/payout-account";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

const Account = z.object({
  method: z.enum(PAYOUT_METHODS),
  holderName: z.string().trim().min(2).max(120),
  country: z.string().trim().length(2),
  details: z.record(z.string().max(120)),
});

/** Where your earnings are sent — shown masked (e.g. "IBAN FR •••• 4321"), never in full. */
export async function GET() {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    return NextResponse.json({ success: true, account: await getPayoutAccount(user.id) });
  } catch (error) {
    return errorResponse(error, "me/payout-account/get");
  }
}

/** Saves (or replaces) where your earnings are sent; the details are checked and encrypted at rest. */
export async function PUT(req: NextRequest) {
  try {
    const user = await requireUserWithRole(["CREATOR", "ADMIN"]);
    if (!(await checkRateLimit(`payout-account:${user.id}`, 10, 60 * 60)).success) return jsonError(429, "Too many changes. Try again later.");
    return NextResponse.json({ success: true, account: await savePayoutAccount(user.id, Account.parse(await req.json())) });
  } catch (error) {
    return errorResponse(error, "me/payout-account/put");
  }
}

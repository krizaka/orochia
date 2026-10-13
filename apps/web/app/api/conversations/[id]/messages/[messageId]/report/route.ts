import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { sendTemplate } from "@/lib/mail";
import { MESSAGE_REPORT_REASONS, reportMessage } from "@/lib/messaging";
import { limitAction } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const Body = z.object({
  reason: z.enum(MESSAGE_REPORT_REASONS),
  details: z.string().trim().max(2000).optional(),
});

/** Reports a message the account received: a compliance report naming it, with its text, triaged by operators. */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string; messageId: string }> }) {
  try {
    const user = await requireUserWithRole(["ADMIN", "CREATOR", "MEMBER"]);
    await limitAction("report", req, user.id, { perIp: [20, 60 * 60], perUser: [30, 24 * 60 * 60] }, "Too many reports. Try again later.");
    const { id, messageId } = await props.params;
    const ids = z.object({ id: z.string().uuid(), messageId: z.string().uuid() }).safeParse({ id, messageId });
    if (!ids.success) return jsonError(404, "Message not found");
    const input = Body.parse(await req.json());
    const report = await reportMessage({ conversationId: ids.data.id, messageId: ids.data.messageId, reporterId: user.id, ...input });

    // Persisted first; the e-mails only notify (best-effort).
    const alertTo = process.env.MAIL_COMPLIANCE_ALERT_TO;
    if (alertTo) {
      void sendTemplate("content-report-alert", {
        to: alertTo,
        replyTo: report.reporterEmail,
        vars: {
          ticket: report.ticketId,
          reason: input.reason,
          urgent: report.urgent,
          videoTitle: `Direct message from @${report.senderUsername}`,
          // The message is in the report (details) and in the operator console; there is no page to link.
          videoLink: "",
          reporterEmail: report.reporterEmail,
          reporterUsername: user.username,
          details: report.details,
        },
      });
    }
    return NextResponse.json({ success: true, ticketId: report.ticketId, status: "OPEN" }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "conversations/[id]/messages/[messageId]/report");
  }
}

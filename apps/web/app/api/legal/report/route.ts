import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { db, complianceReports, videos } from "@orochia/db";
import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";
import { errorResponse, jsonError } from "@/lib/http";
import { sendTemplate } from "@/lib/mail";
import { appUrl } from "@/lib/env";

export const dynamic = "force-dynamic";

const ReportSchema = z.object({
  videoId: z.string().max(64),
  videoTitle: z.string().trim().min(1).max(255),
  reason: z.enum(["NON_CONSENSUAL", "UNDERAGE", "DMCA_COPYRIGHT", "TERMS_VIOLATION", "FRAUD_SCAM"]),
  details: z.string().trim().min(5).max(5000),
  reporterEmail: z.string().trim().email().max(255),
});

/**
 * Content reports. Persisted before they are acknowledged — the ticket id returned is the row id —
 * and triaged in the admin control plane. Anonymous reports are accepted: the people most likely
 * to report non-consensual content are not account holders.
 */
export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const limit = await checkRateLimit(`report:${ip}`, 20, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many reports. Try again later.");

    const input = ReportSchema.parse(await req.json());
    const videoId = z.string().uuid().safeParse(input.videoId);
    const [video] = videoId.success
      ? await db.select({ id: videos.id }).from(videos).where(eq(videos.id, videoId.data)).limit(1)
      : [];
    const reporter = await getCurrentUser();

    const [report] = await db
      .insert(complianceReports)
      .values({
        videoId: video?.id ?? null,
        videoTitle: input.videoTitle,
        reason: input.reason,
        details: input.details,
        reporterEmail: input.reporterEmail,
        reporterId: reporter?.id ?? null,
      })
      .returning({ id: complianceReports.id });

    // Persisted first; the e-mails only notify (best-effort, never delay or fail the report).
    const urgent = input.reason === "UNDERAGE" || input.reason === "NON_CONSENSUAL";
    const alertTo = process.env.COMPLIANCE_ALERT_EMAIL;
    if (alertTo) {
      void sendTemplate("content-report-alert", {
        to: alertTo,
        replyTo: input.reporterEmail,
        vars: {
          ticket: report.id,
          reason: input.reason,
          urgent,
          videoTitle: input.videoTitle,
          videoLink: video ? `${appUrl()}/watch/${video.id}` : "",
          reporterEmail: input.reporterEmail,
          reporterUsername: reporter?.username ?? "",
          details: input.details,
        },
      });
    }
    void sendTemplate("content-report-receipt", {
      to: input.reporterEmail,
      vars: { ticket: report.id, ticketShort: report.id.slice(0, 8), videoTitle: input.videoTitle, urgent },
    });

    return NextResponse.json(
      { success: true, ticketId: report.id, status: "OPEN", message: "Report received. It will be reviewed." },
      { status: 201 },
    );
  } catch (error) {
    return errorResponse(error, "legal/report");
  }
}

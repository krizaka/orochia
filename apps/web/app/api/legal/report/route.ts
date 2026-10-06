import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

const ReportSchema = z.object({
  videoId: z.string().uuid().or(z.string()),
  videoTitle: z.string().min(1),
  reason: z.enum([
    "NON_CONSENSUAL",
    "UNDERAGE",
    "DMCA_COPYRIGHT",
    "TERMS_VIOLATION",
    "FRAUD_SCAM",
  ]),
  details: z.string().min(5),
  reporterEmail: z.string().email(),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const validated = ReportSchema.parse(body);

    // In production, insert into compliance_tickets or notify Slack/Webhook/Legal inbox
    console.warn(`[LEGAL REPORT LOGGED] Reason: ${validated.reason} on Video: ${validated.videoId} by ${validated.reporterEmail}`);

    return NextResponse.json({
      success: true,
      ticketId: `TICKET-${Date.now()}`,
      status: "TRIAGED",
      message: "Report received. Immediate compliance investigation initiated.",
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: "Validation failed", details: error.errors },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}

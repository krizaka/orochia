import { NextResponse } from "next/server";
import { listFeed, featuredCreator } from "@/lib/queries";
import { errorResponse } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const [videos, featured] = await Promise.all([listFeed(24), featuredCreator()]);
    return NextResponse.json({ success: true, videos, featured });
  } catch (error) {
    return errorResponse(error, "feed");
  }
}

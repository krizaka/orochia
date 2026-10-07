import { NextResponse } from "next/server";
import { checkDbHealth } from "@orochia/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealthy = await checkDbHealth();
  const isHealthy = dbHealthy;

  const status = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "up" : "down",
      },
      version: process.env.npm_package_version || "1.0.0",
    },
    { status }
  );
}

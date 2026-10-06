import { NextResponse } from "next/server";
import { checkDbHealth } from "@orochia/db";
import { checkRedisHealth } from "@/lib/redis";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbHealthy = await checkDbHealth();
  const redisHealthy = await checkRedisHealth();

  const isHealthy = dbHealthy; // DB is critical, Redis is cache

  const status = isHealthy ? 200 : 503;

  return NextResponse.json(
    {
      status: isHealthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      services: {
        database: dbHealthy ? "up" : "down",
        redis: redisHealthy ? "up" : "down",
      },
      version: process.env.npm_package_version || "1.0.0",
    },
    { status }
  );
}

import { NextResponse } from "next/server";

export async function GET() {
  const memoryUsage = process.memoryUsage();
  const uptimeSeconds = process.uptime();

  const metrics = [
    "# HELP orochia_process_uptime_seconds Total process uptime in seconds",
    "# TYPE orochia_process_uptime_seconds gauge",
    `orochia_process_uptime_seconds ${uptimeSeconds}`,
    "",
    "# HELP orochia_memory_heap_used_bytes Process heap memory used in bytes",
    "# TYPE orochia_memory_heap_used_bytes gauge",
    `orochia_memory_heap_used_bytes ${memoryUsage.heapUsed}`,
    "",
    "# HELP orochia_memory_heap_total_bytes Process heap total memory allocated in bytes",
    "# TYPE orochia_memory_heap_total_bytes gauge",
    `orochia_memory_heap_total_bytes ${memoryUsage.heapTotal}`,
    "",
    "# HELP orochia_memory_rss_bytes Process RSS memory allocated in bytes",
    "# TYPE orochia_memory_rss_bytes gauge",
    `orochia_memory_rss_bytes ${memoryUsage.rss}`,
    "",
    "# HELP orochia_service_health Orochia core service status (1 = healthy, 0 = unhealthy)",
    "# TYPE orochia_service_health gauge",
    "orochia_service_health 1",
  ].join("\n");

  return new NextResponse(metrics, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; version=0.0.4; charset=utf-8",
    },
  });
}

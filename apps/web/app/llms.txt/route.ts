import { LLMS_HEADERS, llmsText } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsText(), { headers: LLMS_HEADERS });
}

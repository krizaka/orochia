import { LLMS_HEADERS, llmsFullText } from "@/lib/llms";

export const dynamic = "force-static";

export function GET() {
  return new Response(llmsFullText(), { headers: LLMS_HEADERS });
}

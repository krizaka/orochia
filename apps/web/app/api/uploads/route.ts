import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireUserWithRole } from "@/lib/auth";
import { checkRateLimit } from "@/lib/redis";
import { uploadMediaFile } from "@/lib/storage";
import { errorResponse, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Small media uploads (avatars, thumbnails, 2257 documents). Videos never pass through here: they
 * go straight to Bunny over Tus (AGENTS.md §2.B). Only listed image/PDF types are accepted, by
 * extension AND content type, and the stored name is generated — never the client's.
 */
const RULES = {
  avatars: { roles: ["MEMBER", "CREATOR", "ADMIN"], maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  thumbnails: { roles: ["CREATOR", "ADMIN"], maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  documents: { roles: ["CREATOR", "ADMIN"], maxBytes: 20 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
} as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const category = z.enum(["avatars", "thumbnails", "documents"]).safeParse(formData.get("category"));
    if (!category.success) return jsonError(400, "Unsupported upload category");
    const rule = RULES[category.data];

    const user = await requireUserWithRole([...rule.roles]);
    const limit = await checkRateLimit(`upload:${user.id}`, 30, 60 * 60);
    if (!limit.success) return jsonError(429, "Too many uploads. Try again later.");

    const file = formData.get("file");
    if (!(file instanceof File)) return jsonError(400, "No file provided");
    if (!(rule.types as readonly string[]).includes(file.type)) return jsonError(415, "Unsupported file type");
    if (file.size === 0 || file.size > rule.maxBytes) return jsonError(413, "File too large");

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMediaFile(buffer, `upload${EXTENSIONS[file.type]}`, category.data);
    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    return errorResponse(error, "uploads");
  }
}

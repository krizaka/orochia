import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { requireUserWithRole } from "@/lib/auth";
import { errorResponse, jsonError } from "@/lib/http";
import { quotaConfig } from "@/lib/quotas";
import { enforceRateLimit, limitAction } from "@/lib/rate-limit";
import { uploadMediaFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

/**
 * Small media uploads (avatars, thumbnails, 2257 documents). Videos never pass through here: they
 * go straight to Bunny over Tus (AGENTS.md §2.B). Only listed image/PDF types are accepted, by
 * extension AND content type, and the stored name is generated — never the client's.
 */
const RULES = {
  avatars: { roles: ["MEMBER", "CREATOR", "ADMIN"], maxBytes: 5 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  banners: { roles: ["MEMBER", "CREATOR", "ADMIN"], maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  thumbnails: { roles: ["CREATOR", "ADMIN"], maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  stories: { roles: ["CREATOR", "ADMIN"], maxBytes: 10 * 1024 * 1024, types: ["image/jpeg", "image/png", "image/webp"] },
  documents: { roles: ["CREATOR", "ADMIN"], maxBytes: 20 * 1024 * 1024, types: ["application/pdf", "image/jpeg", "image/png"] },
} as const;

const EXTENSIONS: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/** Stores an avatar or a profile banner (any account), a thumbnail, a story image or a 2257 document (creators); size and type checked per kind. */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const category = z.enum(["avatars", "banners", "thumbnails", "stories", "documents"]).safeParse(formData.get("category"));
    if (!category.success) return jsonError(400, "Unsupported upload category");
    const rule = RULES[category.data];

    const user = await requireUserWithRole([...rule.roles]);
    await enforceRateLimit(`upload:${user.id}`, 30, 60 * 60, "Too many uploads. Try again later.");
    // Pictures count per day too (QUOTA_IMAGE_UPLOADS_PER_DAY) and per IP: each is small, but the zone is billed by size.
    const perDay = quotaConfig().imageUploadsPerDay;
    await limitAction("image-upload", req, perDay === null ? null : user.id, { perUser: [perDay ?? 0, 24 * 60 * 60], perIp: [120, 60 * 60] }, "Too many pictures uploaded today. Try again tomorrow.");

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

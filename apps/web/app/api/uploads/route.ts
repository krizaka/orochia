import { NextRequest, NextResponse } from "next/server";
import { uploadMediaFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const category = (formData.get("category") as any) || "videos";

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await uploadMediaFile(buffer, file.name, category);

    return NextResponse.json({
      success: true,
      data: result,
      message: `File uploaded successfully via ${result.driver} driver`,
    });
  } catch (error: any) {
    console.error("Upload handler error:", error);
    return NextResponse.json(
      { success: false, error: error.message || "Upload failed" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { whatsappClient } from "@/clients/whatsapp";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;

    const attachment = await prisma.mediaAttachment.findUnique({
      where: { id }
    });

    if (!attachment) {
      return NextResponse.json({ error: "Media not found" }, { status: 404 });
    }

    // 1. If Meta direct URL is already known, redirect immediately (zero server processing)
    if (attachment.metaUrl) {
      return NextResponse.redirect(attachment.metaUrl);
    }

    // 2. If Meta media ID exists, retrieve the Meta direct URL metadata only (no binary downloading)
    if (attachment.metaMediaId) {
      const meta = await whatsappClient.getMediaMetadata(
        attachment.metaMediaId
      );
      if (meta?.url) {
        // Save the direct URL reference to the database (no binary storage)
        await prisma.mediaAttachment.update({
          where: { id: attachment.id },
          data: {
            metaUrl: meta.url,
            mimeType: meta.mime_type || attachment.mimeType,
            fileSize: meta.file_size || attachment.fileSize
          }
        });

        return NextResponse.redirect(meta.url);
      }
    }

    // 3. Fallback: if legacy binary data is already in database
    if (attachment.data) {
      const filename = attachment.fileName || "attachment";
      const bytes = new Uint8Array(attachment.data);
      return new Response(bytes, {
        headers: {
          "Content-Type": attachment.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "public, max-age=86400"
        }
      });
    }

    return NextResponse.json(
      { error: "Media URL unavailable" },
      { status: 404 }
    );
  } catch (err) {
    console.error("Error redirecting to media:", err);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}

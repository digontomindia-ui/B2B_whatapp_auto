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

    // 1. If binary data already cached in database
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

    // 2. If Meta media ID exists, fetch and cache from Meta Cloud API
    if (attachment.metaMediaId) {
      const downloaded = await whatsappClient.downloadMedia(attachment.metaMediaId);
      if (downloaded) {
        const uint8Data = new Uint8Array(downloaded.buffer);
        // Cache in PostgreSQL for subsequent fast access
        await prisma.mediaAttachment.update({
          where: { id: attachment.id },
          data: {
            data: Buffer.from(downloaded.buffer),
            mimeType: downloaded.mimeType,
            fileSize: downloaded.buffer.length
          }
        });

        const filename = attachment.fileName || "attachment";
        return new Response(uint8Data, {
          headers: {
            "Content-Type": downloaded.mimeType || "application/octet-stream",
            "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
            "Cache-Control": "public, max-age=86400"
          }
        });
      }
    }

    // 3. If external public URL exists
    if (attachment.metaUrl) {
      return NextResponse.redirect(attachment.metaUrl);
    }

    return NextResponse.json({ error: "Media content unavailable" }, { status: 404 });
  } catch (err) {
    console.error("Error serving media:", err);
    return NextResponse.json({ error: "Failed to load media" }, { status: 500 });
  }
}

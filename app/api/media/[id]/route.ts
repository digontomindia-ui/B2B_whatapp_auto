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

    const filename = attachment.fileName || "attachment";

    // 1. If binary data is already saved in database, serve it directly
    if (attachment.data && attachment.data.length > 0) {
      const bytes = new Uint8Array(attachment.data);
      return new Response(bytes, {
        headers: {
          "Content-Type": attachment.mimeType || "application/octet-stream",
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    // 2. If it is an external public URL (not hosted on Facebook/Meta Lookaside)
    if (
      attachment.metaUrl &&
      !attachment.metaUrl.includes("fbsbx.com") &&
      !attachment.metaUrl.includes("facebook.com")
    ) {
      return NextResponse.redirect(attachment.metaUrl);
    }

    // 3. Download binary using authenticated server client from Meta
    let downloaded: { buffer: Buffer; mimeType: string } | null = null;

    if (attachment.metaMediaId) {
      downloaded = await whatsappClient.downloadMedia(attachment.metaMediaId);
    }

    if (!downloaded && attachment.metaUrl) {
      downloaded = await whatsappClient.downloadMediaByUrl(
        attachment.metaUrl,
        attachment.mimeType
      );
    }

    // If successfully downloaded, cache into database and stream back to browser
    if (downloaded && downloaded.buffer.length > 0) {
      try {
        await prisma.mediaAttachment.update({
          where: { id: attachment.id },
          data: {
            data: new Uint8Array(downloaded.buffer),
            mimeType: downloaded.mimeType,
            fileSize: downloaded.buffer.length
          }
        });
      } catch (dbErr) {
        console.error("Failed to cache media binary in database:", dbErr);
      }

      const bytes = new Uint8Array(downloaded.buffer);
      return new Response(bytes, {
        headers: {
          "Content-Type": downloaded.mimeType,
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "public, max-age=31536000, immutable"
        }
      });
    }

    return NextResponse.json(
      {
        error: "Media unavailable",
        message:
          "The media could not be downloaded from Meta. The Meta access token may have expired or the media is no longer hosted by WhatsApp."
      },
      { status: 404 }
    );
  } catch (err) {
    console.error("Error serving media:", err);
    return NextResponse.json(
      { error: "Failed to load media" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { WHATSAPP_CONFIG } from "@/lib/env";
import { processWebhookPayload } from "@/server/webhooks/service";

// Verification endpoint for Meta Webhook setup

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === WHATSAPP_CONFIG.VERIFY_TOKEN) {
    console.log("[Webhook] Verification challenge accepted by Meta");
    return new NextResponse(challenge, {
      status: 200,
      headers: { "Content-Type": "text/plain" }
    });
  }

  console.warn("[Webhook] Verification token mismatch:", {
    token,
    expected: WHATSAPP_CONFIG.VERIFY_TOKEN
  });
  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// Inbound webhook receiver
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verify it is a WhatsApp webhook
    if (body.object !== "whatsapp_business_account") {
      return NextResponse.json({ status: "ignored" }, { status: 200 });
    }

    // Process asynchronously so Meta receives 200 OK fast
    processWebhookPayload(body).catch((err) => {
      console.error("[Webhook] Error processing payload:", err);
    });

    return NextResponse.json({ status: "received" }, { status: 200 });
  } catch (err) {
    console.error("[Webhook] Error reading body:", err);
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
}

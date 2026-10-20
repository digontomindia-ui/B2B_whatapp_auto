import { NextRequest, NextResponse } from "next/server";
import { getFundsData } from "@/server/funds/service";
import { requirePermission } from "@/lib/rbac";
import { PERMISSIONS } from "@/lib/permissions";
import { WHATSAPP_CONFIG } from "@/lib/env";
import fs from "fs";
import path from "path";

export async function GET(request: NextRequest) {
  try {
    // Requires TEMPLATE_VIEW, SETTINGS_VIEW, or owner
    await requirePermission(request, PERMISSIONS.TEMPLATE_VIEW);

    const data = await getFundsData();

    return NextResponse.json({
      error: false,
      message: "Funds data retrieved successfully",
      data
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.message.includes("Unauthorized") ||
        err.message.includes("Forbidden") ||
        err.message.includes("Missing required permission"));

    return NextResponse.json(
      {
        error: true,
        message:
          err instanceof Error
            ? err.message
            : "Failed to retrieve WhatsApp funds data"
      },
      { status: isRbac ? 403 : 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Requires TEMPLATE_VIEW or SETTINGS_VIEW
    await requirePermission(request, PERMISSIONS.TEMPLATE_VIEW);

    const body = await request.json();
    const balanceNum = parseFloat(body.balance);

    if (isNaN(balanceNum) || balanceNum < 0) {
      return NextResponse.json(
        { error: true, message: "Invalid balance value provided" },
        { status: 400 }
      );
    }

    const roundedBalance = Math.round(balanceNum * 100) / 100;

    // Update in process env and WHATSAPP_CONFIG in memory
    process.env.WHATSAPP_ACCOUNT_BALANCE = String(roundedBalance);
    WHATSAPP_CONFIG.ACCOUNT_BALANCE = roundedBalance;

    // Update .env file on disk if accessible
    try {
      const envPath = path.resolve(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        let envContent = fs.readFileSync(envPath, "utf-8");
        if (envContent.includes("WHATSAPP_ACCOUNT_BALANCE=")) {
          envContent = envContent.replace(
            /WHATSAPP_ACCOUNT_BALANCE=.*/g,
            `WHATSAPP_ACCOUNT_BALANCE=${roundedBalance}`
          );
        } else {
          envContent += `\nWHATSAPP_ACCOUNT_BALANCE=${roundedBalance}\n`;
        }
        fs.writeFileSync(envPath, envContent, "utf-8");
      }
    } catch (fsErr) {
      console.warn("Could not write WHATSAPP_ACCOUNT_BALANCE to .env file:", fsErr);
    }

    const data = await getFundsData();

    return NextResponse.json({
      error: false,
      message: `WhatsApp wallet balance updated to ₹${roundedBalance}`,
      data
    });
  } catch (err: unknown) {
    const isRbac =
      err instanceof Error &&
      (err.message.includes("Unauthorized") ||
        err.message.includes("Forbidden") ||
        err.message.includes("Missing required permission"));

    return NextResponse.json(
      {
        error: true,
        message:
          err instanceof Error
            ? err.message
            : "Failed to update WhatsApp wallet balance"
      },
      { status: isRbac ? 403 : 500 }
    );
  }
}

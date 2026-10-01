"use server";
import { cookies } from "next/headers";

type CheckAuthResponse =
  | {
      authenticated: true;
      error: null;
      adminId: string;
    }
  | {
      authenticated: false;
      error: string;
      adminId: null;
    };

export async function checkAuth(): Promise<CheckAuthResponse> {
  const cookieSet = await cookies();
  const accessToken = cookieSet.get("accessToken");
  const refreshToken = cookieSet.get("refreshToken");

  if (!accessToken || !refreshToken) {
    return { authenticated: false, error: "No tokens", adminId: null };
  }

  if (accessToken) {
    // check access token
    // return success if valid
    return { authenticated: true, error: null, adminId: "" };
  }

  if (refreshToken) {
    // check refresh token
    // update accessToken if valid
    // return true if valid
    return { authenticated: true, error: null, adminId: "" };
  }

  return { authenticated: false, error: "Something went wrong", adminId: null };
}

const env = process.env;

export const DATABASE_URL = env.DATABASE_URL;
export const IS_PRODUCTION = env.NODE_ENV === "production";

export const JWT_ACCESS_SECRET = env.JWT_ACCESS_SECRET!;
export const JWT_REFRESH_SECRET = env.JWT_REFRESH_SECRET!;

export const WHATSAPP_CONFIG = {
  APP_ID: env.WHATSAPP_APP_ID!,
  BUSINESS_ID: env.WHATSAPP_BUSINESS_ID!,
  PHONE_ID: env.WHATSAPP_PHONE_ID!,
  ACCESS_TOKEN: env.WHATSAPP_ACCESS_TOKEN!,
  VERIFY_TOKEN: env.WHATSAPP_VERIFY_TOKEN!
};

export const WS_PORT = Number(env.WS_PORT);
export const NEXT_RUNTIME = env.NEXT_RUNTIME!;

import * as envKeys from "./env";

function getMissingValues(
  obj: Record<string, unknown>,

  parent = "",
  paths: string[] = []
): string[] {
  for (const [key, value] of Object.entries(obj)) {
    const path = parent ? `${parent}.${key}` : key;

    if (value !== null && typeof value === "object") {
      getMissingValues(value as Record<string, unknown>, path, paths);
    } else if (value === null || value === undefined || value === "") {
      paths.push(path);
    }
  }

  return paths;
}

// const missingsPaths = getMissingValues(envKeys);

// if (missingsPaths.length > 0) {
//   throw new Error(
//     `Missing required environment variables:\n${missingsPaths.join("\n")}`
//   );
// }

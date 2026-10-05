const env = process.env;

export const DATABASE_URL = env.DATABASE_URL || "HELLO";
export const IS_PRODUCTION = env.NODE_ENV === "production";

export const JWT_ACCESS_SECRET =
  env.JWT_ACCESS_SECRET ||
  env.JWT_SECRET ||
  "msb_super_secret_access_token_key_change_in_production_2026";

export const JWT_REFRESH_SECRET =
  env.JWT_REFRESH_SECRET ||
  env.JWT_SECRET ||
  "msb_super_secret_refresh_token_key_change_in_production_2026";

const env = process.env;

export const DATABASE_URL = env.DATABASE_URL || "HELLO";
export const IS_PRODUCTION = env.NODE_ENV === "production";

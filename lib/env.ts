const env = process.env;

const DATABASE_URI = env.DATABASE_URL;
const IS_PRODUCTION = env.NODE_ENV === "production";

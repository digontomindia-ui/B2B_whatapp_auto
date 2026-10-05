import { PrismaClient } from "@prisma/client";
import { IS_PRODUCTION } from "./env";

const client = new PrismaClient();

declare global {
  var prismaGlobal: typeof client | undefined;
}

const prisma = globalThis.prismaGlobal ?? client;
if (!IS_PRODUCTION) globalThis.prismaGlobal = prisma;

export default prisma;

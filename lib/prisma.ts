import { PrismaClient } from "@prisma/client";

const client = new PrismaClient();

declare global {
  var prismaGlobal: typeof client | undefined;
}

const prisma = globalThis.prismaGlobal ?? client;
if (process.env.NODE_ENV !== "production") globalThis.prismaGlobal = prisma;

export default prisma;

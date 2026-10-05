import { checkAuth, logoutAdmin } from "@/utils/auth";
import { AuthProvider } from "@/providers/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import prisma from "@/lib/prisma";
import { Header } from "./header";
import { Footer } from "./footer";

async function logout() {
  "use server";
  await logoutAdmin();
  redirect("/sign-in");
}

export default async function MainLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { authenticated, adminId } = await checkAuth();

  if (!authenticated) {
    redirect("/sign-in");
  }

  const admin = await prisma.admin.findUniqueOrThrow({
    where: { id: adminId }
  });

  return (
    <AuthProvider admin={admin} logout={logout}>
      <main className="flex h-screen overflow-hidden bg-background">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
          <Header />

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </main>
    </AuthProvider>
  );
}

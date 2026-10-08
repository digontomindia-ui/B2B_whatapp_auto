import { checkAuth, logoutAdmin } from "@/utils/auth";
import { AuthProvider } from "@/providers/auth";
import { redirect } from "next/navigation";
import { Sidebar } from "./sidebar";
import { Header } from "./header";

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
  const auth = await checkAuth();

  if (!auth.authenticated || !auth.actor) {
    redirect("/sign-in");
  }

  return (
    <AuthProvider user={auth.actor} logout={logout}>
      <main className="bg-background flex h-screen overflow-hidden">
        <Sidebar />

        <div className="flex h-screen min-w-0 flex-1 flex-col overflow-hidden">
          <Header />

          <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
        </div>
      </main>
    </AuthProvider>
  );
}

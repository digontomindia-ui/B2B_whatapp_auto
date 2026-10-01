import { AuthProvider } from "@/providers/auth";
import { redirect } from "next/navigation";
import { checkAuth } from "@/utils/auth";

async function logout() {
  "use server";
  // logout here
}

export default async function WithoutAuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { authenticated, adminId } = await checkAuth();

  if (!authenticated) {
    redirect("/sign-in");
  }

  return (
    <AuthProvider adminId={adminId} logout={logout}>
      {children}
    </AuthProvider>
  );
}

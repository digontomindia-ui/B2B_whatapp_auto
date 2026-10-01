import { redirect } from "next/navigation";
import { checkAuth } from "@/utils/auth";

export default async function WithoutAuthLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const { authenticated } = await checkAuth();

  if (authenticated) {
    redirect("/");
  }

  return children;
}

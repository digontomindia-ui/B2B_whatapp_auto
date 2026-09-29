import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { postsQueryOptions } from "./query";
import { getQueryClient } from "@/lib/query";
import Client from "./client";

export default async function Page() {
  const queryClient = getQueryClient();
  await queryClient.query(postsQueryOptions()).catch(() => {});

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Client />
    </HydrationBoundary>
  );
}

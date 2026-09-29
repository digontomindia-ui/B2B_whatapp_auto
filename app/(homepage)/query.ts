// app/posts/queries.ts
import { queryOptions } from "@tanstack/react-query";
import { Data } from "../api/route";

export async function getPosts() {
  const res = await fetch("/api");
  if (!res.ok) throw new Error("Failed to fetch posts");
  const json = await res.json();
  console.log({ json });
  return json as ResponseData<Array<Data>>;
}

export const postsQueryOptions = () =>
  queryOptions({
    queryKey: ["posts"],
    queryFn: getPosts,
    staleTime: 0
  });

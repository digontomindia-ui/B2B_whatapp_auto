// app/posts/queries.ts
import { queryOptions } from "@tanstack/react-query";

export interface Post {
  id: number;
  title: string;
}

export async function getPosts(): Promise<Post[]> {
  const res = await fetch("https://jsonplaceholder.typicode.com/posts");
  if (!res.ok) throw new Error("Failed to fetch posts");
  return res.json();
}

export const postsQueryOptions = () =>
  queryOptions({
    queryKey: ["posts"],
    queryFn: getPosts,
    staleTime: 60 * 1000
  });

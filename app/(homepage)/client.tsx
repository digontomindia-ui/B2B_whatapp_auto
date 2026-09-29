"use client";
import { postsQueryOptions, type Post } from "./query";
import { useQuery } from "@tanstack/react-query";

export default function Client() {
  const { data } = useQuery(postsQueryOptions());

  return (
    <ul className="flex flex-col gap-2">
      {data?.map((post: Post) => (
        <li key={post.id}>{post.title}</li>
      ))}
    </ul>
  );
}

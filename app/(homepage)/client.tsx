"use client";
import { useQuery } from "@tanstack/react-query";
import { postsQueryOptions } from "./query";

export default function Client() {
  const { data } = useQuery(postsQueryOptions());

  const results = data?.data ?? [];

  return (
    <ul className="flex flex-col gap-2 p-5">
      {results.map((r, idx) => (
        <div key={idx} className="border border-gray-400 p-1">
          <div>{r.id}</div>
          <div>{r.name}</div>
        </div>
      ))}
    </ul>
  );
}

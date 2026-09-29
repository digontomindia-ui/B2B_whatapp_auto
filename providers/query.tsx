"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";

export default function QueryProvider({
  children
}: {
  children: React.ReactNode;
}) {
  const [client] = useState(
    new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 120_000,
          retry: false,
          refetchOnWindowFocus: false,
          refetchInterval: 120_000
        }
      }
    })
  );
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

"use client";

import React, { use } from "react";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { WorkflowEditor } from "@/components/workflows/workflow-editor";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function EditWorkflowPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["workflow", id],
    queryFn: async () => {
      const res = await fetch(`/api/workflows/${id}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.message || "Failed to load workflow");
      }
      return json.data;
    }
  });

  if (isLoading) {
    return (
      <div className="bg-background flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="text-cf-orange size-6 animate-spin" />
          <p className="text-muted-foreground text-xs">Loading workflow...</p>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="bg-background flex h-full flex-col items-center justify-center p-4 text-center">
        <AlertCircle className="text-destructive mb-2 size-8" />
        <h2 className="text-foreground text-sm font-semibold">
          Workflow Not Found
        </h2>
        <p className="text-muted-foreground mt-1 mb-4 max-w-sm text-xs">
          {error instanceof Error
            ? error.message
            : "The requested workflow does not exist."}
        </p>
        <Link href="/workflows">
          <Button variant="outline" size="sm" className="text-xs">
            Back to Workflows
          </Button>
        </Link>
      </div>
    );
  }

  return <WorkflowEditor initialWorkflow={data} isNew={false} />;
}

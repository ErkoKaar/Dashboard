"use client";

import { Trophy } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetTitle } from "@/components/ui/WidgetTitle";
import { useLatestEstHoopResult } from "@/lib/queries/useLatestEstHoopResult";

export function EstHoopWidget() {
  const { isLoading } = useLatestEstHoopResult();

  return (
    <Card className="col-span-12 xl:col-span-4">
      <div className="mb-4">
        <WidgetTitle icon={Trophy}>EstHoop</WidgetTitle>
      </div>
      {isLoading ? <Skeleton className="h-24 w-full" /> : <div>{/* TODO: render latest result from `data` */}</div>}
    </Card>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Check, LogOut, Pencil } from "lucide-react";
import {
  DndContext,
  DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, rectSortingStrategy } from "@dnd-kit/sortable";
import { ClockWidget } from "@/components/widgets/ClockWidget";
import { WeatherWidget } from "@/components/widgets/WeatherWidget";
import { LoginForm } from "@/components/auth/LoginForm";
import { SortableWidget } from "@/components/SortableWidget";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/providers/AuthProvider";
import { useDashboardLayout, useUpdateDashboardLayout } from "@/lib/queries/useDashboardLayout";
import { DEFAULT_WIDGET_ORDER, WIDGET_REGISTRY, resolveWidgetOrder } from "@/lib/widgets";
import logo from "@/app/images/logo-1a-tume.jpg";

export default function DashboardPage() {
  const { taskSession, financeSession, loading, signOut } = useAuth();
  const { data: savedOrder } = useDashboardLayout();
  const updateLayout = useUpdateDashboardLayout();

  const [editMode, setEditMode] = useState(false);
  const [order, setOrder] = useState<string[]>(DEFAULT_WIDGET_ORDER);
  const hasLoadedOrder = useRef(false);

  // Only ever sync from the server once, on initial load. After that this
  // component's local `order` state is the source of truth — background
  // refetches (eg. the one `useUpdateDashboardLayout` triggers on success)
  // must never clobber an in-flight or just-applied local reorder.
  useEffect(() => {
    if (!hasLoadedOrder.current && savedOrder !== undefined) {
      setOrder(resolveWidgetOrder(savedOrder));
      hasLoadedOrder.current = true;
    }
  }, [savedOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor),
  );

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;

    const oldIndex = order.indexOf(String(active.id));
    const newIndex = order.indexOf(String(over.id));
    const newOrder = arrayMove(order, oldIndex, newIndex);
    setOrder(newOrder);
    updateLayout.mutate(newOrder);
  }

  if (loading) return null;
  if (!taskSession || !financeSession) return <LoginForm />;

  const today = new Date().toLocaleDateString("et-EE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const registryById = Object.fromEntries(WIDGET_REGISTRY.map((w) => [w.id, w]));

  return (
    <main className="mx-auto max-w-[1600px] p-4 md:p-8">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Image
            src={logo}
            alt="Dashboardi logo"
            width={40}
            height={40}
            priority
            className="rounded-xl"
          />
          <div>
            <h1 className="font-mono text-xl font-semibold uppercase leading-tight tracking-wide">
              Dashboard
            </h1>
            <p className="text-sm capitalize text-muted">{today}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden items-center gap-4 sm:flex">
            <WeatherWidget />
            <ClockWidget />
          </div>
          <div className="hidden h-6 w-px bg-border sm:block" />
          {updateLayout.error && (
            <p className="text-xs text-destructive">
              Salvestamine ebaõnnestus: {updateLayout.error.message}
            </p>
          )}
          <Button variant="ghost" onClick={() => setEditMode((v) => !v)}>
            {editMode ? (
              <Check className="h-4 w-4" aria-hidden />
            ) : (
              <Pencil className="h-4 w-4" aria-hidden />
            )}
            {editMode ? "Valmis" : "Muuda"}
          </Button>
          <Button variant="ghost" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" aria-hidden />
            Logi välja
          </Button>
        </div>
      </header>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={order} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-12 gap-4">
            {order.map((id) => {
              const widget = registryById[id];
              if (!widget) return null;
              const { Component } = widget;
              return (
                <SortableWidget key={id} id={id} editMode={editMode} className={widget.colSpan}>
                  <Component />
                </SortableWidget>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </main>
  );
}

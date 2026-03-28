"use client";

import * as React from "react";
import { Dialog as SheetPrimitive } from "radix-ui";
import { XIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ---------------------------------------------------------------------------
// Root / Trigger / Close — thin wrappers over Radix Dialog primitives
// ---------------------------------------------------------------------------

function Drawer({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Root>) {
  return <SheetPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Trigger>) {
  return <SheetPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerClose({
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Close>) {
  return <SheetPrimitive.Close data-slot="drawer-close" {...props} />;
}

// ---------------------------------------------------------------------------
// Overlay — dark semitransparent backdrop
// ---------------------------------------------------------------------------

function DrawerOverlay({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Overlay>) {
  return (
    <SheetPrimitive.Overlay
      data-slot="drawer-overlay"
      className={cn(
        "fixed inset-0 z-50 bg-black/50",
        // fade in 500ms open, fade out 300ms close
        "data-open:animate-in data-open:fade-in-0 data-open:duration-500",
        "data-closed:animate-out data-closed:fade-out-0 data-closed:duration-300",
        className
      )}
      {...props}
    />
  );
}

// ---------------------------------------------------------------------------
// Content — the side panel that slides in from the right
// ---------------------------------------------------------------------------

function DrawerContent({
  className,
  children,
  showCloseButton = true,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Content> & {
  showCloseButton?: boolean;
}) {
  return (
    <SheetPrimitive.Portal>
      <DrawerOverlay />
      <SheetPrimitive.Content
        data-slot="drawer-content"
        style={
          {
            "--slide-easing": "cubic-bezier(0.4, 0, 0.2, 1)",
          } as React.CSSProperties
        }
        className={cn(
          // position
          "fixed inset-y-0 right-0 z-50 flex flex-col",
          // sizing — full-screen on mobile, max 600px on desktop
          "h-full w-full sm:max-w-[600px]",
          // visual
          "bg-white dark:bg-slate-950 shadow-2xl border-l border-slate-200 dark:border-slate-800",
          // open — slide in 500ms
          "data-open:animate-in data-open:slide-in-from-right-full data-open:duration-500",
          // close — slide out 300ms
          "data-closed:animate-out data-closed:slide-out-to-right-full data-closed:duration-300",
          className
        )}
        {...props}
      >
        {children}

        {showCloseButton && (
          <SheetPrimitive.Close asChild>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-4 right-4 h-8 w-8 text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <XIcon className="h-4 w-4" />
              <span className="sr-only">Fechar</span>
            </Button>
          </SheetPrimitive.Close>
        )}
      </SheetPrimitive.Content>
    </SheetPrimitive.Portal>
  );
}

// ---------------------------------------------------------------------------
// Layout slots
// ---------------------------------------------------------------------------

function DrawerHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-header"
      className={cn(
        "flex-shrink-0 px-6 py-5 border-b border-slate-100 dark:border-slate-800",
        className
      )}
      {...props}
    />
  );
}

function DrawerTitle({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Title>) {
  return (
    <SheetPrimitive.Title
      data-slot="drawer-title"
      className={cn(
        "text-base font-semibold text-slate-900 dark:text-slate-100 pr-8",
        className
      )}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof SheetPrimitive.Description>) {
  return (
    <SheetPrimitive.Description
      data-slot="drawer-description"
      className={cn("mt-1 text-sm text-slate-500", className)}
      {...props}
    />
  );
}

/** Scrollable body — grows to fill available height */
function DrawerBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-body"
      className={cn("flex-1 overflow-y-auto px-6 py-5", className)}
      {...props}
    />
  );
}

function DrawerFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="drawer-footer"
      className={cn(
        "flex-shrink-0 flex items-center justify-end gap-3 px-6 py-4 border-t border-slate-100 dark:border-slate-800",
        className
      )}
      {...props}
    />
  );
}

export {
  Drawer,
  DrawerTrigger,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerBody,
  DrawerFooter,
};

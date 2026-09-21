"use client";

import { useFormStatus } from "react-dom";
import { cn, buttonClasses } from "@/lib/utils";

export { buttonClasses } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "primary" | "danger" | "secondary";
  className?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(buttonClasses(variant), "disabled:cursor-not-allowed disabled:opacity-60", className)}
    >
      {pending ? pendingText ?? "Enregistrement…" : children}
    </button>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {message}
    </div>
  );
}

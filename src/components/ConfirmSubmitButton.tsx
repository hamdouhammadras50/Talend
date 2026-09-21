"use client";

import { buttonClasses, cn } from "@/lib/utils";

export function ConfirmSubmitButton({
  confirmMessage,
  children,
  variant = "danger",
  className,
}: {
  confirmMessage: string;
  children: React.ReactNode;
  variant?: "primary" | "danger" | "secondary";
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={cn(buttonClasses(variant), className)}
      onClick={(event) => {
        if (!confirm(confirmMessage)) {
          event.preventDefault();
        }
      }}
    >
      {children}
    </button>
  );
}

import clsx from "clsx";

// Inline activity indicator for buttons and loading screens. The label next to
// it carries the meaning, so a non-spinning ring under reduced motion is fine.
export const Spinner = ({ className }: { className?: string }) => (
  <span
    aria-hidden="true"
    className={clsx(
      "inline-block h-4 w-4 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-80 motion-safe:animate-spin",
      className
    )}
  />
);

export const LoadingScreen = ({ label }: { label: string }) => (
  <div className="flex min-h-screen items-center justify-center bg-page" aria-busy="true" role="status">
    <p className="flex items-center gap-3 text-sm font-semibold text-support">
      <Spinner className="h-5 w-5" />
      {label}
    </p>
  </div>
);

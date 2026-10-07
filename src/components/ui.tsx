import type { ReactNode } from "react";

/** Minimal accessible primitives. Large targets (≥44px), visible focus, status never by colour alone (WCAG 2.2 AA). */
export function Heading({ children }: { children: ReactNode }) {
  return <h1 className="text-2xl font-semibold tracking-tight">{children}</h1>;
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-lg border border-neutral-300 p-4 dark:border-neutral-700 ${className}`}>{children}</section>;
}

export function Alert({ kind = "info", children }: { kind?: "info" | "error" | "success"; children: ReactNode }) {
  const label = kind === "error" ? "!" : kind === "success" ? "✓" : "i";
  return (
    <div role={kind === "error" ? "alert" : "status"} className="flex gap-2 rounded-md border border-current p-3">
      <span aria-hidden className="font-bold">{label}</span>
      <div>{children}</div>
    </div>
  );
}

export function Field({ label, name, type = "text", required = true, autoComplete, inputMode, pattern, maxLength, defaultValue, hint }: {
  label: string; name: string; type?: string; required?: boolean; autoComplete?: string;
  inputMode?: "numeric" | "text" | "email"; pattern?: string; maxLength?: number; defaultValue?: string; hint?: string;
}) {
  const id = `f-${name}`;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="font-medium">{label}</label>
      <input id={id} name={name} type={type} required={required} autoComplete={autoComplete} inputMode={inputMode}
        pattern={pattern} maxLength={maxLength} defaultValue={defaultValue} aria-describedby={hint ? `${id}-hint` : undefined}
        className="min-h-11 rounded-md border border-neutral-400 bg-transparent px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2" />
      {hint && <p id={`${id}-hint`} className="text-sm opacity-80">{hint}</p>}
    </div>
  );
}

export function Button({ children, variant = "primary", ...rest }: { children: ReactNode; variant?: "primary" | "secondary" } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const style = variant === "primary"
    ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
    : "border border-neutral-500";
  return (
    <button {...rest} className={`min-h-11 min-w-11 rounded-md px-4 py-2 font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${style}`}>
      {children}
    </button>
  );
}

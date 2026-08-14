import { motion } from "framer-motion";
import type { InputHTMLAttributes, ReactNode } from "react";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import { useState } from "react";

type ButtonProps = {
  variant?: "primary" | "secondary" | "ghost" | "soft" | "auth" | "glow";
  loading?: boolean;
  full?: boolean;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
  onClick?: () => void;
};

export function Button({
  variant = "primary",
  loading,
  full,
  className = "",
  children,
  disabled,
  type = "button",
  onClick,
}: ButtonProps) {
  const styles = {
    primary:
      "bg-[oklch(0.606_0.219_292.72)] text-white shadow-[0_12px_28px_oklch(0.606_0.219_292.72_/_0.35)] hover:bg-[oklch(0.627_0.233_303.9)] disabled:bg-white/20 disabled:text-white/40 disabled:shadow-none",
    glow:
      "bg-gradient-to-r from-[oklch(0.606_0.219_292.72)] to-[oklch(0.656_0.212_354.31)] text-white shadow-[0_0_40px_oklch(0.606_0.219_292.72_/_0.35)] disabled:opacity-40 disabled:shadow-none",
    secondary:
      "bg-white/[0.08] text-white border border-white/[0.08] backdrop-blur-xl disabled:opacity-40",
    ghost:
      "bg-transparent text-white/72 border border-white/[0.08] disabled:opacity-40",
    soft:
      "bg-white/[0.08] text-white shadow-soft border border-white/[0.08] disabled:opacity-40",
    auth:
      "bg-white text-[oklch(0.14_0_0)] font-semibold disabled:opacity-45",
  }[variant];

  return (
    <motion.button
      type={type}
      whileHover={disabled || loading ? undefined : { scale: 1.02 }}
      whileTap={disabled || loading ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className={[
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold tracking-[-0.01em] transition-colors",
        full ? "w-full" : "",
        styles,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Loader2 className="size-4 animate-spin" /> : children}
    </motion.button>
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
  success?: boolean;
  passwordToggle?: boolean;
};

export function Field({
  label,
  error,
  success,
  passwordToggle,
  className = "",
  id,
  type,
  ...rest
}: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const [show, setShow] = useState(false);
  const inputType = passwordToggle ? (show ? "text" : "password") : type;

  return (
    <div className="flex w-full flex-col gap-2 text-left">
      <div className="relative">
        <input
          id={fieldId}
          type={inputType}
          placeholder={label}
          className={[
            "h-[56px] w-full rounded-[14px] border bg-surface-raised px-4 text-[15px] text-ink placeholder:text-ink-tertiary transition-[border-color,box-shadow]",
            passwordToggle ? "pr-20" : "pr-12",
            error
              ? "border-danger shadow-[0_0_0_3px_oklch(0.654_0.232_28.66_/_0.12)]"
              : success
                ? "border-success shadow-[0_0_0_3px_oklch(0.73_0.194_147.44_/_0.12)]"
                : "border-line focus:border-brand focus:shadow-[0_0_0_3px_oklch(0.645_0.215_16.44_/_0.12)]",
            className,
          ].join(" ")}
          aria-invalid={Boolean(error)}
          {...rest}
        />
        <div className="absolute top-1/2 right-3 flex -translate-y-1/2 items-center gap-1.5">
          {passwordToggle ? (
            <button
              type="button"
              tabIndex={-1}
              aria-label={show ? "Hide password" : "Show password"}
              className="grid size-8 place-items-center rounded-full text-ink-tertiary hover:text-brand"
              onClick={() => setShow((v) => !v)}
            >
              {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          ) : null}
          {success ? (
            <span className="grid size-6 place-items-center rounded-full bg-success text-white">
              <Check className="size-3.5" strokeWidth={3} />
            </span>
          ) : (
            <span className="size-6 rounded-full border border-line-strong" aria-hidden />
          )}
        </div>
      </div>
      {error ? <p className="px-1 text-[13px] text-danger">{error}</p> : null}
    </div>
  );
}

export function SelectRow({
  selected,
  children,
  onClick,
}: {
  selected: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.99 }}
      aria-pressed={selected}
      onClick={onClick}
      className={[
        "flex h-[64px] w-full items-center justify-between rounded-2xl px-5 text-left text-[16px] font-medium tracking-[-0.01em] transition-all",
        selected
          ? "bg-gradient-to-r from-berry to-brand text-ink-inverse shadow-[0_12px_28px_oklch(0.645_0.215_16.44_/_0.35)]"
          : "bg-surface-muted text-ink",
      ].join(" ")}
    >
      <span>{children}</span>
      <span
        className={[
          "grid size-5 place-items-center rounded-full border text-[10px]",
          selected ? "border-white/50 bg-white text-berry" : "border-line-strong",
        ].join(" ")}
      >
        {selected ? "✓" : ""}
      </span>
    </motion.button>
  );
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${step} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={[
            "h-[3px] flex-1 rounded-full transition-colors",
            i < step
              ? "bg-gradient-to-r from-[oklch(0.606_0.219_292.72)] to-[oklch(0.656_0.212_354.31)]"
              : "bg-white/10",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

export function LogoMark({
  size = "md",
  tone = "brand",
}: {
  size?: "sm" | "md" | "lg";
  tone?: "brand" | "white";
}) {
  const dim = size === "sm" ? "size-12" : size === "lg" ? "size-[72px]" : "size-16";
  return (
    <div
      aria-hidden
      className={[
        "rounded-full",
        dim,
        tone === "white"
          ? "bg-white shadow-[0_8px_24px_oklch(1_0_0_/_0.25)]"
          : "bg-[radial-gradient(circle_at_30%_28%,oklch(0.627_0.233_303.9),oklch(0.606_0.219_292.72)_50%,oklch(0.432_0.211_292.76))] shadow-glow",
      ].join(" ")}
    />
  );
}

export function Chip({
  selected,
  children,
  onClick,
}: {
  selected?: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.97 }}
      onClick={onClick}
      className={[
        "rounded-full border px-3.5 py-2 text-[12px] font-medium tracking-[-0.01em] transition-colors",
        selected
          ? "border-brand bg-brand text-white"
          : "border-line bg-surface-raised text-ink-secondary",
      ].join(" ")}
    >
      {children}
    </motion.button>
  );
}

export function Checkbox({
  checked,
  error,
  onChange,
  children,
}: {
  checked: boolean;
  error?: boolean;
  onChange: (next: boolean) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex items-start gap-3 text-left"
    >
      <span
        className={[
          "mt-0.5 grid size-5 shrink-0 place-items-center rounded-[6px] border text-[11px] transition-colors",
          error
            ? "border-danger bg-[oklch(0.654_0.232_28.66_/_0.08)]"
            : checked
              ? "border-brand bg-brand text-white"
              : "border-line-strong bg-surface-raised",
        ].join(" ")}
      >
        {checked ? "✓" : ""}
      </span>
      <span
        className={[
          "text-[13px] leading-snug",
          error ? "text-danger" : "text-ink-secondary",
        ].join(" ")}
      >
        {children}
      </span>
    </button>
  );
}

export function BackButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.button
      type="button"
      aria-label="Back"
      whileTap={{ scale: 0.96 }}
      onClick={onClick}
      className="grid size-[44px] place-items-center rounded-full bg-surface-raised text-ink shadow-soft border border-line"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M15 18l-6-6 6-6"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </motion.button>
  );
}

export function HomeIndicator({ dark }: { dark?: boolean }) {
  return (
    <div
      className="flex justify-center pb-2 pt-1"
      aria-hidden
      data-home-indicator=""
    >
      <div
        className={[
          "h-[5px] w-[134px] rounded-full",
          dark ? "bg-white/35" : "bg-ink/15",
        ].join(" ")}
      />
    </div>
  );
}

import type { ComponentPropsWithoutRef } from "react";

type Props = ComponentPropsWithoutRef<"svg"> & {
  /**
   * Size utility classes, e.g. "h-8 w-8".
   */
  className?: string;
};

/**
 * SmartSeen mark – built from the fused rounded bars and lime band.
 * Based on the SmartSeen logo suite (on black/app icon variant).
 */
export function SmartSeenMark({ className, ...rest }: Props) {
  return (
    <svg
      viewBox="0 0 80 80"
      aria-hidden="true"
      className={className}
      {...rest}
    >
      <rect width="80" height="80" rx="18" fill="#0a0a0a" />
      <rect x="10" y="9" width="44" height="18" rx="9" fill="#ffffff" />
      <rect x="24" y="53" width="44" height="18" rx="9" fill="#ffffff" />
      <rect x="15" y="9" width="34" height="22" rx="7" fill="#0a0a0a" />
      <rect x="9" y="49" width="34" height="22" rx="7" fill="#0a0a0a" />
      <rect x="7" y="31" width="64" height="18" rx="9" fill="#c8f135" />
    </svg>
  );
}


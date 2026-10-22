import type { CSSProperties } from "react";

// The reduced-motion rule travels with the component. app/globals.css calms CSS
// animation globally, but the registry bundles imports only, so an installed
// copy never receives that reset.
//
// `!important` because the sweep is an inline style, which outranks a plain rule
// in a media query. It selects a marker class carried by TEXT_SHIMMER_CLASS_NAME
// so it also reaches consumers that build their own span out of these exports.
export const TEXT_SHIMMER_KEYFRAMES =
  "@keyframes beui-text-shimmer{from{background-position:200% 0}to{background-position:-200% 0}}" +
  "@media (prefers-reduced-motion: reduce){.beui-text-shimmer{animation:none !important}}";

// The gradient lives in an inline style rather than arbitrary-value utility
// classes: tailwind-merge historically drops one of two `bg-[…]` arbitrary
// classes applied to the same element, which left the text fully transparent.
export const TEXT_SHIMMER_CLASS_NAME =
  "beui-text-shimmer bg-clip-text text-transparent";

export function textShimmerStyle(duration: number): CSSProperties {
  // This app defines shadcn tokens as raw HSL triplets (Tailwind v3 style), so
  // the vars must be wrapped in hsl() here — beUI's upstream assumes full-color
  // tokens and consumes var(--foreground) directly, which resolves to nothing.
  return {
    animation: `beui-text-shimmer ${duration}s linear infinite`,
    backgroundImage:
      "linear-gradient(110deg, hsl(var(--muted-foreground)) 30%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 70%)",
    backgroundSize: "200% 100%",
  };
}

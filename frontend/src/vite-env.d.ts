/// <reference types="vite/client" />

// The vendored beUI components (src/components/motion, src/components/agents)
// use the `inert` attribute, which React 18.3 supports at runtime but the
// React 18 typings (written before the attribute shipped) do not declare.
declare module "react" {
  interface HTMLAttributes<T> {
    inert?: boolean | undefined;
  }
}

// Needed so this file is a module — otherwise the declare block above would
// shadow (not augment) the real react typings.
export {};

/// <reference types="vite/client" />

// The vendored beUI components (src/components/motion, src/components/agents)
// use the `inert` attribute, which the React 18 typings (written before the
// attribute shipped) do not declare. React 18 only writes the attribute for
// string values — call sites use `inert={cond ? "" : undefined}` because
// boolean `true`/`false` are dropped from the DOM with a console warning.
declare module "react" {
  interface HTMLAttributes<T> {
    inert?: boolean | "" | undefined;
  }
}

// Needed so this file is a module — otherwise the declare block above would
// shadow (not augment) the real react typings.
export {};

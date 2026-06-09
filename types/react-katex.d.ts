declare module "react-katex" {
  import type { ComponentType, HTMLAttributes } from "react";

  export interface KaTeXProps extends HTMLAttributes<HTMLElement> {
    math: string;
    errorColor?: string;
    throwOnError?: boolean;
    trust?: boolean;
    macros?: Record<string, string>;
  }

  export const InlineMath: ComponentType<KaTeXProps>;
  export const BlockMath: ComponentType<KaTeXProps>;
}

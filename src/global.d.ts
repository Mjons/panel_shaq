import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "haus-switcher": DetailedHTMLProps<
        HTMLAttributes<HTMLElement> & { current?: string },
        HTMLElement
      >;
    }
  }
}

export {};

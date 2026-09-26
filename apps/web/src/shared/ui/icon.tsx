import type { ReactNode, SVGProps } from 'react';

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, 'children'> {
  /** Pixel size; 20 by default, 16 in dense rows (doc 07 §5). */
  size?: number;
}

export type Icon = ((props: IconProps) => ReactNode) & { displayName: string };

export function createIcon(displayName: string, shapes: ReactNode): Icon {
  const Component = ({ size = 20, ...props }: IconProps) => (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={size}
      height={size}
      fill="currentColor"
      focusable="false"
      {...props}
    >
      {shapes}
    </svg>
  );
  Component.displayName = displayName;
  return Component;
}

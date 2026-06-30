import type { SVGProps } from "react";

// Iconos de línea minimalistas (stroke = currentColor). Sin emojis.
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={20}
      height={20}
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const ShieldCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" />
    <path d="M9 12l2 2 4-4" />
  </Icon>
);

export const Sun = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" />
  </Icon>
);

export const Moon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M21 12.8A8.5 8.5 0 1111.2 3a6.5 6.5 0 009.8 9.8z" />
  </Icon>
);

export const Upload = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 16V4M8 8l4-4 4 4" />
    <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
  </Icon>
);

export const FileDoc = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </Icon>
);

export const Check = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 12l4.5 4.5L19 7" />
  </Icon>
);

export const X = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Icon>
);

export const Alert = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 3l9 16H3l9-16z" />
    <path d="M12 9v5M12 17h.01" />
  </Icon>
);

export const Ban = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M5.6 5.6l12.8 12.8" />
  </Icon>
);

export const Help = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5a2.5 2.5 0 014.5 1.5c0 1.5-2 2-2 3" />
    <path d="M12 17h.01" />
  </Icon>
);

export const Printer = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 9V3h12v6" />
    <path d="M6 18H4a2 2 0 01-2-2v-4a2 2 0 012-2h16a2 2 0 012 2v4a2 2 0 01-2 2h-2" />
    <path d="M6 14h12v7H6z" />
  </Icon>
);

export const Plus = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M12 5v14M5 12h14" />
  </Icon>
);

export const ArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M5 12h14M13 6l6 6-6 6" />
  </Icon>
);

export const ArrowLeft = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M19 12H5M11 6l-6 6 6 6" />
  </Icon>
);

export const ChevronDown = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 9l6 6 6-6" />
  </Icon>
);

export const User = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21c0-4 3.5-6 8-6s8 2 8 6" />
  </Icon>
);

export const Building = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 21V5a2 2 0 012-2h7a2 2 0 012 2v16" />
    <path d="M15 9h3a2 2 0 012 2v10" />
    <path d="M8 7h3M8 11h3M8 15h3M3 21h18" />
  </Icon>
);

export const Lock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 018 0v3" />
  </Icon>
);

export const Crop = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M6 2v14h14" />
    <path d="M18 22V8H4" />
  </Icon>
);

export const Target = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="12" cy="12" r="8" />
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
  </Icon>
);

export const ChevronLeft = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M15 18l-6-6 6-6" />
  </Icon>
);

export const ChevronRight = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M9 18l6-6-6-6" />
  </Icon>
);

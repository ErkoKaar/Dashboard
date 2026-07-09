import { SVGProps } from "react";

export function Basketball(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 2v20" />
      <path d="M2 12h20" />
      <path d="M4.9 4.9c3.5 3.5 3.5 10.7 0 14.2" />
      <path d="M19.1 4.9c-3.5 3.5-3.5 10.7 0 14.2" />
    </svg>
  );
}

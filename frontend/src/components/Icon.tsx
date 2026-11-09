import type { SVGProps } from "react";

// The line icons drawn for Parsimony (Claude Design): 24px grid, 1.6px stroke, round caps. They use currentColor.
const PATHS = {
  food_drink: ["M5 8h11v4.5A5.5 5.5 0 0 1 10.5 18h0A5.5 5.5 0 0 1 5 12.5V8z", "M16 9.5h1.5a2.5 2.5 0 0 1 0 5H16", "M8 3.5v2M11 3.5v2", "M4 21h13"],
  groceries: ["M3.5 9h17l-1.7 9.3a2 2 0 0 1-2 1.7H7.2a2 2 0 0 1-2-1.7L3.5 9z", "M8 9l3-5M16 9l-3-5", "M9 13v3.5M12 13v3.5M15 13v3.5"],
  transport: ["M8 3.5h8a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-8a3 3 0 0 1 3-3z", "M5 11h14", "M8 17.5V20M16 17.5V20", "M8.5 14.3h.01M15.5 14.3h.01"],
  shopping: ["M5.5 8h13l-1 12.5h-11L5.5 8z", "M9 10V6.5a3 3 0 0 1 6 0V10"],
  bills: ["M6 3h12v18l-2-1.4-2 1.4-2-1.4-2 1.4-2-1.4L6 21V3z", "M9 8h6M9 11.5h6M9 15h3.5"],
  health: ["M12 20s-7.5-4.3-7.5-10.2A4.1 4.1 0 0 1 12 7.3a4.1 4.1 0 0 1 7.5 2.5C19.5 15.7 12 20 12 20z", "M7.5 12h2.2l1.2-2.2 2.2 4 1.1-1.8h2.3"],
  entertainment: ["M3.5 7h17v3a2 2 0 0 0 0 4v3h-17v-3a2 2 0 0 0 0-4V7z", "M14.5 7.5v1.5M14.5 11.2v1.6M14.5 15v1.5"],
  travel: ["M6.5 7.5h11a2.5 2.5 0 0 1 2.5 2.5v7a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17v-7a2.5 2.5 0 0 1 2.5-2.5z", "M9 7.5V5.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2", "M8 7.5v12M16 7.5v12"],
  other: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M8.3 12h.01M12 12h.01M15.7 12h.01"],
  send: ["M12 19V5", "M6 11l6-6 6 6"],
  mic: ["M12 3.5a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0v-5a3 3 0 0 1 3-3z", "M5.5 11a6.5 6.5 0 0 0 13 0", "M12 17.5V21"],
  camera: ["M4 8.5a2 2 0 0 1 2-2h2l1.5-2h5L16 6.5h2a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8.5z", "M12 9.5a3.5 3.5 0 1 1 0 7 3.5 3.5 0 0 1 0-7z"],
  keyboard: ["M5.5 6h13A2.5 2.5 0 0 1 21 8.5v7a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 15.5v-7A2.5 2.5 0 0 1 5.5 6z", "M7 10h.01M10.5 10h.01M14 10h.01M17.5 10h.01M8 14h8"],
  "chev-left": ["M14.5 6l-6 6 6 6"],
  "chev-right": ["M9.5 6l6 6-6 6"],
  "chev-down": ["M6 9.5l6 6 6-6"],
  check: ["M5 12.5l4.5 4.5L19 7.5"],
  alert: ["M12 4l9 16H3L12 4z", "M12 10v4.5M12 17.3v.01"],
  info: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M12 11v5M12 8v.01"],
  x: ["M6 6l12 12M18 6L6 18"],
  edit: ["M4.5 19.5l1-4L15.8 5.2a2 2 0 0 1 2.9 0l.1.1a2 2 0 0 1 0 2.9L8.5 18.5l-4 1z", "M14 7l3 3"],
  globe: ["M12 3.5a8.5 8.5 0 1 1 0 17 8.5 8.5 0 0 1 0-17z", "M3.5 12h17", "M12 3.5c2.3 2.3 3.5 5.2 3.5 8.5s-1.2 6.2-3.5 8.5c-2.3-2.3-3.5-5.2-3.5-8.5s1.2-6.2 3.5-8.5z"],
  user: ["M12 4.5a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "M4.5 20.5c.8-3.9 3.8-6 7.5-6s6.7 2.1 7.5 6"],
  sun: ["M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8z", "M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"],
  moon: ["M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"],
  "arrow-left": ["M19 12H5M11 6l-6 6 6 6"],
  logout: ["M14 4.5h3.5a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H14", "M10 16l-4-4 4-4M6 12h9"],
  trash: ["M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5", "M10 11v5M14 11v5"],
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20, ...rest }: { name: IconName; size?: number } & Omit<SVGProps<SVGSVGElement>, "name">) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6}
      strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false" style={{ flex: "none", display: "block" }} {...rest}
    >
      {PATHS[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

export const isCategoryIcon = (name: string): name is IconName =>
  ["food_drink", "groceries", "transport", "shopping", "bills", "health", "entertainment", "travel", "other"].includes(name);

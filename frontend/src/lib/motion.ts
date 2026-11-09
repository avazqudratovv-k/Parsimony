import { useMediaQuery } from "@mui/material";
import { useEffect, useRef, useState } from "react";

/** True when the person asked their system for less motion. Every animation here checks it. */
export const useReducedMotion = () => useMediaQuery("(prefers-reduced-motion: reduce)");

/** Rolls a number to its new value (360 ms, ease-out). The first value is shown as it is; no animation without motion. */
export function useRolling(target: number, ms = 360): number {
  const reduced = useReducedMotion();
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    if (reduced || from.current === target) { from.current = target; setShown(target); return; }
    const start = performance.now();
    const origin = from.current;
    let frame = 0;
    const tick = (now: number) => {
      const k = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - k, 3);
      const value = origin + (target - origin) * eased;
      from.current = value;
      setShown(value);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, reduced, ms]);
  return shown;
}

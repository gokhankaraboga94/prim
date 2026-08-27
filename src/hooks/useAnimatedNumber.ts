import { useEffect, useRef, useState } from "react";

export function useAnimatedNumber(value: number, speed = 0.14) {
  const [display, setDisplay] = useState(value);
  const current = useRef(value);
  const target = useRef(value);

  useEffect(() => {
    target.current = value;
    let raf = 0;
    const tick = () => {
      const next = current.current + (target.current - current.current) * speed;
      if (Math.abs(target.current - next) < 0.5) {
        current.current = target.current;
        setDisplay(target.current);
        return;
      }
      current.current = next;
      setDisplay(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, speed]);

  return Math.round(display);
}

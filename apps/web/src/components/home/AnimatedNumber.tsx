import { useEffect, useState } from "react";

interface AnimatedNumberProps {
  value: number;
  suffix?: string;
}

export function AnimatedNumber({ value, suffix = "" }: AnimatedNumberProps) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1500;
    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 4);
      setCurrent(Math.floor(ease * value));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span>
      {current}
      {suffix}
    </span>
  );
}

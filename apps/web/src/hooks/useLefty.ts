import { useEffect, useState } from "react";

const KEY = "ns-lefty";

export function useLefty() {
  const [isLefty, setIsLefty] = useState(() =>
    typeof localStorage !== "undefined" ? localStorage.getItem(KEY) === "1" : false
  );

  useEffect(() => {
    document.documentElement.classList.toggle("lefty", isLefty);
    localStorage.setItem(KEY, isLefty ? "1" : "0");
  }, [isLefty]);

  return { isLefty, setIsLefty };
}

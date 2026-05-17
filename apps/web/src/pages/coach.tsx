import { useEffect } from "react";
import { useLocation } from "wouter";
import { useWendy } from "@/contexts/WendyProvider";

export default function Coach() {
  const wendy = useWendy();
  const [, setLocation] = useLocation();

  useEffect(() => {
    wendy.open();
    setLocation("/");
  }, []);

  return null;
}

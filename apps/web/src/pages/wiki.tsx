import { useEffect } from "react";
import { useLocation, useParams } from "wouter";
import { useWendy } from "@/contexts/WendyProvider";

export default function Wiki() {
  const wendy = useWendy();
  const [, setLocation] = useLocation();
  const params = useParams();

  useEffect(() => {
    wendy.open();
    setLocation("/");
  }, []);

  return null;
}

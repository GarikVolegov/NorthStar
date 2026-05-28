import { useEffect } from "react";
import { useLocation } from "wouter";

export default function SocialPage() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/social/feed", { replace: true });
  }, [navigate]);

  return null;
}

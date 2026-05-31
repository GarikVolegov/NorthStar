import { Redirect } from "wouter";

export default function Abbonamento() {
  const query = typeof window !== "undefined" ? window.location.search : "";
  return <Redirect to={`/premium${query}`} />;
}

import { Redirect } from "wouter";

export default function Login() {
  const query = typeof window !== "undefined" ? window.location.search : "";
  return <Redirect to={`/sign-in${query}`} />;
}

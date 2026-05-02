import { Link } from "wouter";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center mx-auto px-4 md:px-6">
        <div className="mr-4 flex">
          <Link href="/" className="mr-6 flex items-center space-x-2">
            <Compass className="h-6 w-6 text-primary" />
            <span className="font-serif font-bold text-xl hidden sm:inline-block tracking-tight text-primary">
              Orientamento
            </span>
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <nav className="flex items-center space-x-2">
            <Link href="/test" className="text-sm font-medium transition-colors hover:text-primary">
              Il Test
            </Link>
            <Link href="/premium" className="text-sm font-medium transition-colors hover:text-primary">
              Premium
            </Link>
          </nav>
          <Button asChild size="sm" className="rounded-full font-medium">
            <Link href="/test">Inizia il percorso</Link>
          </Button>
        </div>
      </div>
    </header>
  );
}

import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Star, LogOut, User, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";

export function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [, setLocation] = useLocation();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center mx-auto px-4 md:px-6">
          <div className="mr-4 flex">
            <Link href="/" className="mr-6 flex items-center space-x-2">
              <Star className="h-5 w-5 text-primary fill-primary" />
              <span className="font-serif font-bold text-xl hidden sm:inline-block tracking-tight text-primary">
                NorthStar
              </span>
            </Link>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-4">
            <nav className="flex items-center space-x-2">
              <Link href="/test" className="text-sm font-medium transition-colors hover:text-primary">
                Il Test
              </Link>
              <Link href="/settori" className="text-sm font-medium transition-colors hover:text-primary hidden md:inline">
                Settori
              </Link>
              <Link href="/crescita" className="text-sm font-medium transition-colors hover:text-primary hidden md:inline">
                Crescita
              </Link>
              <Link href="/news" className="text-sm font-medium transition-colors hover:text-primary">
                News
              </Link>
              <Link href="/premium" className="text-sm font-medium transition-colors hover:text-primary">
                Premium
              </Link>
            </nav>

            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                    <User className="h-4 w-4 text-primary" />
                    <span className="hidden sm:inline max-w-[100px] truncate">{user.name}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col">
                      <span className="font-semibold text-sm">{user.name}</span>
                      <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                    </div>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setLocation("/profilo")} className="cursor-pointer">
                    <LayoutDashboard className="h-4 w-4 mr-2" />
                    Il mio profilo
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" />
                    Esci
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full font-medium text-sm"
                  onClick={() => setLoginOpen(true)}
                >
                  Accedi
                </Button>
                <Button asChild size="sm" className="rounded-full font-medium">
                  <Link href="/test">Inizia il percorso</Link>
                </Button>
              </div>
            )}
          </div>
        </div>
      </header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

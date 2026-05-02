import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Star, LogOut, User, LayoutDashboard, Menu, X,
  FlaskConical, Layers, BookOpenText, Newspaper, Crown, Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";

const NAV_LINKS = [
  { href: "/test",     label: "Il Test",  icon: FlaskConical },
  { href: "/settori",  label: "Settori",  icon: Layers },
  { href: "/crescita", label: "Crescita", icon: BookOpenText },
  { href: "/news",     label: "News",     icon: Newspaper },
  { href: "/premium",  label: "Premium",  icon: Crown },
];

export function Navbar() {
  const { user, logout, isLoggedIn } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [location] = useLocation();

  return (
    <>
      <header className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 md:h-16 items-center mx-auto px-4 md:px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 mr-auto">
            <Star className="h-5 w-5 text-primary fill-primary" />
            <span className="font-serif font-bold text-lg tracking-tight text-primary">
              NorthStar
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {NAV_LINKS.map(({ href, label }) => (
              <Link
                key={href}
                href={href}
                className={`text-sm font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap ${
                  location === href
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn && user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors">
                    <User className="h-4 w-4 text-primary" />
                    <span className="max-w-[100px] truncate">{user.name}</span>
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
                    <LayoutDashboard className="h-4 w-4 mr-2" /> Il mio profilo
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setLocation("/candidature")} className="cursor-pointer">
                    <Briefcase className="h-4 w-4 mr-2" /> Candidature
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                    <LogOut className="h-4 w-4 mr-2" /> Esci
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button variant="ghost" size="sm" className="rounded-full font-medium" onClick={() => setLoginOpen(true)}>
                  Accedi
                </Button>
                <Button asChild size="sm" className="rounded-full font-medium">
                  <Link href="/test">Inizia il percorso</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile right: user avatar or login + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {isLoggedIn && user ? (
              <button
                onClick={() => setLocation("/profilo")}
                className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card hover:bg-accent transition-colors"
              >
                <User className="h-4 w-4 text-primary" />
              </button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full font-medium text-sm h-8 px-3"
                onClick={() => setLoginOpen(true)}
              >
                Accedi
              </Button>
            )}

            {/* Hamburger */}
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors">
                  <Menu className="h-5 w-5 text-foreground" />
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b">
                  <Link href="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary fill-primary" />
                    <span className="font-serif font-bold text-lg text-primary">NorthStar</span>
                  </Link>
                  <button onClick={() => setMenuOpen(false)} className="p-1 rounded-lg hover:bg-muted transition-colors">
                    <X className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>

                {/* Nav links */}
                <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
                  {NAV_LINKS.map(({ href, label, icon: Icon }) => (
                    <Link
                      key={href}
                      href={href}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                        location === href
                          ? "bg-primary/10 text-primary"
                          : "text-foreground hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-primary/70" />
                      {label}
                    </Link>
                  ))}
                </nav>

                {/* Bottom actions */}
                <div className="px-5 pb-8 pt-4 border-t space-y-3">
                  {isLoggedIn && user ? (
                    <>
                      <div className="flex items-center gap-3 px-1 mb-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{user.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        className="w-full rounded-full justify-start gap-2"
                        onClick={() => { setLocation("/profilo"); setMenuOpen(false); }}
                      >
                        <LayoutDashboard className="h-4 w-4" /> Il mio profilo
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-full justify-start gap-2"
                        onClick={() => { setLocation("/candidature"); setMenuOpen(false); }}
                      >
                        <Briefcase className="h-4 w-4" /> Candidature
                      </Button>
                      <Button
                        variant="ghost"
                        className="w-full rounded-full justify-start gap-2 text-destructive hover:text-destructive"
                        onClick={() => { logout(); setMenuOpen(false); }}
                      >
                        <LogOut className="h-4 w-4" /> Esci
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        className="w-full rounded-full"
                        onClick={() => { setMenuOpen(false); setTimeout(() => setLoginOpen(true), 150); }}
                      >
                        Inizia il Test Gratuito
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-full"
                        onClick={() => { setMenuOpen(false); setTimeout(() => setLoginOpen(true), 150); }}
                      >
                        Accedi
                      </Button>
                    </>
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

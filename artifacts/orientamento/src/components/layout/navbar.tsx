import { useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, LogOut, User, LayoutDashboard, Menu, X,
  FlaskConical, Layers, BookOpenText, Newspaper, Crown, Briefcase, Users, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { LoginDialog } from "@/components/auth/LoginDialog";
import { useAuth } from "@/contexts/AuthContext";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useReducedMotion } from "@/lib/motion";

const BASE = import.meta.env.BASE_URL || "/";

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
  const [pendingFriends, setPendingFriends] = useState<number | null>(null);
  const prefersReduced = useReducedMotion();

  useState(() => {
    if (!user?.id) return;
    fetch(`${BASE}api/friends/${user.id}`)
      .then((res) => res.json())
      .then((data) => setPendingFriends(Array.isArray(data.incoming) ? data.incoming.length : 0))
      .catch(() => setPendingFriends(0));
  });

  const friendsBadge = pendingFriends && pendingFriends > 0 ? pendingFriends : null;

  return (
    <>
      <motion.header
        className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60"
        initial={prefersReduced ? {} : { y: -64, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="container flex h-14 md:h-16 items-center mx-auto px-4 md:px-6">

          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0 mr-auto">
            <motion.div
              whileHover={prefersReduced ? {} : { rotate: 20, scale: 1.1 }}
              transition={{ type: "spring", stiffness: 400, damping: 20 }}
            >
              <Star className="h-5 w-5 text-primary fill-primary" />
            </motion.div>
            <span className="font-serif font-bold text-lg tracking-tight text-primary">
              NorthStar
            </span>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 mx-4">
            {NAV_LINKS.map(({ href, label }) => {
              const isActive = location === href;
              return (
                <Link
                  key={href}
                  href={href}
                  className="relative text-sm font-medium px-3 py-1.5 rounded-full transition-colors whitespace-nowrap"
                  style={{ color: isActive ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}
                >
                  {isActive && !prefersReduced && (
                    <motion.span
                      layoutId="nav-active-indicator"
                      className="absolute inset-0 rounded-full bg-primary/10"
                      transition={{ type: "spring", stiffness: 380, damping: 30 }}
                    />
                  )}
                  {isActive && prefersReduced && (
                    <span className="absolute inset-0 rounded-full bg-primary/10" />
                  )}
                  <span className="relative z-10">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Desktop right actions */}
          <div className="hidden md:flex items-center gap-2">
            {isLoggedIn && user ? (
              <>
                <NotificationBell userId={user.id} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <motion.button
                      className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm font-medium hover:bg-accent transition-colors"
                      whileHover={prefersReduced ? {} : { scale: 1.02 }}
                      whileTap={prefersReduced ? {} : { scale: 0.98 }}
                    >
                      <User className="h-4 w-4 text-primary" />
                      <span className="max-w-[100px] truncate">{user.name}</span>
                    </motion.button>
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
                    <DropdownMenuItem onClick={() => setLocation("/calendario")} className="cursor-pointer">
                      <Calendar className="h-4 w-4 mr-2" /> Calendario
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/amici")} className="cursor-pointer">
                      <Users className="h-4 w-4 mr-2" /> Amici
                      {friendsBadge ? <span className="ml-auto text-xs font-semibold text-primary">{friendsBadge}</span> : null}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive cursor-pointer">
                      <LogOut className="h-4 w-4 mr-2" /> Esci
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
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

          {/* Mobile right: notification + user avatar or login + hamburger */}
          <div className="flex md:hidden items-center gap-2">
            {isLoggedIn && user ? (
              <>
                <NotificationBell userId={user.id} />
                <motion.button
                  onClick={() => setLocation("/profilo")}
                  className="flex items-center justify-center w-8 h-8 rounded-full border border-border bg-card hover:bg-accent transition-colors"
                  whileHover={prefersReduced ? {} : { scale: 1.05 }}
                  whileTap={prefersReduced ? {} : { scale: 0.95 }}
                >
                  <User className="h-4 w-4 text-primary" />
                </motion.button>
              </>
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
                <motion.button
                  className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-muted transition-colors"
                  whileTap={prefersReduced ? {} : { scale: 0.9 }}
                >
                  <AnimatePresence mode="wait" initial={false}>
                    {menuOpen ? (
                      <motion.span
                        key="close"
                        initial={prefersReduced ? {} : { rotate: -90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={prefersReduced ? {} : { rotate: 90, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <X className="h-5 w-5 text-foreground" />
                      </motion.span>
                    ) : (
                      <motion.span
                        key="menu"
                        initial={prefersReduced ? {} : { rotate: 90, opacity: 0 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        exit={prefersReduced ? {} : { rotate: -90, opacity: 0 }}
                        transition={{ duration: 0.18 }}
                      >
                        <Menu className="h-5 w-5 text-foreground" />
                      </motion.span>
                    )}
                  </AnimatePresence>
                </motion.button>
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
                  {NAV_LINKS.map(({ href, label, icon: Icon }, i) => {
                    const isActive = location === href;
                    return (
                      <motion.div
                        key={href}
                        initial={prefersReduced ? {} : { opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <Link
                          href={href}
                          onClick={() => setMenuOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
                            isActive
                              ? "bg-primary/10 text-primary"
                              : "text-foreground hover:bg-muted"
                          }`}
                        >
                          <Icon className="h-4 w-4 shrink-0 text-primary/70" />
                          {label}
                        </Link>
                      </motion.div>
                    );
                  })}
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
                        variant="outline"
                        className="w-full rounded-full justify-start gap-2"
                        onClick={() => { setLocation("/calendario"); setMenuOpen(false); }}
                      >
                        <Calendar className="h-4 w-4" /> Calendario
                      </Button>
                      <Button
                        variant="outline"
                        className="w-full rounded-full justify-start gap-2"
                        onClick={() => { setLocation("/amici"); setMenuOpen(false); }}
                      >
                        <Users className="h-4 w-4" /> Amici
                        {friendsBadge ? <span className="ml-auto text-xs font-semibold text-primary">{friendsBadge}</span> : null}
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
      </motion.header>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} />
    </>
  );
}

import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";
import { AnimatedBackdrop } from "@/components/layout/AnimatedBackdrop";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh" style={{ background: "#07090f" }}>
      {/* Ambient animated backdrop — fixed, z-0, behind all content */}
      <AnimatedBackdrop />
      {/* Top navbar (desktop only — mobile uses PillNavbar at bottom) */}
      <Navbar />
      <main className="flex-1 pt-12 md:pt-14 pb-20 md:pb-20">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      {/* PillNavbar: bottom-fixed pill (Wendy + news + profile on desktop, icon row on mobile) */}
      <MobileBottomNav />
    </div>
  );
}

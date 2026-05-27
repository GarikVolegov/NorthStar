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
      {/* Top phase-based icon nav */}
      <MobileBottomNav />
      <main className="flex-1 pt-12 md:pt-14 pb-16 md:pb-16">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      {/* Bottom pill nav: news ticker + Wendy search + profile dropdown */}
      <Navbar />
    </div>
  );
}

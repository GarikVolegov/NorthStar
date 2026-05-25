import type { ReactNode } from "react";
import { Footer } from "@/components/layout/footer";
import { MobileBottomNav } from "@/components/layout/MobileBottomNav";
import { Navbar } from "@/components/layout/Navbar";

export function MainLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <MobileBottomNav />
      <main className="flex-1 pt-12 md:pt-14 pb-16 md:pb-16">{children}</main>
      <div className="hidden md:block">
        <Footer />
      </div>
      <Navbar />
    </div>
  );
}

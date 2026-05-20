import { ExternalLink, User } from "lucide-react";
import { Link } from "wouter";

export function ProfileLinkSection() {
  return (
    <section className="py-8 bg-card">
      <div className="container mx-auto px-4 md:px-6 max-w-5xl">
        <Link href="/profilo">
          <div className="flex items-center justify-between p-5 rounded-2xl border bg-background hover:border-primary/30 hover:shadow-md transition-all duration-200 cursor-pointer group">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <User className="w-5 h-5" />
              </div>
              <div>
                <p className="font-semibold text-foreground group-hover:text-primary transition-colors">Il tuo profilo</p>
                <p className="text-sm text-muted-foreground">Impostazioni account, preferenze, CV e settori salvati</p>
              </div>
            </div>
            <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
          </div>
        </Link>
      </div>
    </section>
  );
}

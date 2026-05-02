import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Newspaper, ExternalLink, Clock, Tag, Lock, Sparkles, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL || "/";

interface NewsItem {
  id: string;
  title: string;
  description: string;
  source: string;
  url: string;
  publishedAt: string;
  image: string | null;
  category: string;
  sector: string | null;
  tags: string[];
  relevance: number;
  plan: "free" | "premium";
}

const CATEGORIES = [
  { id: "general", label: "Panoramica", emoji: "🌍" },
  { id: "technology", label: "Tecnologia", emoji: "💻" },
  { id: "business", label: "Business", emoji: "📈" },
  { id: "science", label: "Scienza", emoji: "🔬" },
  { id: "health", label: "Salute", emoji: "❤️" },
  { id: "finance", label: "Finanza", emoji: "💰" },
  { id: "education", label: "Formazione", emoji: "🎓" },
] as const;

const CATEGORY_LABELS: Record<string, string> = {
  general: "Panoramica",
  technology: "Tecnologia",
  business: "Business",
  science: "Scienza",
  health: "Salute",
  finance: "Finanza",
  education: "Formazione",
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const h = Math.floor(diff / 3600000);
  if (h < 1) return "meno di 1 ora fa";
  if (h === 1) return "1 ora fa";
  if (h < 24) return `${h} ore fa`;
  const d = Math.floor(h / 24);
  if (d === 1) return "ieri";
  return `${d} giorni fa`;
}

function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="bg-white border border-slate-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow group">
      {item.image && (
        <div className="aspect-video overflow-hidden">
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />
        </div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Badge variant="secondary" className="text-xs font-medium">
            {CATEGORY_LABELS[item.category] ?? item.category}
          </Badge>
          <span className="text-xs text-slate-400 flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {timeAgo(item.publishedAt)}
          </span>
        </div>
        <h3 className="font-serif font-semibold text-slate-800 leading-snug mb-2 line-clamp-3 text-[1.05rem]">
          {item.title}
        </h3>
        <p className="text-sm text-slate-500 leading-relaxed line-clamp-2 mb-4">
          {item.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-400 font-medium">{item.source}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
          >
            Leggi di più <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    </article>
  );
}

function NewsCardSkeleton() {
  return (
    <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden animate-pulse">
      <div className="h-44 bg-slate-100" />
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-20 bg-slate-100 rounded-full" />
          <div className="h-5 w-16 bg-slate-100 rounded-full" />
        </div>
        <div className="h-4 bg-slate-100 rounded w-full" />
        <div className="h-4 bg-slate-100 rounded w-4/5" />
        <div className="h-3 bg-slate-100 rounded w-3/5" />
      </div>
    </div>
  );
}

function PremiumNewsTeaser() {
  return (
    <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-8 text-center overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-amber-100/40 to-orange-100/40 backdrop-blur-sm" />
      <div className="relative z-10">
        <div className="inline-flex items-center justify-center w-12 h-12 bg-amber-100 rounded-2xl mb-4">
          <Lock className="h-5 w-5 text-amber-600" />
        </div>
        <h3 className="font-serif font-bold text-xl text-slate-800 mb-2">
          News per il tuo settore
        </h3>
        <p className="text-sm text-slate-600 mb-6 max-w-sm mx-auto leading-relaxed">
          Accedi a notizie specifiche per il settore che hai scelto: trend, opportunità, aziende
          che assumono, certificazioni e molto altro.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button asChild className="rounded-full font-medium">
            <Link href="/premium">
              <Sparkles className="h-4 w-4 mr-1.5" />
              Sblocca Premium
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full font-medium">
            <Link href="/test">Fai il test prima</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function News() {
  const [activeCategory, setActiveCategory] = useState<string>("general");

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["news", activeCategory],
    queryFn: async () => {
      const url = `${BASE}api/news?category=${activeCategory}&limit=6`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Errore nel caricamento delle news");
      return res.json() as Promise<{ news: NewsItem[]; source: "live" | "static" }>;
    },
    staleTime: 15 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-white border-b border-slate-100">
        <div className="container mx-auto px-4 md:px-6 py-12">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary rounded-full px-4 py-1.5 text-sm font-medium mb-4">
              <Newspaper className="h-4 w-4" />
              Aggiornamenti dal mondo del lavoro
            </div>
            <h1 className="font-serif font-bold text-4xl text-slate-900 mb-3">
              News & Tendenze
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed">
              Resta aggiornato sul mercato del lavoro, i settori emergenti e le opportunità di
              crescita professionale.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="flex gap-2 overflow-x-auto pb-2 mb-8 scrollbar-hide">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={`flex-none flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? "bg-primary text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-primary/40 hover:text-primary"
              }`}
            >
              <span>{cat.emoji}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {isError && (
          <div className="text-center py-12">
            <p className="text-slate-500 mb-4">Impossibile caricare le news al momento.</p>
            <Button variant="outline" onClick={() => refetch()} className="gap-2 rounded-full">
              <RefreshCw className="h-4 w-4" />
              Riprova
            </Button>
          </div>
        )}

        {!isError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
            {isLoading
              ? Array.from({ length: 6 }).map((_, i) => <NewsCardSkeleton key={i} />)
              : data?.news.map((item) => <NewsCard key={item.id} item={item} />)}
          </div>
        )}

        {!isLoading && data && (
          <div className="flex items-center justify-between mb-8">
            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <Tag className="h-3 w-3" />
              {data.source === "live"
                ? "Notizie aggiornate in tempo reale"
                : "Contenuto editoriale selezionato"}
            </p>
          </div>
        )}

        <div className="mb-4">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="h-5 w-5 text-amber-500" />
            <h2 className="font-serif font-bold text-xl text-slate-800">
              News Premium — per il tuo settore
            </h2>
            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">Premium</Badge>
          </div>
          <PremiumNewsTeaser />
        </div>
      </div>
    </div>
  );
}

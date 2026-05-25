import { ALL_TYPES, TYPE_META } from "@/components/knowledge-graph/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowLeft,
  ChevronDown,
  Loader2,
  MessageCircleQuestion,
  Network,
  Plus,
  Search,
  Upload,
  Wand2,
} from "lucide-react";
import { Link } from "wouter";
import type { NodeType } from "./knowledgeGraphTypes";

interface KnowledgeGraphToolbarProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: NodeType | "all";
  onTypeFilterChange: (value: NodeType | "all") => void;
  chatOpen: boolean;
  onToggleChat: () => void;
  autoLinkingAll: boolean;
  nodesCount: number;
  importing: boolean;
  onAutoLinkAll: () => void;
  onAddNode: (type?: NodeType) => void;
  onImportClick: () => void;
}

export function KnowledgeGraphToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  chatOpen,
  onToggleChat,
  autoLinkingAll,
  nodesCount,
  importing,
  onAutoLinkAll,
  onAddNode,
  onImportClick,
}: KnowledgeGraphToolbarProps) {
  return (
    <div className="flex items-center gap-2 px-4 md:px-6 py-3 border-b bg-card/80 backdrop-blur-sm overflow-x-auto">
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full h-8 w-8 shrink-0"
        asChild
      >
        <Link href="/">
          <ArrowLeft className="w-4 h-4" />
        </Link>
      </Button>
      <div className="flex items-center gap-2 mr-2 shrink-0">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Network className="w-3.5 h-3.5 text-primary" />
        </div>
        <h1 className="font-serif font-bold text-lg whitespace-nowrap">
          Il tuo Archivio
        </h1>
      </div>
      <div className="relative flex-1 min-w-35 max-w-55">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Cerca..."
          className="h-8 pl-8 text-sm rounded-xl"
        />
      </div>
      <select
        value={typeFilter}
        onChange={(e) => onTypeFilterChange(e.target.value as NodeType | "all")}
        className="h-8 rounded-xl border border-border bg-background px-2 text-xs shrink-0"
      >
        <option value="all">Tutti</option>
        {ALL_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_META[t].label}
          </option>
        ))}
      </select>
      <div className="ml-auto flex items-center gap-1.5 shrink-0">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant={chatOpen ? "default" : "outline"}
              className="rounded-xl h-8 w-8"
              onClick={onToggleChat}
            >
              <MessageCircleQuestion className="w-4 h-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Chiedi all'Archivio</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              className="rounded-xl h-8 gap-1"
              disabled={autoLinkingAll || nodesCount < 2}
              onClick={onAutoLinkAll}
            >
              {autoLinkingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              <span className="hidden lg:inline">Collega</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent>Collega automaticamente</TooltipContent>
        </Tooltip>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              size="sm"
              className="rounded-xl h-8 gap-1"
              disabled={importing}
            >
              {importing ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Plus className="w-3.5 h-3.5" />
              )}
              <span className="hidden sm:inline">Aggiungi</span>
              <ChevronDown className="w-3 h-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Crea elemento
            </DropdownMenuLabel>
            {ALL_TYPES.map((t) => {
              const m = TYPE_META[t];
              const Icon = m.Icon;
              return (
                <DropdownMenuItem
                  key={t}
                  onClick={() => onAddNode(t)}
                  className="gap-2 cursor-pointer"
                >
                  <span
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0"
                    style={{ backgroundColor: m.bg, color: m.color }}
                  >
                    <Icon className="w-3 h-3" />
                  </span>
                  {m.label}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={onImportClick}
              className="gap-2 cursor-pointer"
              disabled={importing}
            >
              <span className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-muted text-muted-foreground">
                <Upload className="w-3 h-3" />
              </span>
              {importing ? "Importando..." : "Importa file..."}
              <span className="ml-auto text-[10px] text-muted-foreground">
                PDF, MD, TXT
              </span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

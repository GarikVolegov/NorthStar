import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useCommunityActions } from "@/hooks/useCommunities";
import { Plus } from "lucide-react";
import { useState } from "react";

export function CreateCommunityDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [icon, setIcon] = useState("#");
  const [isPublic, setIsPublic] = useState(true);
  const { createCommunity } = useCommunityActions();

  function submit() {
    createCommunity.mutate(
      { name, description, icon, isPublic },
      {
        onSuccess: () => {
          setName("");
          setDescription("");
          setIcon("#");
          setIsPublic(true);
          setOpen(false);
        },
      },
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="min-h-10 rounded-xl gap-2">
          <Plus className="h-4 w-4" />
          Comunita
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Crea comunita</DialogTitle>
          <DialogDescription>Apri uno spazio condiviso con canale generale e messaggi non cifrati.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-[72px_1fr] gap-2">
            <Input value={icon} onChange={(event) => setIcon(event.target.value)} maxLength={8} className="min-h-11 rounded-xl text-center" aria-label="Icona comunita" />
            <Input value={name} onChange={(event) => setName(event.target.value)} className="min-h-11 rounded-xl" placeholder="Nome comunita" />
          </div>
          <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-24 rounded-xl" placeholder="Descrizione" />
          <label className="flex min-h-11 items-center justify-between rounded-xl border px-3 text-sm">
            Pubblica
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </label>
          <Button className="min-h-11 w-full rounded-xl" disabled={name.trim().length < 2 || createCommunity.isPending} onClick={submit}>
            Crea
          </Button>
          {createCommunity.error ? <p className="text-sm text-destructive">{createCommunity.error.message}</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

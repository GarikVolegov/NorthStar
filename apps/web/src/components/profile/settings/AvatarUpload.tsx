import { apiFetch } from "@/lib/api-fetch";
import { Camera, Loader2, Trash2 } from "lucide-react";
import { useRef, useState } from "react";

const BASE = import.meta.env.BASE_URL || "/";

export function AvatarUpload({ userId, name, currentUrl, onUploaded }: {
  userId: number;
  name: string;
  currentUrl?: string | null;
  onUploaded: (url: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) { setError("Max 2 MB"); return; }
    if (!file.type.startsWith("image/")) { setError("Solo immagini"); return; }

    setError(null);
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const res = await apiFetch(`${BASE}api/profile/${userId}/avatar`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarDataUrl: dataUrl }),
      });
      if (!res.ok) { const j = await res.json(); throw new Error(j.error ?? "Errore upload"); }
      const json = await res.json();
      onUploaded(json.avatarUrl);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Errore upload");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleRemove() {
    setUploading(true);
    try {
      await apiFetch(`${BASE}api/profile/${userId}/avatar`, {
        method: "DELETE",
      });
      onUploaded(null);
    } finally {
      setUploading(false);
    }
  }

  const initials = name.charAt(0).toUpperCase();

  return (
    <div className="flex flex-col items-start gap-2 mb-4">
      <div className="relative group">
        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="w-16 h-16 rounded-2xl overflow-hidden bg-primary/10 border border-primary/20 flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity"
        >
          {currentUrl ? (
            <img src={currentUrl} alt={name} className="w-full h-full object-cover" />
          ) : (
            <span className="text-2xl font-serif font-bold text-primary">{initials}</span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-2xl">
              <Loader2 className="w-5 h-5 animate-spin text-white" />
            </div>
          )}
        </div>

        <div
          onClick={() => !uploading && fileRef.current?.click()}
          className="absolute inset-0 rounded-2xl bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100"
        >
          <Camera className="w-5 h-5 text-white" />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => !uploading && fileRef.current?.click()}
          disabled={uploading}
          className="text-xs text-primary hover:underline font-medium disabled:opacity-50"
        >
          {currentUrl ? "Cambia foto" : "Carica foto"}
        </button>
        {currentUrl && (
          <>
            <span className="text-muted-foreground text-xs">·</span>
            <button
              onClick={handleRemove}
              disabled={uploading}
              className="text-xs text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50 flex items-center gap-0.5"
            >
              <Trash2 className="w-3 h-3" /> Rimuovi
            </button>
          </>
        )}
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}
      <p className="text-[11px] text-muted-foreground -mt-1">JPG, PNG, WebP · max 2 MB</p>

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        onChange={handleFile}
        aria-label="Carica foto profilo"
      />
    </div>
  );
}

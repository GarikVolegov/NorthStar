/**
 * ProfileLocationSection.tsx
 *
 * Sezione "Posizione" da inserire nella pagina impostazioni profilo.
 * Gestisce city + bio con salvataggio ottimistico via PATCH /api/users/me.
 *
 * Uso:
 *   import { ProfileLocationSection } from "@/components/network/ProfileLocationSection";
 *
 *   // Dentro la pagina profilo/impostazioni:
 *   <ProfileLocationSection
 *     city={profile.city}
 *     cityPlaceId={profile.cityPlaceId}
 *     bio={profile.bio}
 *     onSave={(patch) => patchProfile(patch)}
 *     loading={isPending}
 *   />
 */
import { useState, useEffect } from "react";
import { MapPin, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { CityAutocomplete } from "./CityAutocomplete";

interface ProfileLocationSectionProps {
  city?: string | null;
  cityPlaceId?: string | null;
  bio?: string | null;
  onSave: (patch: {
    city: string | null;
    cityPlaceId: string | null;
    bio: string | null;
  }) => Promise<void> | void;
  loading?: boolean;
}

const BIO_MAX = 300;

export function ProfileLocationSection({
  city: initialCity,
  cityPlaceId: initialPlaceId,
  bio: initialBio,
  onSave,
  loading = false,
}: ProfileLocationSectionProps) {
  const [city, setCity]             = useState(initialCity ?? "");
  const [cityPlaceId, setCityPlaceId] = useState(initialPlaceId ?? "");
  const [bio, setBio]               = useState(initialBio ?? "");
  const [saving, setSaving]         = useState(false);
  const [status, setStatus]         = useState<"idle" | "saved" | "error">("idle");
  const [dirty, setDirty]           = useState(false);

  // Resetta stato quando i valori iniziali cambiano (load profilo)
  useEffect(() => {
    setCity(initialCity ?? "");
    setCityPlaceId(initialPlaceId ?? "");
    setBio(initialBio ?? "");
    setDirty(false);
    setStatus("idle");
  }, [initialCity, initialPlaceId, initialBio]);

  function handleCityChange(
    result: { city: string; cityPlaceId: string; label: string } | null,
  ) {
    setCity(result?.label ?? "");
    setCityPlaceId(result?.cityPlaceId ?? "");
    setDirty(true);
    setStatus("idle");
  }

  function handleBioChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setBio(e.target.value.slice(0, BIO_MAX));
    setDirty(true);
    setStatus("idle");
  }

  async function handleSave() {
    setSaving(true);
    setStatus("idle");
    try {
      await onSave({
        city: city || null,
        cityPlaceId: cityPlaceId || null,
        bio: bio || null,
      });
      setDirty(false);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 3000);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  }

  const bioLen = bio.length;
  const bioNearLimit = bioLen > BIO_MAX * 0.85;

  return (
    <section className="profile-location-section" aria-labelledby="location-section-title">
      <header className="profile-location-section__header">
        <h3 id="location-section-title" className="profile-location-section__title">
          Posizione e presentazione
        </h3>
        <p className="profile-location-section__desc">
          Aiuta altri utenti a trovarti e capire chi sei.
        </p>
      </header>

      <div className="profile-location-section__fields">
        {/* ── Città ───────────────────────────────────────────────────── */}
        <div className="profile-location-section__field">
          <label
            htmlFor="city-autocomplete-input"
            className="profile-location-section__label"
          >
            <MapPin size={14} aria-hidden />
            Città
          </label>
          <CityAutocomplete
            value={city}
            onChange={handleCityChange}
            disabled={loading || saving}
            className="profile-location-section__city"
          />
          <p className="profile-location-section__hint">
            Usata per suggerire connessioni nella tua area geografica.
          </p>
        </div>

        {/* ── Bio ─────────────────────────────────────────────────────── */}
        <div className="profile-location-section__field">
          <label
            htmlFor="profile-bio"
            className="profile-location-section__label"
          >
            <FileText size={14} aria-hidden />
            Bio
          </label>
          <div className="profile-location-section__bio-wrap">
            <textarea
              id="profile-bio"
              value={bio}
              onChange={handleBioChange}
              disabled={loading || saving}
              placeholder="Descrivi brevemente chi sei, cosa fai o cosa stai cercando..."
              rows={3}
              maxLength={BIO_MAX}
              className="profile-location-section__bio"
              aria-describedby="bio-counter"
            />
            <span
              id="bio-counter"
              className={`profile-location-section__bio-counter${
                bioNearLimit ? " profile-location-section__bio-counter--warn" : ""
              }`}
            >
              {bioLen}/{BIO_MAX}
            </span>
          </div>
          <p className="profile-location-section__hint">
            Visibile nel tuo profilo pubblico e nelle card del network.
          </p>
        </div>
      </div>

      {/* ── Footer: salva + feedback ─────────────────────────────────── */}
      <footer className="profile-location-section__footer">
        {status === "saved" && (
          <span className="profile-location-section__feedback profile-location-section__feedback--ok">
            <CheckCircle2 size={14} aria-hidden />
            Salvato
          </span>
        )}
        {status === "error" && (
          <span className="profile-location-section__feedback profile-location-section__feedback--err">
            <AlertCircle size={14} aria-hidden />
            Errore nel salvataggio
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving || loading}
          className="profile-location-section__save-btn"
        >
          {saving ? "Salvataggio..." : "Salva posizione"}
        </button>
      </footer>

      <style>{`
        .profile-location-section {
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-6);
          display: flex;
          flex-direction: column;
          gap: var(--space-6);
        }

        .profile-location-section__header {
          display: flex;
          flex-direction: column;
          gap: var(--space-1);
        }

        .profile-location-section__title {
          font-size: var(--text-base);
          font-weight: 600;
          color: var(--color-text);
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .profile-location-section__desc {
          font-size: var(--text-sm);
          color: var(--color-text-muted);
        }

        .profile-location-section__fields {
          display: flex;
          flex-direction: column;
          gap: var(--space-5);
        }

        .profile-location-section__field {
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .profile-location-section__label {
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--color-text);
          display: flex;
          align-items: center;
          gap: var(--space-1);
        }

        .profile-location-section__hint {
          font-size: var(--text-xs);
          color: var(--color-text-faint);
        }

        .profile-location-section__bio-wrap {
          position: relative;
        }

        .profile-location-section__bio {
          width: 100%;
          padding: 10px 12px;
          padding-bottom: 24px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--color-text);
          resize: vertical;
          min-height: 80px;
          transition: border-color 180ms ease, box-shadow 180ms ease;
          outline: none;
          font-family: var(--font-body);
          line-height: 1.55;
        }

        .profile-location-section__bio:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
        }

        .profile-location-section__bio:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .profile-location-section__bio-counter {
          position: absolute;
          bottom: 8px;
          right: 10px;
          font-size: 11px;
          color: var(--color-text-faint);
          pointer-events: none;
          transition: color 150ms ease;
        }

        .profile-location-section__bio-counter--warn {
          color: var(--color-warning);
        }

        .profile-location-section__footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: var(--space-4);
        }

        .profile-location-section__feedback {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
        }

        .profile-location-section__feedback--ok  { color: var(--color-success); }
        .profile-location-section__feedback--err { color: var(--color-error); }

        .profile-location-section__save-btn {
          padding: 8px 18px;
          background: var(--color-primary);
          color: var(--color-text-inverse);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          font-weight: 500;
          cursor: pointer;
          transition: background 150ms ease, opacity 150ms ease;
        }

        .profile-location-section__save-btn:hover:not(:disabled) {
          background: var(--color-primary-hover);
        }

        .profile-location-section__save-btn:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }
      `}</style>
    </section>
  );
}

export default ProfileLocationSection;

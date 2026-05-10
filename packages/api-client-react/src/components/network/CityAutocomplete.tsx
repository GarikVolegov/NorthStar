/**
 * CityAutocomplete.tsx
 *
 * Input di ricerca città con autocomplete via /api/city/autocomplete (Nominatim).
 * Debounce 400ms per non spammare il server.
 *
 * Props:
 *   value       — città corrente (label completa, es. "Roma, Lazio, Italia")
 *   onChange    — callback con { city, cityPlaceId, label } quando l'utente sceglie
 *   placeholder — placeholder input (default: "Cerca città...")
 *   disabled    — disabilita l'input
 *
 * Uso:
 *   <CityAutocomplete
 *     value={profile.city ?? ""}
 *     onChange={({ city, cityPlaceId }) =>
 *       patchProfile({ city, cityPlaceId })
 *     }
 *   />
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { MapPin, X, Loader2, Search } from "lucide-react";

interface CityResult {
  placeId: string;
  label: string;
  city: string;
  country: string;
}

interface CityAutocompleteProps {
  value?: string;
  onChange: (result: { city: string; cityPlaceId: string; label: string } | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

export function CityAutocomplete({
  value = "",
  onChange,
  placeholder = "Cerca la tua città...",
  disabled = false,
  className = "",
}: CityAutocompleteProps) {
  const [inputValue, setInputValue] = useState(value);
  const [results, setResults]       = useState<CityResult[]>([]);
  const [loading, setLoading]       = useState(false);
  const [open, setOpen]             = useState(false);
  const [activeIdx, setActiveIdx]   = useState(-1);

  const debounceRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef     = useRef<HTMLInputElement>(null);

  // Aggiorna inputValue se value cambia dall'esterno (es. load profilo)
  useEffect(() => {
    setInputValue(value);
  }, [value]);

  // Chiudi dropdown click outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/city/autocomplete?q=${encodeURIComponent(q)}&lang=it`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Errore fetch");
      const data: CityResult[] = await res.json();
      setResults(data);
      setOpen(data.length > 0);
      setActiveIdx(-1);
    } catch {
      setResults([]);
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }, []);

  function handleInput(e: React.ChangeEvent<HTMLInputElement>) {
    const q = e.target.value;
    setInputValue(q);
    if (!q) {
      onChange(null);
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 400);
  }

  function handleSelect(result: CityResult) {
    setInputValue(result.label);
    setOpen(false);
    setResults([]);
    onChange({ city: result.city, cityPlaceId: result.placeId, label: result.label });
  }

  function handleClear() {
    setInputValue("");
    setResults([]);
    setOpen(false);
    onChange(null);
    inputRef.current?.focus();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(results[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className={`city-autocomplete ${className}`} style={{ position: "relative" }}>
      {/* Input wrapper */}
      <div className="city-autocomplete__input-wrap">
        <MapPin
          size={16}
          className="city-autocomplete__icon city-autocomplete__icon--left"
          aria-hidden
        />
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-autocomplete="list"
          aria-controls="city-autocomplete-listbox"
          value={inputValue}
          onChange={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => results.length > 0 && setOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          spellCheck={false}
          className="city-autocomplete__input"
        />
        {loading && (
          <Loader2
            size={16}
            className="city-autocomplete__icon city-autocomplete__icon--right city-autocomplete__spinner"
            aria-hidden
          />
        )}
        {!loading && inputValue && (
          <button
            type="button"
            onClick={handleClear}
            className="city-autocomplete__clear"
            aria-label="Rimuovi città"
          >
            <X size={14} />
          </button>
        )}
        {!loading && !inputValue && (
          <Search
            size={14}
            className="city-autocomplete__icon city-autocomplete__icon--right"
            aria-hidden
          />
        )}
      </div>

      {/* Dropdown */}
      {open && results.length > 0 && (
        <ul
          id="city-autocomplete-listbox"
          role="listbox"
          aria-label="Suggerimenti città"
          className="city-autocomplete__dropdown"
        >
          {results.map((r, i) => (
            <li
              key={r.placeId}
              role="option"
              aria-selected={i === activeIdx}
              className={`city-autocomplete__option${
                i === activeIdx ? " city-autocomplete__option--active" : ""
              }`}
              onMouseDown={(e) => e.preventDefault()} // evita blur prima del click
              onClick={() => handleSelect(r)}
            >
              <MapPin size={13} className="city-autocomplete__option-icon" aria-hidden />
              <span className="city-autocomplete__option-label">{r.label}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CSS-in-JS scoped (no dipendenze esterne) */}
      <style>{`
        .city-autocomplete { width: 100%; }

        .city-autocomplete__input-wrap {
          position: relative;
          display: flex;
          align-items: center;
        }

        .city-autocomplete__icon--left {
          position: absolute;
          left: 12px;
          color: var(--color-text-muted);
          pointer-events: none;
          flex-shrink: 0;
        }

        .city-autocomplete__icon--right {
          position: absolute;
          right: 10px;
          color: var(--color-text-faint);
          pointer-events: none;
        }

        .city-autocomplete__input {
          width: 100%;
          padding: 10px 36px 10px 36px;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          font-size: var(--text-sm);
          color: var(--color-text);
          transition: border-color 180ms ease, box-shadow 180ms ease;
          outline: none;
        }

        .city-autocomplete__input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px color-mix(in oklch, var(--color-primary) 18%, transparent);
        }

        .city-autocomplete__input:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .city-autocomplete__spinner {
          animation: city-spin 0.8s linear infinite;
        }
        @keyframes city-spin { to { transform: rotate(360deg); } }

        .city-autocomplete__clear {
          position: absolute;
          right: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px;
          border-radius: var(--radius-sm);
          color: var(--color-text-muted);
          cursor: pointer;
          transition: color 150ms ease, background 150ms ease;
        }
        .city-autocomplete__clear:hover {
          color: var(--color-text);
          background: var(--color-surface-offset);
        }

        .city-autocomplete__dropdown {
          position: absolute;
          top: calc(100% + 4px);
          left: 0;
          right: 0;
          z-index: 200;
          background: var(--color-surface);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-md);
          box-shadow: var(--shadow-md);
          list-style: none;
          margin: 0;
          padding: 4px;
          max-height: 260px;
          overflow-y: auto;
        }

        .city-autocomplete__option {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 9px 10px;
          border-radius: var(--radius-sm);
          cursor: pointer;
          transition: background 120ms ease;
        }
        .city-autocomplete__option:hover,
        .city-autocomplete__option--active {
          background: var(--color-surface-offset);
        }

        .city-autocomplete__option-icon {
          color: var(--color-primary);
          flex-shrink: 0;
        }

        .city-autocomplete__option-label {
          font-size: var(--text-sm);
          color: var(--color-text);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
      `}</style>
    </div>
  );
}

export default CityAutocomplete;

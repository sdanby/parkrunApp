import React, { useEffect, useRef, useState } from 'react';
import { API_BASE_URL } from '../api/backendAPI';

type Athlete = {
  athlete_code: string;
  name?: string;
  total_runs?: number;
  club?: string;
};

type Props = {
  onSelect?: (athleteCode: string) => void;
  placeholder?: string;
  inputId?: string;
};

const AthleteSearch: React.FC<Props> = ({ onSelect, placeholder, inputId }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Athlete[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(ev.target as Node)) {
        setOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (debounceRef.current) {
      window.clearTimeout(debounceRef.current);
    }
    debounceRef.current = window.setTimeout(async () => {
      try {
        const q = encodeURIComponent(query.trim());
        const url = `${API_BASE_URL}/api/athletes/search?q=${q}&limit=20`;
        const res = await fetch(url);
        if (!res.ok) throw new Error('Network');
        const json = await res.json();
        if (Array.isArray(json)) {
          setResults(json.slice(0, 20));
        } else {
          setResults([]);
        }
      } catch (err) {
        setResults([]);
      } finally {
        setLoading(false);
        setOpen(true);
        setHighlight(-1);
      }
    }, 200);

    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      if (highlight >= 0 && highlight < results.length) {
        const sel = results[highlight];
        choose(sel);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const choose = (ath: Athlete) => {
    setQuery(ath.name ? `${ath.name} (${ath.athlete_code})` : String(ath.athlete_code));
    setOpen(false);
    if (onSelect) onSelect(String(ath.athlete_code));
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', maxWidth: 640 }}>
      <input
        id={inputId}
        aria-label="Search athletes"
        placeholder={placeholder || 'Type athlete name or code...'}
        value={query}
        onChange={(e) => { setQuery(e.target.value); }}
        onFocus={() => { if (results.length) setOpen(true); }}
        onKeyDown={handleKeyDown}
        style={{ width: '154px', height: '20px', padding: '8px 6px', boxSizing: 'border-box' }}
      />
      {open && (results.length > 0 || loading) && (
        <div
          role="listbox"
          style={{
            position: 'absolute',
            zIndex: 60,
            left: 0,
            right: 0,
            marginTop: 4,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 4,
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            maxHeight: 320,
            overflow: 'auto'
          }}
        >
          {loading && <div style={{ padding: 8 }}>Loading...</div>}
          {!loading && results.map((r, idx) => (
            <div
              key={`${r.athlete_code}-${idx}`}
              role="option"
              aria-selected={highlight === idx}
              onMouseDown={(ev) => { ev.preventDefault(); }}
              onClick={() => choose(r)}
              onMouseEnter={() => setHighlight(idx)}
              style={{
                padding: '8px 10px',
                cursor: 'pointer',
                background: highlight === idx ? '#eef' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                gap: 8
              }}
            >
              <div style={{ fontSize: 14 }}>{r.name || `Athlete ${r.athlete_code}`}</div>
              <div style={{ color: '#666', fontSize: 13 }}>{r.athlete_code}{r.total_runs ? ` • ${r.total_runs}` : ''}</div>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div style={{ padding: 8, color: '#666' }}>No results</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AthleteSearch;

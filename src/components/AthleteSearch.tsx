import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { API_BASE_URL } from '../api/backendAPI';

type Athlete = {
  athlete_code: string;
  name?: string;
  total_runs?: number;
  club?: string;
  current_age_estimate?: string | number;
};

type Props = {
  onSelect?: (athleteCode: string) => void;
  placeholder?: string;
  inputId?: string;
  initialQuery?: string;
  suppressInitialSearch?: boolean;
};

const AthleteSearch: React.FC<Props> = ({ onSelect, placeholder, inputId, initialQuery, suppressInitialSearch = false }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Athlete[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [highlight, setHighlight] = useState<number>(-1);
  const [dropdownTop, setDropdownTop] = useState(0);
  const [dropdownLeft, setDropdownLeft] = useState(0);
  const [dropdownWidth, setDropdownWidth] = useState(0);
  const debounceRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const prefilledOnEntryRef = useRef(false);
  const suppressReopenRef = useRef(false);

  useEffect(() => {
    if (typeof initialQuery !== 'string') return;
    const trimmed = initialQuery.trim();
    if (!trimmed) return;
    if (query.trim() !== '') return;
    setQuery(initialQuery);
    prefilledOnEntryRef.current = true;
  }, [initialQuery]);

  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      const target = ev.target as Node;
      const clickedInsideInput = Boolean(containerRef.current && containerRef.current.contains(target));
      const clickedInsideDropdown = Boolean(dropdownRef.current && dropdownRef.current.contains(target));
      if (!clickedInsideInput && !clickedInsideDropdown) {
        setOpen(false);
      }
    };
    window.addEventListener('click', onClick);
    return () => window.removeEventListener('click', onClick);
  }, []);

  useEffect(() => {
    if (!open || query.trim().length === 0) return;

    const updateDropdownPosition = () => {
      if (!inputRef.current) return;
      const rect = inputRef.current.getBoundingClientRect();
      const viewportTopOffset = window.visualViewport ? window.visualViewport.offsetTop : 0;
      const viewportLeftOffset = window.visualViewport ? window.visualViewport.offsetLeft : 0;
      setDropdownTop(rect.bottom + 4 + viewportTopOffset);
      setDropdownLeft(rect.left + viewportLeftOffset);
      setDropdownWidth(Math.max(rect.width, 220) + 38);
    };

    updateDropdownPosition();
    window.addEventListener('resize', updateDropdownPosition);
    window.addEventListener('scroll', updateDropdownPosition, true);

    return () => {
      window.removeEventListener('resize', updateDropdownPosition);
      window.removeEventListener('scroll', updateDropdownPosition, true);
    };
  }, [open, query]);

  useEffect(() => {
    if (!query) {
      setResults([]);
      setLoading(false);
      return;
    }
    if (
      suppressInitialSearch &&
      prefilledOnEntryRef.current &&
      typeof initialQuery === 'string' &&
      query.trim() === initialQuery.trim()
    ) {
      setResults([]);
      setLoading(false);
      setOpen(false);
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
          const sorted = [...json].sort((a: Athlete, b: Athlete) => {
            const ageA = a.current_age_estimate === undefined || a.current_age_estimate === null || a.current_age_estimate === ''
              ? Number.POSITIVE_INFINITY
              : Number(a.current_age_estimate);
            const ageB = b.current_age_estimate === undefined || b.current_age_estimate === null || b.current_age_estimate === ''
              ? Number.POSITIVE_INFINITY
              : Number(b.current_age_estimate);

            const safeAgeA = Number.isFinite(ageA) ? ageA : Number.POSITIVE_INFINITY;
            const safeAgeB = Number.isFinite(ageB) ? ageB : Number.POSITIVE_INFINITY;

            if (safeAgeA !== safeAgeB) return safeAgeA - safeAgeB;

            const nameA = String(a.name || '').toLowerCase();
            const nameB = String(b.name || '').toLowerCase();
            if (nameA !== nameB) return nameA.localeCompare(nameB);

            return String(a.athlete_code).localeCompare(String(b.athlete_code));
          });
          setResults(sorted.slice(0, 20));
        } else {
          setResults([]);
        }
      } catch (err) {
        console.error('Athlete search request failed', err);
        setResults([]);
      } finally {
        setLoading(false);
        if (!suppressReopenRef.current) {
          setOpen(true);
        }
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
      } else if (results.length > 0) {
        choose(results[0]);
      }
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  const choose = (ath: Athlete) => {
    suppressReopenRef.current = true;
    setQuery(ath.name ? String(ath.name) : String(ath.athlete_code));
    setResults([]);
    setOpen(false);
    if (onSelect) onSelect(String(ath.athlete_code));
  };

  const formatAgeEstimate = (age: string | number | undefined) => {
    if (age === undefined || age === null || age === '') return undefined;
    const parsed = typeof age === 'number' ? age : Number(age);
    if (!Number.isFinite(parsed)) return undefined;
    return parsed.toFixed(1);
  };

  return (
    <div ref={containerRef} style={{ position: 'relative', maxWidth: 640, zIndex: 10060 }}>
      <input
        ref={inputRef}
        id={inputId}
        aria-label="Search athletes"
        placeholder={placeholder || 'Type athlete name or code...'}
        value={query}
        onChange={(e) => {
          prefilledOnEntryRef.current = false;
          suppressReopenRef.current = false;
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (prefilledOnEntryRef.current && suppressInitialSearch) {
            return;
          }
          if (results.length) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
        style={{
          width: 'calc(154px + 2cm)',
          height: '20px',
          padding: '8px 6px',
          boxSizing: 'border-box',
          fontSize: '0.95rem',
          fontWeight: 600,
          letterSpacing: '-0.01em',
          color: '#4b5563',
          fontFamily: 'inherit'
        }}
      />
      {query.trim().length > 0 && open && createPortal(
        <div
          ref={dropdownRef}
          role="listbox"
          style={{
            position: 'fixed',
            zIndex: 2147483647,
            top: dropdownTop,
            left: dropdownLeft,
            width: dropdownWidth,
            background: '#fff',
            border: '1px solid rgba(0,0,0,0.15)',
            borderRadius: 4,
            boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
            height: 120,
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
              <div style={{ fontSize: 14 }}>
                {r.name || `Athlete ${r.athlete_code}`}
                {formatAgeEstimate(r.current_age_estimate) ? ` (${formatAgeEstimate(r.current_age_estimate)})` : ''}
              </div>
              <div style={{ color: '#666', fontSize: 13 }}>{r.athlete_code}{r.total_runs ? ` • ${r.total_runs}` : ''}</div>
            </div>
          ))}
          {!loading && results.length === 0 && (
            <div style={{ padding: 8, color: '#666' }}>No results</div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
};

export default AthleteSearch;

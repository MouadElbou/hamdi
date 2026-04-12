import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

interface Option {
  value: string;
  label: string;
}

interface SearchableSelectProps {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  creatable?: boolean;
  onCreate?: (value: string) => Promise<void>;
}

export function SearchableSelect({ options, value, onChange, placeholder = 'Rechercher...', required, creatable, onCreate }: SearchableSelectProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const listId = useRef(`ss-list-${Math.random().toString(36).slice(2, 8)}`).current;

  const selected = options.find(o => o.value === value);

  const filtered = search.trim()
    ? options.filter(o => o.label.toLowerCase().includes(search.trim().toLowerCase()))
    : options;

  const MAX_INPUT_LENGTH = 200;
  const trimmedSearch = search.trim().slice(0, MAX_INPUT_LENGTH);
  const showCreate = creatable && onCreate && trimmedSearch.length > 0
    && !options.some(o => o.label.toLowerCase() === trimmedSearch.toLowerCase());

  const totalItems = (showCreate ? 1 : 0) + filtered.length;

  useEffect(() => {
    setActiveIndex(-1);
  }, [search, open]);

  const updateDropdownPos = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setDropdownPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateDropdownPos();
    // Close dropdown when any scrollable ancestor scrolls (e.g. modal-body)
    const scrollParent = containerRef.current?.closest('.modal-body');
    const onScroll = () => { setOpen(false); setSearch(''); };
    scrollParent?.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', updateDropdownPos);
    return () => {
      scrollParent?.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', updateDropdownPos);
    };
  }, [open, updateDropdownPos]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const scrollActiveIntoView = useCallback((index: number) => {
    const dropdown = dropdownRef.current;
    if (!dropdown) return;
    const items = dropdown.querySelectorAll('[role="option"]');
    items[index]?.scrollIntoView({ block: 'nearest' });
  }, []);

  const handleSelect = (val: string) => {
    onChange(val);
    setOpen(false);
    setSearch('');
  };

  const handleCreate = async () => {
    if (!onCreate || !trimmedSearch || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmedSearch);
      onChange(trimmedSearch);
      setOpen(false);
      setSearch('');
    } finally {
      setCreating(false);
    }
  };

  const handleInputClick = () => {
    setOpen(true);
    setSearch('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setOpen(false);
      setSearch('');
      return;
    }

    if (!open) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = activeIndex < totalItems - 1 ? activeIndex + 1 : 0;
      setActiveIndex(next);
      scrollActiveIntoView(next);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = activeIndex > 0 ? activeIndex - 1 : totalItems - 1;
      setActiveIndex(prev);
      scrollActiveIntoView(prev);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
      scrollActiveIntoView(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(totalItems - 1);
      scrollActiveIntoView(totalItems - 1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (activeIndex >= 0) {
        const createOffset = showCreate ? 1 : 0;
        if (showCreate && activeIndex === 0) {
          handleCreate();
        } else {
          const opt = filtered[activeIndex - createOffset];
          if (opt) handleSelect(opt.value);
        }
      } else if (showCreate && filtered.length === 0) {
        handleCreate();
      }
    }
  };

  return (
    <div className="searchable-select" ref={containerRef}>
      {required && (
        <input
          tabIndex={-1}
          autoComplete="off"
          style={{ position: 'absolute', opacity: 0, height: 0, width: 0, pointerEvents: 'none' }}
          value={value}
          onChange={() => {}}
          required
        />
      )}

      {!open ? (
        <div
          className="searchable-select-trigger"
          onClick={handleInputClick}
          tabIndex={0}
          role="combobox"
          aria-expanded={false}
          aria-haspopup="listbox"
          aria-controls={listId}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') handleInputClick(); }}
        >
          {selected ? (
            <span className="searchable-select-value">{selected.label}</span>
          ) : (
            <span className="searchable-select-placeholder">{placeholder}</span>
          )}
          <span className="searchable-select-arrow">▾</span>
        </div>
      ) : (
        <input
          ref={inputRef}
          type="text"
          className="searchable-select-input"
          value={search}
          onChange={e => setSearch(e.target.value.slice(0, MAX_INPUT_LENGTH))}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={true}
          aria-haspopup="listbox"
          aria-controls={listId}
          aria-activedescendant={activeIndex >= 0 ? `${listId}-opt-${activeIndex}` : undefined}
        />
      )}

      {open && dropdownPos && createPortal(
        <div
          className="searchable-select-dropdown"
          ref={dropdownRef}
          role="listbox"
          id={listId}
          style={{ position: 'fixed', top: dropdownPos.top, left: dropdownPos.left, width: dropdownPos.width }}
        >
          {showCreate && (
            <div
              id={`${listId}-opt-0`}
              className={`searchable-select-option searchable-select-create ${activeIndex === 0 ? 'active' : ''}`}
              onClick={handleCreate}
              role="option"
              aria-selected={activeIndex === 0}
              style={{ fontStyle: 'italic', color: 'var(--accent)' }}
            >
              {creating ? 'Ajout...' : `➕ Ajouter «\u00A0${trimmedSearch}\u00A0»`}
            </div>
          )}
          {filtered.length === 0 && !showCreate ? (
            <div className="searchable-select-empty">Aucun résultat</div>
          ) : (
            filtered.map((o, i) => {
              const itemIndex = i + (showCreate ? 1 : 0);
              return (
                <div
                  key={o.value}
                  id={`${listId}-opt-${itemIndex}`}
                  className={`searchable-select-option ${o.value === value ? 'selected' : ''} ${activeIndex === itemIndex ? 'active' : ''}`}
                  onClick={() => handleSelect(o.value)}
                  role="option"
                  aria-selected={o.value === value}
                >
                  {o.label}
                </div>
              );
            })
          )}
        </div>,
        document.body
      )}
    </div>
  );
}

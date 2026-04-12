import { useMemo } from 'react';

export const PAGE_SIZE = 20;

interface PaginationProps {
  total: number;
  page: number;
  onPageChange: (page: number) => void;
}

export function paginate<T>(data: T[], page: number): T[] {
  const start = (page - 1) * PAGE_SIZE;
  return data.slice(start, start + PAGE_SIZE);
}

export default function Pagination({ total, page, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const pages = useMemo(() => {
    const arr: (number | '...')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) arr.push(i);
    } else {
      arr.push(1);
      if (page > 3) arr.push('...');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) arr.push(i);
      if (page < totalPages - 2) arr.push('...');
      arr.push(totalPages);
    }
    return arr;
  }, [page, totalPages]);

  if (totalPages <= 1) return null;

  return (
    <nav className="pagination" aria-label="Pagination">
      <button
        className="pagination-btn"
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
        aria-label="Page précédente"
      >
        ‹
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`dots-${i}`} className="pagination-dots">…</span>
        ) : (
          <button
            key={p}
            className={`pagination-btn ${p === page ? 'active' : ''}`}
            onClick={() => onPageChange(p)}
            aria-label={`Page ${p}`}
            {...(p === page ? { 'aria-current': 'page' as const } : {})}
          >
            {p}
          </button>
        )
      )}
      <button
        className="pagination-btn"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
        aria-label="Page suivante"
      >
        ›
      </button>
    </nav>
  );
}

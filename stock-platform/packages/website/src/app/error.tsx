'use client';

import { AlertCircleIcon } from '@/components/icons';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="main-area">
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="catalog-state-icon" style={{ margin: '0 auto 1.5rem', background: 'var(--red-bg)', color: 'var(--red)' }}>
          <AlertCircleIcon size={28} />
        </div>
        <h1 className="page-title" style={{ marginBottom: '.5rem' }}>Une erreur est survenue</h1>
        <p style={{ color: 'var(--slate)', fontSize: '.9rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          Quelque chose s&apos;est mal passe. Veuillez reessayer.
        </p>
        <button onClick={() => reset()} className="btn btn-primary">
          Reessayer
        </button>
      </div>
    </div>
  );
}

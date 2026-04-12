'use client';

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1>Une erreur est survenue</h1>
      <p style={{ color: '#666', marginTop: '1rem' }}>
        Quelque chose s&apos;est mal passé. Veuillez réessayer.
      </p>
      <button
        onClick={() => reset()}
        style={{
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#2563eb',
          color: '#fff',
          border: 'none',
          borderRadius: '0.375rem',
          cursor: 'pointer',
          fontSize: '1rem',
        }}
      >
        Réessayer
      </button>
    </div>
  );
}

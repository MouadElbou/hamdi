import Link from 'next/link';

export default function NotFoundPage() {
  return (
    <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
      <h1>404 — Page introuvable</h1>
      <p style={{ color: '#666', marginTop: '1rem' }}>
        La page que vous cherchez n&apos;existe pas.
      </p>
      <Link
        href="/"
        style={{
          display: 'inline-block',
          marginTop: '2rem',
          padding: '0.75rem 1.5rem',
          background: '#2563eb',
          color: '#fff',
          borderRadius: '0.375rem',
          textDecoration: 'none',
          fontSize: '1rem',
        }}
      >
        Retour au catalogue
      </Link>
    </div>
  );
}

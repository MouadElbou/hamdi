import Link from 'next/link';
import { SearchIcon } from '@/components/icons';

export default function NotFoundPage() {
  return (
    <div className="main-area">
      <div className="container" style={{ textAlign: 'center', paddingTop: '4rem', paddingBottom: '4rem' }}>
        <div className="catalog-state-icon" style={{ margin: '0 auto 1.5rem' }}>
          <SearchIcon size={28} />
        </div>
        <h1 className="page-title" style={{ marginBottom: '.5rem' }}>404 — Page introuvable</h1>
        <p style={{ color: 'var(--slate)', fontSize: '.9rem', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
          La page que vous cherchez n&apos;existe pas ou a ete deplacee.
        </p>
        <Link href="/" className="btn btn-primary">
          Retour a l&apos;accueil
        </Link>
      </div>
    </div>
  );
}

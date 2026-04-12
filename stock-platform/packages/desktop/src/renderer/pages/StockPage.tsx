import React, { useEffect, useState, useRef, useCallback } from 'react';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { useToast } from '../components/Toast.js';

interface StockItem {
  lotId: string;
  refNumber: string;
  date: string;
  category: string;
  designation: string;
  supplier: string;
  boutique: string;
  initialQuantity: number;
  soldQuantity: number;
  remainingQuantity: number;
  purchaseUnitCost: number;
  targetResalePrice: number | null;
  currentStockValue: number;
}

export function StockPage(): React.JSX.Element {
  const { addToast } = useToast();
  const [items, setItems] = useState<StockItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [inStockOnly, setInStockOnly] = useState(true);
  const [page, setPage] = useState(1);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const mountedRef = useRef(false);

  const loadData = useCallback(async (s: string, stockOnly: boolean, p: number) => {
    try {
      const result = await window.api.stock.list({ inStockOnly: stockOnly, search: s || undefined, page: p, limit: PAGE_SIZE }) as { items: StockItem[]; total: number };
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (err) { console.error('[Load]', err); addToast('Erreur lors du chargement du stock', 'error'); }
  }, []);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      loadData(search, inStockOnly, page);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => loadData(search, inStockOnly, page), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, inStockOnly, page, loadData]);

  const formatMoney = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

  return (
    <div>
      <div className="page-header">
        <h2>Stock</h2>
        <span className="subtitle">Inventaire par lot d'achat</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          />
        </div>
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={inStockOnly}
            onChange={(e) => { setInStockOnly(e.target.checked); setPage(1); }}
          />
          En stock uniquement
        </label>
        <div className="toolbar-spacer" />
        <span className="badge">{total} lots</span>
      </div>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Catégorie</th>
                <th>Désignation</th>
                <th>Fournisseur</th>
                <th>Boutique</th>
                <th className="text-right">Init</th>
                <th className="text-right">Vendu</th>
                <th className="text-right">Reste</th>
                <th className="text-right">PA</th>
                <th className="text-right">PV Rév</th>
                <th className="text-right">Valeur</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={11}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 7l10-5 10 5-10 5z" /><path d="M2 17l10 5 10-5" /><path d="M2 12l10 5 10-5" /></svg>
                      </div>
                      <div className="empty-title">Aucun lot en stock</div>
                      <div className="empty-desc">
                        {search
                          ? `Aucun résultat pour « ${search} »`
                          : 'Les lots apparaîtront ici après enregistrement d\'achats.'}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item.lotId}>
                  <td className="col-mono">{item.date}</td>
                  <td>{item.category}</td>
                  <td className="col-bold">{item.designation}</td>
                  <td>{item.supplier}</td>
                  <td>{item.boutique}</td>
                  <td className="text-right col-mono">{item.initialQuantity}</td>
                  <td className="text-right col-mono">{item.soldQuantity}</td>
                  <td className="text-right col-mono" style={{ fontWeight: 600 }}>
                    <span className={item.remainingQuantity === 0 ? 'text-danger' : 'text-success'}>
                      {item.remainingQuantity}
                    </span>
                  </td>
                  <td className="text-right col-mono">{formatMoney(item.purchaseUnitCost)}</td>
                  <td className="text-right col-mono">{item.targetResalePrice ? formatMoney(item.targetResalePrice) : '—'}</td>
                  <td className="text-right col-mono col-bold">{formatMoney(item.currentStockValue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={total} page={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}

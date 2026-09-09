import React, { useEffect, useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import Pagination, { PAGE_SIZE } from '../components/Pagination.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { useAuth } from '../components/AuthContext.js';
import { parseCents, parsePositiveInt, todayLocal } from '../utils.js';
import { FIELD_LABELS, formatRawCell, listSheets, parsePurchaseSheet, pickDefaultSheet, summarizeErrors } from '../excel-import.js';
import type { ParsedRow, ParsedSheet, PurchaseField } from '../excel-import.js';

// Rows sent per IPC call so a big import never blocks in one giant payload.
const IMPORT_CHUNK_SIZE = 400;
// Max preview rows rendered in the DOM, in file order, after the Toutes/Erreurs filter.
const IMPORT_PREVIEW_LIMIT = 300;
type ImportPreviewFilter = 'all' | 'errors';

/** "2026-01-31" → "31/01/2026" for the preview (same shape formatRawCell gives raw Date cells). */
const isoToFr = (iso: string): string => {
  const [y, m, d] = iso.split('-');
  return y && m && d ? `${d}/${m}/${y}` : iso;
};

export function PurchasesPage(): React.JSX.Element {
  const { categories, suppliers, boutiques, subCategories, addCategory, addSupplier, addBoutique, addSubCategory } = useReferenceData();
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<Array<Record<string, unknown>>>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [filterCategory, setFilterCategory] = useState('');
  const [filterSubCategory, setFilterSubCategory] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importWbRef = useRef<XLSX.WorkBook | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importSheets, setImportSheets] = useState<string[]>([]);
  const [importFileInfo, setImportFileInfo] = useState<{ name: string; modified: Date; size: number } | null>(null);
  const [importSheet, setImportSheet] = useState('');
  const [importResult, setImportResult] = useState<ParsedSheet | null>(null);
  const [importDefaultBoutique, setImportDefaultBoutique] = useState('');
  const [importApplyBoutiqueToAll, setImportApplyBoutiqueToAll] = useState(false);
  const [importPreviewFilter, setImportPreviewFilter] = useState<ImportPreviewFilter>('all');
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importing, setImporting] = useState(false);
  // Index of the first valid row NOT yet committed — lets a retry after a failed
  // chunk resume where it stopped instead of duplicating the committed chunks.
  const [importResumeIndex, setImportResumeIndex] = useState(0);
  const [form, setForm] = useState({
    date: todayLocal(), category: '', subCategory: '', designation: '',
    supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', sellingPrice: '', barcode: '',
  });

  const resetForm = () => setForm({ date: todayLocal(), category: '', subCategory: '', designation: '', supplier: '', boutique: '', initialQuantity: '', purchaseUnitCost: '', targetResalePrice: '', sellingPrice: '', barcode: '' });

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (item: Record<string, unknown>) => {
    const sp = item['selling_price'] as number | null;
    setForm({
      date: item['date'] as string,
      category: item['category_name'] as string,
      subCategory: (item['sub_category_name'] as string) || '',
      designation: item['designation'] as string,
      supplier: item['supplier_code'] as string,
      boutique: item['boutique_name'] as string,
      initialQuantity: String(item['initial_quantity']),
      purchaseUnitCost: String((item['purchase_unit_cost'] as number) / 100),
      targetResalePrice: item['target_resale_price'] ? String((item['target_resale_price'] as number) / 100) : '',
      sellingPrice: sp ? String(sp / 100) : '',
      barcode: (item['barcode'] as string) || '',
    });
    setEditingId(item['id'] as string);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); resetForm(); };

  const filteredSubCategories = form.category
    ? subCategories.filter(sc => {
        const cat = categories.find(c => c.name === form.category);
        return cat && sc.category_id === cat.id;
      })
    : [];

  const filterSubCategoryOptions = filterCategory
    ? subCategories.filter(sc => {
        const cat = categories.find(c => c.name === filterCategory);
        return cat && sc.category_id === cat.id;
      })
    : [];

  const load = async () => {
    try {
      const result = await window.api.purchases.list({ page, limit: PAGE_SIZE, search: search || undefined, category: filterCategory || undefined, subCategory: filterSubCategory || undefined }) as { items: Array<Record<string, unknown>>; total: number; grandTotal?: number };
      if (result?.items) setItems(result.items);
      setTotalItems(result?.total || 0);
      setGrandTotal(result?.grandTotal || 0);
    } catch (err) { console.error('[Load]', err); addToast('Erreur lors du chargement des achats', 'error'); }
  };

  useEffect(() => {
    load();
  }, [search, page, filterCategory, filterSubCategory]);

  const fm = (centimes: number) => (centimes / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
    const qty = parsePositiveInt(form.initialQuantity, 'Quantité');
    const unitCostCents = isAdmin ? parseCents(form.purchaseUnitCost, 'Coût unitaire') : 0;
    const payload = {
      date: form.date,
      category: form.category,
      subCategory: form.subCategory || null,
      designation: form.designation,
      supplier: form.supplier || undefined,
      boutique: form.boutique,
      initialQuantity: qty,
      purchaseUnitCost: unitCostCents,
      targetResalePrice: form.targetResalePrice ? parseCents(form.targetResalePrice, 'Prix revente') : null,
      blockPrice: null,
      sellingPrice: form.sellingPrice ? parseCents(form.sellingPrice, 'Prix de vente public') : null,
      barcode: form.barcode || undefined,
    };
    if (editingId) {
      await window.api.purchases.update({ id: editingId, ...payload });
    } else {
      await window.api.purchases.create(payload);
    }
    closeForm();
    load();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleImportClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const runSheetParse = (wb: XLSX.WorkBook, sheetName: string, defaultBoutique: string, applyToAll: boolean) => {
    const result = parsePurchaseSheet(wb, sheetName, {
      defaultBoutique: defaultBoutique || undefined,
      applyDefaultBoutiqueToAll: applyToAll,
      known: {
        boutiques: boutiques.map(b => b.name),
        categories: categories.map(c => c.name),
        suppliers: suppliers.map(s => s.code),
      },
    });
    setImportResult(result);
    setImportResumeIndex(0);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array', cellDates: true });
      const sheets = listSheets(wb);
      const chosen = pickDefaultSheet(sheets);
      if (!chosen) {
        addToast('Fichier Excel vide', 'error');
        return;
      }
      importWbRef.current = wb;
      setImportFileInfo({ name: file.name, modified: new Date(file.lastModified), size: file.size });
      setImportSheets(sheets);
      setImportSheet(chosen);
      setImportDefaultBoutique('');
      setImportApplyBoutiqueToAll(false);
      setImportProgress(null);
      runSheetParse(wb, chosen, '', false);
      setShowImport(true);
    } catch (err) {
      console.error('[Excel parse]', err);
      addToast('Erreur lors de la lecture du fichier: ' + ((err as Error).message || 'inconnue'), 'error');
    }
  };

  const handleImportSheetChange = (name: string) => {
    setImportSheet(name);
    setImportDefaultBoutique('');
    setImportApplyBoutiqueToAll(false);
    const wb = importWbRef.current;
    if (wb) runSheetParse(wb, name, '', false);
  };

  const handleDefaultBoutiqueChange = (name: string) => {
    setImportDefaultBoutique(name);
    const wb = importWbRef.current;
    if (wb) runSheetParse(wb, importSheet, name, importApplyBoutiqueToAll);
  };

  const handleApplyBoutiqueToAllChange = (checked: boolean) => {
    setImportApplyBoutiqueToAll(checked);
    const wb = importWbRef.current;
    if (wb) runSheetParse(wb, importSheet, importDefaultBoutique, checked);
  };

  const importStats = useMemo(() => {
    const rows = importResult?.rows ?? [];
    const valid = rows.filter(r => r.data !== null).length;
    return { total: rows.length, valid, errors: rows.length - valid };
  }, [importResult]);

  const importErrorSummary = useMemo(() => summarizeErrors(importResult?.rows ?? []), [importResult]);

  // Rows stay in file order (row numbers keep climbing, nothing looks "skipped").
  // Never render thousands of DOM rows: the filtered list is capped.
  const importFilteredRows = useMemo(() => {
    const rows = importResult?.rows ?? [];
    return importPreviewFilter === 'errors' ? rows.filter(r => r.error !== null) : rows;
  }, [importResult, importPreviewFilter]);
  const importDisplayRows = useMemo(() => importFilteredRows.slice(0, IMPORT_PREVIEW_LIMIT), [importFilteredRows]);

  const importHasBoutiqueCol = importResult ? importResult.columnMap.some(c => c.field === 'boutique') : true;
  // Offer a default whenever at least one row would need it, not only when the column is absent.
  const importNeedsDefaultBoutique = importResult !== null && (!importHasBoutiqueCol || importResult.missingBoutiqueRows > 0);

  // Summary entry text. The boutique error names its fix (the default select above)
  // and says "vide ou 0" so a visible "0" cell no longer reads as a contradiction.
  const importErrorLabel = (error: string, count: number): string => {
    if (error !== 'Boutique manquante') return `${error} × ${count}`;
    const hint = importNeedsDefaultBoutique && !importDefaultBoutique ? ' → choisissez une « Boutique par défaut » ci-dessus' : '';
    return `Boutique manquante (cellule vide ou 0) × ${count}${hint}`;
  };

  const rawCell = (row: ParsedRow, field: PurchaseField): string => {
    const col = importResult?.columnMap.find(c => c.field === field);
    if (!col) return '—';
    return formatRawCell(row.raw[col.columnIndex]);
  };

  const resetImportState = () => {
    setShowImport(false);
    setImportResult(null);
    setImportSheets([]);
    setImportSheet('');
    setImportDefaultBoutique('');
    setImportApplyBoutiqueToAll(false);
    setImportFileInfo(null);
    setImportPreviewFilter('all');
    setImportProgress(null);
    setImportResumeIndex(0);
    importWbRef.current = null;
  };

  const handleConfirmImport = async () => {
    if (importing) return;
    const validRows = (importResult?.rows ?? []).filter(p => p.data !== null).map(p => p.data!);
    if (validRows.length === 0) {
      addToast('Aucune ligne valide à importer', 'error');
      return;
    }
    setImporting(true);
    setImportProgress({ done: importResumeIndex, total: validRows.length });
    let created = 0;
    const errors: Array<{ row: number; message: string }> = [];
    // Start after the chunks already committed by a previous, interrupted run.
    let i = importResumeIndex;
    try {
      for (; i < validRows.length; i += IMPORT_CHUNK_SIZE) {
        const chunk = validRows.slice(i, i + IMPORT_CHUNK_SIZE);
        const result = await window.api.purchases.importExcel({
          rows: chunk.map(r => ({
            date: r.date,
            category: r.category,
            designation: r.designation,
            supplier: r.supplier,
            boutique: r.boutique,
            initialQuantity: r.initialQuantity,
            purchaseUnitCost: r.purchaseUnitCost,
            targetResalePrice: r.targetResalePrice,
            blockPrice: null,
            sellingPrice: r.sellingPrice,
            subCategory: r.subCategory,
            barcode: r.barcode,
          })),
        });
        created += result.created;
        for (const err of result.errors) errors.push({ row: err.row + i, message: err.message });
        setImportProgress({ done: Math.min(i + IMPORT_CHUNK_SIZE, validRows.length), total: validRows.length });
      }
      if (errors.length > 0) {
        addToast(`${created} créé(s), ${errors.length} erreur(s)`, 'warning');
      } else {
        addToast(`${created} achat(s) importé(s) avec succès`, 'success');
      }
      resetImportState();
      load();
    } catch (err) {
      const message = (err as Error).message || 'Erreur lors de l\'import';
      // The chunk at `i` did not commit — remember it so the retry button
      // resumes there instead of re-sending (and duplicating) earlier chunks.
      setImportResumeIndex(i);
      addToast(created > 0 ? `${created} créé(s) avant l'erreur — ${message}` : message, 'error');
      if (created > 0) load();
    } finally {
      setImporting(false);
      setImportProgress(null);
    }
  };

  const handleCloseImport = () => {
    if (importing) return;
    resetImportState();
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!await confirm('Supprimer cet achat ?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.purchases.delete(id);
      load();
    } catch (err) {
      console.error('[Delete]', err);
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Achats</h2>
        <span className="subtitle">Achats enregistres</span>
        <div className="header-accent" />
      </div>

      <div className="page-toolbar">
        <div className="search-input-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
          <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
        </div>
        <select className="toolbar-filter" value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterSubCategory(''); setPage(1); }}>
          <option value="">Toutes catégories</option>
          {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
        </select>
        {filterCategory && filterSubCategoryOptions.length > 0 && (
          <select className="toolbar-filter" value={filterSubCategory} onChange={e => { setFilterSubCategory(e.target.value); setPage(1); }}>
            <option value="">Toutes sous-cat.</option>
            {filterSubCategoryOptions.map(sc => <option key={sc.id} value={sc.name}>{sc.name}</option>)}
          </select>
        )}
        <span className="badge">{totalItems} articles</span>
        {isAdmin && <span className="badge badge-accent" title="Total global des achats">Total achats: {fm(grandTotal)}</span>}
        <div className="toolbar-spacer" />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button className="btn btn-secondary" onClick={handleImportClick}>
          Importer Excel
        </button>
        <button className="btn btn-primary" onClick={openCreate}>
          + Nouvel achat
        </button>
      </div>

      <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier achat' : 'Nouvel achat'} width="720px">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Categorie</label>
              <SearchableSelect
                options={categories.map(c => ({ value: c.name, label: c.name }))}
                value={form.category}
                onChange={v => setForm({ ...form, category: v, subCategory: '' })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { await addCategory(name); }}
              />
            </div>
            <div className="form-group" style={{ flex: 2 }}>
              <label>Sous-categorie</label>
              <SearchableSelect
                options={filteredSubCategories.map(sc => ({ value: sc.name, label: sc.name }))}
                value={form.subCategory}
                onChange={v => setForm({ ...form, subCategory: v })}
                placeholder="Optionnel"
                creatable
                onCreate={async (name) => {
                  const cat = categories.find(c => c.name === form.category);
                  if (cat) await addSubCategory(name, cat.id);
                }}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group" style={{ flex: 2 }}>
              <label>Designation</label>
              <input type="text" value={form.designation} onChange={e => setForm({ ...form, designation: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Code-barres</label>
              <input type="text" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} placeholder="Scanner ou saisir" />
            </div>
            {isAdmin && (
              <div className="form-group">
                <label>Fournisseur</label>
                <SearchableSelect
                  options={suppliers.map(s => ({ value: s.code, label: s.code }))}
                  value={form.supplier}
                  onChange={v => setForm({ ...form, supplier: v })}
                  placeholder="Choisir ou ajouter"
                  required
                  creatable
                  onCreate={async (code) => { await addSupplier(code); }}
                />
              </div>
            )}
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Boutique</label>
              <SearchableSelect
                options={boutiques.map(b => ({ value: b.name, label: b.name }))}
                value={form.boutique}
                onChange={v => setForm({ ...form, boutique: v })}
                placeholder="Choisir ou ajouter"
                required
                creatable
                onCreate={async (name) => { await addBoutique(name); }}
              />
            </div>
            <div className="form-group">
              <label>Quantite</label>
              <input type="number" min="1" value={form.initialQuantity} onChange={e => setForm({ ...form, initialQuantity: e.target.value })} required />
            </div>
          </div>
          <div className="form-row">
            {isAdmin && (
              <div className="form-group">
                <label>Prix achat unitaire</label>
                <input type="number" step="0.01" min="0" value={form.purchaseUnitCost} onChange={e => setForm({ ...form, purchaseUnitCost: e.target.value })} required />
              </div>
            )}
            {isAdmin && (
              <div className="form-group">
                <label>Prix de vente revendeur</label>
                <input type="number" step="0.01" min="0" value={form.targetResalePrice} onChange={e => setForm({ ...form, targetResalePrice: e.target.value })} />
              </div>
            )}
            <div className="form-group">
              <label>Prix de vente public</label>
              <input type="number" step="0.01" min="0" value={form.sellingPrice} onChange={e => setForm({ ...form, sellingPrice: e.target.value })} placeholder="Optionnel" />
            </div>
          </div>
          <div className="form-actions">
            <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : editingId ? 'Modifier' : 'Enregistrer'}</button>
          </div>
        </form>
      </Modal>

      <Modal open={showImport} onClose={handleCloseImport} title="Importer depuis Excel" width="960px">
        {importFileInfo && (
          <div style={{ fontSize: 12, color: '#555', marginBottom: 10 }}>
            Fichier : <strong>{importFileInfo.name}</strong>
            {' · enregistré le '}{importFileInfo.modified.toLocaleDateString('fr-FR')}
            {' à '}{importFileInfo.modified.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
            {' · '}{(importFileInfo.size / 1048576).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo
            {' — vérifiez que c\'est bien la dernière version enregistrée (fermez Excel avant d\'importer).'}
          </div>
        )}
        {importSheets.length > 1 && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Feuille à importer</label>
            {/* Locked once a chunk has been committed: re-parsing resets the resume point and would duplicate those rows. */}
            <select value={importSheet} onChange={e => handleImportSheetChange(e.target.value)} disabled={importing || importResumeIndex > 0}>
              {importSheets.map(name => <option key={name} value={name}>{name}</option>)}
            </select>
          </div>
        )}
        {importResult && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label>Boutique par défaut</label>
            <select value={importDefaultBoutique} onChange={e => handleDefaultBoutiqueChange(e.target.value)} required disabled={importing || importResumeIndex > 0}>
              <option value="">— Choisir une boutique —</option>
              {boutiques.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
            </select>
            <div style={{ fontSize: 12, color: importNeedsDefaultBoutique && !importDefaultBoutique ? '#c02626' : '#555', marginTop: 4 }}>
              {importApplyBoutiqueToAll && importDefaultBoutique
                ? `Toutes les lignes utiliseront « ${importDefaultBoutique} » (la boutique indiquée dans le fichier est remplacée).`
                : importResult.missingBoutiqueRows === 0
                  ? 'Toutes les lignes ont déjà une boutique dans le fichier.'
                  : importDefaultBoutique
                    ? `${importResult.missingBoutiqueRows} ligne(s) sans boutique dans le fichier utiliseront « ${importDefaultBoutique} » ; les autres gardent la boutique du fichier.`
                    : `${importResult.missingBoutiqueRows} ligne(s) n'ont pas de boutique dans le fichier (cellule vide ou 0) : choisissez ici la boutique à leur attribuer pour corriger ces erreurs.`}
              {!importHasBoutiqueCol && ' Aucune colonne boutique détectée.'}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 13, textTransform: 'none', letterSpacing: 0, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={importApplyBoutiqueToAll}
                disabled={!importDefaultBoutique || importing || importResumeIndex > 0}
                onChange={e => handleApplyBoutiqueToAllChange(e.target.checked)}
              />
              Appliquer cette boutique à toutes les lignes (remplacer la boutique indiquée dans le fichier)
            </label>
          </div>
        )}
        {importResult && (
          <>
            <div style={{ marginBottom: 8, display: 'flex', gap: 16, fontSize: 13, flexWrap: 'wrap' }}>
              <span><strong>Total:</strong> {importStats.total}</span>
              <span style={{ color: '#0a7f2e' }}>
                <strong>Valides:</strong> {importStats.valid}
              </span>
              <span style={{ color: '#c02626' }}>
                <strong>Erreurs:</strong> {importStats.errors}
              </span>
              {importResult.skippedEmpty > 0 && (
                <span style={{ color: '#666' }}>
                  <strong>Lignes vides ignorées:</strong> {importResult.skippedEmpty}
                </span>
              )}
            </div>
            {importErrorSummary.length > 0 && (
              <div style={{ fontSize: 12, color: '#c02626', marginBottom: 8 }}>
                Détail des erreurs: {importErrorSummary.map(e => importErrorLabel(e.error, e.count)).join(' · ')}
              </div>
            )}
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
              En-têtes détectés à la ligne {importResult.headerRowIndex + 1}.
            </div>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 4 }}>
              {importResult.columnMap.length > 0 ? (
                <>Colonnes reconnues: {[
                  ...importResult.columnMap.map(c => `${FIELD_LABELS[c.field]} ← « ${c.header} »`),
                  ...(importResult.defaultBoutiqueApplied > 0
                    ? [`${FIELD_LABELS.boutique} ← boutique par défaut (${importResult.defaultBoutiqueApplied} ligne(s))`]
                    : []),
                ].join(' · ')}</>
              ) : (
                <>Aucune colonne reconnue. Colonnes attendues: Date, Catégorie, Désignation, Fournisseur, Boutique, Quantité, Prix achat, Prix revendeur, Prix vente, Code-barres, Sous-catégorie (noms flexibles). Essayez une autre feuille.</>
              )}
            </div>
            {importResult.ignoredColumns.map(ic => (
              <div key={ic.header} style={{ fontSize: 12, color: '#8a6d1a', marginBottom: 4 }}>
                Colonne « {ic.header} » ignorée: {ic.reason}
                {ic.field === 'barcode' && ' — les achats seront importés sans code-barres'}
              </div>
            ))}
            {importResult.columnDiagnostics.map(d => (
              <div key={d.field} style={{ fontSize: 12, color: '#c02626', marginBottom: 4 }}>
                ⚠ La colonne « {d.header} » ({FIELD_LABELS[d.field]}) est vide sur {d.emptyRows} des {d.dataRows} lignes.{' '}
                {d.formulaWithoutValue > 0
                  ? `Elle contient ${d.formulaWithoutValue} formule(s) sans valeur calculée : ouvrez le fichier dans Excel, appuyez sur F9, enregistrez (Ctrl+S), puis réessayez.`
                  : 'Vérifiez que les valeurs sont bien dans cette colonne du fichier importé, et que vous importez la dernière version enregistrée (fermez Excel avant).'}
              </div>
            ))}
            {importResult.rows.length > 0 && (
              // Kept outside the scroll box so the view switch never scrolls out of sight.
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '8px 0', fontSize: 12, color: '#555' }}>
                <span>Afficher :</span>
                <button
                  type="button"
                  className={`btn btn-sm ${importPreviewFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setImportPreviewFilter('all')}
                >
                  Toutes ({importStats.total})
                </button>
                <button
                  type="button"
                  className={`btn btn-sm ${importPreviewFilter === 'errors' ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setImportPreviewFilter('errors')}
                >
                  Erreurs seulement ({importStats.errors})
                </button>
              </div>
            )}
          </>
        )}
        {/* table-wrapper: prominent horizontal scrollbar for the wide preview; the sticky <th> sticks inside this box. */}
        <div className="table-wrapper" style={{ maxHeight: '60vh', overflow: 'auto' }}>
          {!importResult || importResult.rows.length === 0 ? (
            <p style={{ padding: 16, color: '#666' }}>Aucune donnée à afficher.</p>
          ) : importFilteredRows.length === 0 ? (
            <p style={{ padding: 16, color: '#666' }}>Aucune ligne en erreur.</p>
          ) : (
            <>
              <table className="data-table" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Statut</th>
                    <th>Date</th>
                    <th>Catégorie</th>
                    <th>Désignation</th>
                    {isAdmin && <th>Fournisseur</th>}
                    <th>Boutique</th>
                    <th className="text-right">Qté</th>
                    <th className="text-right">PA</th>
                    <th className="text-right">PV Rev.</th>
                    <th className="text-right">PV Pub.</th>
                  </tr>
                </thead>
                <tbody>
                  {importDisplayRows.map(row => (
                    <tr key={row.index} style={row.error ? { background: '#fdecec' } : {}}>
                      <td className="col-mono">{row.index}</td>
                      <td>
                        {row.error ? (
                          <span style={{ color: '#c02626' }}>{row.error}</span>
                        ) : (
                          <span style={{ color: '#0a7f2e' }}>OK</span>
                        )}
                      </td>
                      <td className="col-mono">{row.data ? isoToFr(row.data.date) : rawCell(row, 'date')}</td>
                      <td>{row.data ? row.data.category : rawCell(row, 'category')}</td>
                      <td>{row.data ? row.data.designation : rawCell(row, 'designation')}</td>
                      {isAdmin && <td>{row.data ? (row.data.supplier || '—') : rawCell(row, 'supplier')}</td>}
                      <td>{row.data ? row.data.boutique : rawCell(row, 'boutique')}</td>
                      <td className="text-right col-mono">{row.data ? row.data.initialQuantity : rawCell(row, 'quantity')}</td>
                      <td className="text-right col-mono">{row.data ? fm(row.data.purchaseUnitCost) : rawCell(row, 'purchasePrice')}</td>
                      <td className="text-right col-mono">{row.data ? (row.data.targetResalePrice != null ? fm(row.data.targetResalePrice) : '—') : rawCell(row, 'resalePrice')}</td>
                      <td className="text-right col-mono">{row.data ? (row.data.sellingPrice != null ? fm(row.data.sellingPrice) : '—') : rawCell(row, 'sellingPrice')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {importFilteredRows.length > importDisplayRows.length && (
                <div style={{ fontSize: 12, color: '#555', margin: '8px 0' }}>
                  Aperçu limité à {IMPORT_PREVIEW_LIMIT} lignes — les {importFilteredRows.length - importDisplayRows.length} autres lignes sont bien comptées ci-dessus
                  {importPreviewFilter === 'all' ? ' et seront importées si elles sont valides.' : '.'}
                </div>
              )}
            </>
          )}
        </div>
        <div style={{ fontSize: 12, color: '#8a6d1a', marginTop: 8 }}>
          Chaque import ajoute de nouvelles lignes : importer deux fois le même fichier créera des doublons.
        </div>
        {importStats.errors > 0 && (
          <div style={{ fontSize: 12, color: '#c02626', marginTop: 4 }}>
            {importStats.errors} ligne(s) en erreur ne seront pas importées.
          </div>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-cancel" onClick={handleCloseImport} disabled={importing}>Annuler</button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleConfirmImport}
            disabled={importing || importStats.valid === 0}
          >
            {importing && importProgress
              ? `Importation… ${importProgress.done} / ${importProgress.total}`
              : importResumeIndex > 0
                ? `Reprendre l'importation (${importStats.valid - importResumeIndex} restante(s))`
                : `Importer ${importStats.valid} ligne(s)`}
          </button>
        </div>
      </Modal>

      <div className="card-table">
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code-barres</th>
                <th>Date</th>
                <th>Categorie</th>
                <th>Designation</th>
                {isAdmin && <th>Fournisseur</th>}
                <th className="text-right">Qte</th>
                {isAdmin && <th className="text-right">PA unit.</th>}
                <th className="text-right">PV unit.</th>
                {isAdmin && <th className="text-right">Total</th>}
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={isAdmin ? 10 : 7}>
                    <div className="empty-state">
                      <div className="empty-icon">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" /></svg>
                      </div>
                      <div className="empty-title">Aucun achat</div>
                      <div className="empty-desc">Les achats enregistres apparaitront ici.</div>
                    </div>
                  </td>
                </tr>
              )}
              {items.map((item) => (
                <tr key={item['id'] as string}>
                  <td className="col-mono col-bold">{(item['barcode'] as string) || '—'}</td>
                  <td className="col-mono">{item['date'] as string}</td>
                  <td>{item['category_name'] as string}</td>
                  <td className="col-bold">{item['designation'] as string}</td>
                  {isAdmin && <td>{item['supplier_code'] as string}</td>}
                  <td className="text-right col-mono">{item['initial_quantity'] as number}</td>
                  {isAdmin && <td className="text-right col-mono">{fm(item['purchase_unit_cost'] as number)}</td>}
                  <td className="text-right col-mono">{item['selling_price'] ? fm(item['selling_price'] as number) : '—'}</td>
                  {isAdmin && (
                    <td className="text-right col-mono col-bold">
                      {fm((item['initial_quantity'] as number) * (item['purchase_unit_cost'] as number))}
                    </td>
                  )}
                  <td>
                    <div className="row-actions">
                      <button className="btn-icon" title="Modifier" onClick={() => openEdit(item)}>{EditIcon}</button>
                      <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(item['id'] as string)}>{TrashIcon}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination total={totalItems} page={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { Modal } from '../components/Modal.js';
import { EditIcon, TrashIcon } from '../components/Icons.js';
import { useConfirm } from '../components/ConfirmDialog.js';
import { useToast } from '../components/Toast.js';
import Pagination, { paginate, PAGE_SIZE } from '../components/Pagination.js';
import { SearchableSelect } from '../components/SearchableSelect.js';
import { useReferenceData } from '../components/ReferenceDataContext.js';
import { parseCents, todayLocal } from '../utils.js';

interface Expense {
  id: string; date: string; designation: string; amount: number; boutique_name: string;
}
interface Employee {
  id: string; name: string; monthly_salary: number; start_date: string; is_active: number;
}
interface SalaryPayment {
  id: string; date: string; amount: number; note: string | null; employee_id: string; employee_name: string;
}

type Tab = 'depenses' | 'employes';

const fm = (c: number) => (c / 100).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' DH';

export function ExpensesPage(): React.JSX.Element {
  const { expenseDesignations, boutiques, addExpenseDesignation, addBoutique } = useReferenceData();
  const [confirm, confirmDialog] = useConfirm();
  const { addToast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<Tab>('depenses');

  /* ── Expenses state ── */
  const [items, setItems] = useState<Expense[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ date: todayLocal(), designation: '', amount: '', boutique: '' });

  /* ── Employees state ── */
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [showEmpForm, setShowEmpForm] = useState(false);
  const [editingEmpId, setEditingEmpId] = useState<string | null>(null);
  const [empForm, setEmpForm] = useState({ name: '', monthlySalary: '', startDate: todayLocal() });
  const [showPayForm, setShowPayForm] = useState(false);
  const [payForm, setPayForm] = useState({ employeeId: '', date: todayLocal(), amount: '', note: '' });
  const [empSearch, setEmpSearch] = useState('');
  const [empPage, setEmpPage] = useState(1);

  const resetForm = () => setForm({ date: todayLocal(), designation: '', amount: '', boutique: '' });
  const resetEmpForm = () => setEmpForm({ name: '', monthlySalary: '', startDate: todayLocal() });
  const resetPayForm = () => setPayForm({ employeeId: '', date: todayLocal(), amount: '', note: '' });

  const loadExpenses = () => {
    window.api.expenses.list({ search: debouncedSearch || undefined, page, limit: PAGE_SIZE }).then((r: unknown) => {
      const data = r as { items: Expense[]; total: number };
      setItems(data.items || []);
      setTotalItems(data.total || 0);
    }).catch(() => addToast('Erreur lors du chargement', 'error'));
  };
  const loadEmployees = () => {
    window.api.employees.list().then((r: unknown) => setEmployees(r as Employee[])).catch(() => addToast('Erreur lors du chargement des employés', 'error'));
    window.api.salaryPayments.list({}).then((r: unknown) => setPayments(r as SalaryPayment[])).catch(() => addToast('Erreur lors du chargement des paiements', 'error'));
  };
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);
  useEffect(() => {
    loadExpenses();
  }, [debouncedSearch, page]);
  useEffect(() => {
    loadEmployees();
  }, []);

  const openCreate = () => { resetForm(); setEditingId(null); setShowForm(true); };
  const openEdit = (e: Expense) => {
    setForm({ date: e.date, designation: e.designation, amount: String(e.amount / 100), boutique: e.boutique_name });
    setEditingId(e.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditingId(null); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!form.designation || !form.amount || !form.boutique) { addToast('Veuillez remplir tous les champs obligatoires', 'error'); return; }
    setSubmitting(true);
    try {
    const payload = {
      date: form.date,
      designation: form.designation,
      amount: parseCents(form.amount, 'Montant'),
      boutique: form.boutique,
    };
    if (editingId) {
      await window.api.expenses.update({ id: editingId, ...payload });
    } else {
      await window.api.expenses.create(payload);
    }
    closeForm();
    loadExpenses();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const [deletingIds, setDeletingIds] = useState<Set<string>>(new Set());
  const handleDelete = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!await confirm('Supprimer cette depense ?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.expenses.delete(id);
      loadExpenses();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  /* ── Employee handlers ── */
  const openCreateEmp = () => { resetEmpForm(); setEditingEmpId(null); setShowEmpForm(true); };
  const openEditEmp = (emp: Employee) => {
    setEmpForm({ name: emp.name, monthlySalary: String(emp.monthly_salary / 100), startDate: emp.start_date });
    setEditingEmpId(emp.id);
    setShowEmpForm(true);
  };
  const closeEmpForm = () => { setShowEmpForm(false); setEditingEmpId(null); resetEmpForm(); };

  const handleEmpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
    const payload = {
      name: empForm.name.trim(),
      monthlySalary: parseCents(empForm.monthlySalary, 'Salaire'),
      startDate: empForm.startDate,
    };
    if (editingEmpId) {
      await window.api.employees.update({ id: editingEmpId, ...payload });
    } else {
      await window.api.employees.create(payload);
    }
    closeEmpForm();
    loadEmployees();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEmp = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!await confirm('Supprimer cet employe ?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.employees.delete(id);
      loadEmployees();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const openPayForm = (empId?: string) => {
    resetPayForm();
    if (empId) setPayForm(p => ({ ...p, employeeId: empId }));
    setShowPayForm(true);
  };

  const handlePaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (!payForm.employeeId || !payForm.amount) { addToast('Veuillez sélectionner un employé et entrer un montant', 'error'); return; }
    setSubmitting(true);
    try {
    await window.api.salaryPayments.create({
      employeeId: payForm.employeeId,
      date: payForm.date,
      amount: parseCents(payForm.amount, 'Montant'),
      note: payForm.note || undefined,
    });
    setShowPayForm(false);
    resetPayForm();
    loadEmployees();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la sauvegarde', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePay = async (id: string) => {
    if (deletingIds.has(id)) return;
    if (!await confirm('Supprimer ce paiement ?')) return;
    setDeletingIds(prev => new Set(prev).add(id));
    try {
      await window.api.salaryPayments.delete(id);
      loadEmployees();
    } catch (err) {
      addToast((err as Error).message || 'Erreur lors de la suppression', 'error');
    } finally {
      setDeletingIds(prev => { const next = new Set(prev); next.delete(id); return next; });
    }
  };

  const total = items.reduce((s, e) => s + e.amount, 0);
  const totalSalaries = payments.reduce((s, p) => s + p.amount, 0);


  const eq = empSearch.toLowerCase();
  const filteredEmp = employees.filter(e => !eq || e.name.toLowerCase().includes(eq));

  // Group payments by employee for summary
  const paymentsByEmp = employees.map(emp => {
    const empPayments = payments.filter(p => p.employee_id === emp.id);
    const totalPaid = empPayments.reduce((s, p) => s + p.amount, 0);
    return { ...emp, payments: empPayments, totalPaid };
  });

  return (
    <div>
      {confirmDialog}
      <div className="page-header">
        <h2>Depenses & Employes</h2>
        <span className="subtitle">Charges d'exploitation et gestion des salaires</span>
        <div className="header-accent" />
      </div>

      {/* Tab bar */}
      <div className="credits-bar">
        <div className="credits-tabs">
          <button className={`credits-tab${tab === 'depenses' ? ' active' : ''}`} onClick={() => setTab('depenses')}>
            <span>Depenses</span>
            <span className="credits-tab-badge">{fm(total)}</span>
          </button>
          <button className={`credits-tab${tab === 'employes' ? ' active' : ''}`} onClick={() => setTab('employes')}>
            <span>Employes & Salaires</span>
            <span className="credits-tab-badge">{fm(totalSalaries)}</span>
          </button>
        </div>
      </div>

      {/* ════ DEPENSES TAB ════ */}
      {tab === 'depenses' && (
        <>
          <div className="page-toolbar">
            <div className="search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Rechercher…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
            </div>
            <span className="badge">{totalItems} depenses</span>
            <div className="toolbar-spacer" />
            <button className="btn btn-primary" onClick={openCreate}>
              + Nouvelle depense
            </button>
          </div>

          <Modal open={showForm} onClose={closeForm} title={editingId ? 'Modifier depense' : 'Nouvelle depense'}>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Designation</label>
                  <SearchableSelect
                    options={expenseDesignations.map(d => ({ value: d.name, label: d.name }))}
                    value={form.designation}
                    onChange={v => setForm({ ...form, designation: v })}
                    placeholder="Choisir ou ajouter"
                    required
                    creatable
                    onCreate={async (name) => { await addExpenseDesignation(name); }}
                  />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Montant</label>
                  <input type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} required />
                </div>
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
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={closeForm}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : editingId ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          <div className="card-table">
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Designation</th>
                    <th>Boutique</th>
                    <th className="text-right">Montant</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 && (
                    <tr><td colSpan={5}>
                      <div className="empty-state">
                        <div className="empty-icon">
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>
                        </div>
                        <div className="empty-title">Aucune depense</div>
                        <div className="empty-desc">Enregistrez vos charges d'exploitation ici.</div>
                      </div>
                    </td></tr>
                  )}
                  {items.map(e => (
                    <tr key={e.id}>
                      <td className="col-mono">{e.date}</td>
                      <td className="col-bold">{e.designation}</td>
                      <td>{e.boutique_name}</td>
                      <td className="text-right col-mono col-bold">{fm(e.amount)}</td>
                      <td>
                        <div className="row-actions">
                          <button className="btn-icon" title="Modifier" onClick={() => openEdit(e)}>{EditIcon}</button>
                          <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDelete(e.id)}>{TrashIcon}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination total={totalItems} page={page} onPageChange={setPage} />
            </div>
          </div>
        </>
      )}

      {/* ════ EMPLOYES & SALAIRES TAB ════ */}
      {tab === 'employes' && (
        <>
          <div className="page-toolbar">
            <div className="search-input-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input type="text" placeholder="Rechercher employe…" value={empSearch} onChange={e => { setEmpSearch(e.target.value); setEmpPage(1); }} />
            </div>
            <span className="badge">{employees.length} employes</span>
            <div className="toolbar-spacer" />
            <button className="btn btn-secondary btn-sm" onClick={() => openPayForm()}>+ Paiement salaire</button>
            <button className="btn btn-primary" onClick={openCreateEmp}>+ Nouvel employe</button>
          </div>

          {/* Employee Form Modal */}
          <Modal open={showEmpForm} onClose={closeEmpForm} title={editingEmpId ? 'Modifier employe' : 'Nouvel employe'}>
            <form onSubmit={handleEmpSubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Nom</label>
                  <input type="text" value={empForm.name} onChange={e => setEmpForm({ ...empForm, name: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Salaire mensuel</label>
                  <input type="number" step="0.01" min="0" value={empForm.monthlySalary} onChange={e => setEmpForm({ ...empForm, monthlySalary: e.target.value })} required />
                </div>
                <div className="form-group">
                  <label>Date debut</label>
                  <input type="date" value={empForm.startDate} onChange={e => setEmpForm({ ...empForm, startDate: e.target.value })} required />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={closeEmpForm}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : editingEmpId ? 'Modifier' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          {/* Salary Payment Modal */}
          <Modal open={showPayForm} onClose={() => { setShowPayForm(false); resetPayForm(); }} title="Enregistrer un paiement de salaire">
            <form onSubmit={handlePaySubmit}>
              <div className="form-row">
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Employe</label>
                  <select value={payForm.employeeId} onChange={e => {
                    const emp = employees.find(em => em.id === e.target.value);
                    setPayForm({ ...payForm, employeeId: e.target.value, amount: emp ? String(emp.monthly_salary / 100) : payForm.amount });
                  }} required>
                    <option value="">-- Choisir --</option>
                    {employees.filter(e => e.is_active).map(e => (
                      <option key={e.id} value={e.id}>{e.name} ({fm(e.monthly_salary)}/mois)</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>Date</label>
                  <input type="date" value={payForm.date} onChange={e => setPayForm({ ...payForm, date: e.target.value })} required />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>Montant</label>
                  <input type="number" step="0.01" min="0" value={payForm.amount} onChange={e => setPayForm({ ...payForm, amount: e.target.value })} required />
                </div>
                <div className="form-group" style={{ flex: 2 }}>
                  <label>Note (optionnel)</label>
                  <input type="text" value={payForm.note} onChange={e => setPayForm({ ...payForm, note: e.target.value })} placeholder="Ex: Salaire mars 2026" />
                </div>
              </div>
              <div className="form-actions">
                <button type="button" className="btn btn-cancel" onClick={() => { setShowPayForm(false); resetPayForm(); }}>Annuler</button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'En cours...' : 'Enregistrer'}</button>
              </div>
            </form>
          </Modal>

          {/* Employee cards with payment history */}
          {filteredEmp.length === 0 && (
            <div className="card-table">
              <div className="empty-state" style={{ padding: '32px 16px' }}>
                <div className="empty-title">Aucun employe</div>
                <div className="empty-desc">Ajoutez vos employes pour suivre les salaires.</div>
              </div>
            </div>
          )}
          {paginate(filteredEmp, empPage).map(emp => {
            const info = paymentsByEmp.find(p => p.id === emp.id);
            const empPayments = info?.payments || [];
            const totalPaid = info?.totalPaid || 0;
            return (
              <div key={emp.id} className="card-table" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{emp.name}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      Salaire: {fm(emp.monthly_salary)} / mois &middot; Debut: {emp.start_date}
                      {!emp.is_active && <span style={{ color: 'var(--danger)', marginLeft: 8 }}>Inactif</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 13, fontFamily: 'var(--font-mono)', fontWeight: 600 }}>Total paye: {fm(totalPaid)}</div>
                  </div>
                  <div className="row-actions">
                    <button className="btn btn-secondary btn-sm" onClick={() => openPayForm(emp.id)}>+ Paiement</button>
                    <button className="btn-icon" title="Modifier" onClick={() => openEditEmp(emp)}>{EditIcon}</button>
                    <button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDeleteEmp(emp.id)}>{TrashIcon}</button>
                  </div>
                </div>
                {empPayments.length > 0 && (
                  <table className="data-table" style={{ marginBottom: 0 }}>
                    <thead>
                      <tr><th>Date</th><th>Note</th><th className="text-right">Montant</th><th style={{ width: 40 }}></th></tr>
                    </thead>
                    <tbody>
                      {empPayments.map(p => (
                        <tr key={p.id}>
                          <td className="col-mono">{p.date}</td>
                          <td className="text-muted">{p.note || '—'}</td>
                          <td className="text-right col-mono col-bold">{fm(p.amount)}</td>
                          <td><button className="btn-icon btn-icon-danger" title="Supprimer" onClick={() => handleDeletePay(p.id)}>{TrashIcon}</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
          <Pagination total={filteredEmp.length} page={empPage} onPageChange={setEmpPage} />
        </>
      )}
    </div>
  );
}

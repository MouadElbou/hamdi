import React, { useEffect, useState } from 'react';
import { useToast } from '../components/Toast.js';

interface CompanyProfileRow {
  name?: string; address?: string; phone?: string; email?: string;
  ice?: string; rc?: string; if_num?: string; patente?: string; cnss?: string;
  rib?: string; bank_name?: string; footer_note?: string; logo?: string; thermal_printer?: string;
}

const EMPTY = {
  name: '', address: '', phone: '', email: '', ice: '', rc: '', ifNum: '', patente: '', cnss: '',
  rib: '', bankName: '', footerNote: '', logo: '', thermalPrinter: '',
};

export function CompanyProfilePage(): React.JSX.Element {
  const { addToast } = useToast();
  const [form, setForm] = useState({ ...EMPTY });
  const [printers, setPrinters] = useState<Array<{ name: string; displayName?: string }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    window.api.company.get().then((r: unknown) => {
      const c = r as CompanyProfileRow | null;
      if (c) setForm({
        name: c.name || '', address: c.address || '', phone: c.phone || '', email: c.email || '',
        ice: c.ice || '', rc: c.rc || '', ifNum: c.if_num || '', patente: c.patente || '', cnss: c.cnss || '',
        rib: c.rib || '', bankName: c.bank_name || '', footerNote: c.footer_note || '',
        logo: c.logo || '', thermalPrinter: c.thermal_printer || '',
      });
    }).catch(() => addToast('Erreur lors du chargement du profil', 'error'));
    window.api.documents.listPrinters()
      .then((r: unknown) => setPrinters((r as Array<{ name: string; displayName?: string }>) || []))
      .catch(() => { /* printing not wired / no printers — optional */ });
  }, []);

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleLogo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 400_000) { addToast('Logo trop volumineux (max ~400 Ko)', 'error'); return; }
    const reader = new FileReader();
    reader.onload = () => set('logo', reader.result as string);
    reader.onerror = () => addToast('Erreur de lecture du logo', 'error');
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    try {
      await window.api.company.save({ ...form });
      addToast('Profil entreprise enregistré', 'success');
    } catch (err) {
      addToast((err as Error).message || "Erreur lors de l'enregistrement", 'error');
    } finally { setSaving(false); }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Société</h2>
        <span className="subtitle">Informations imprimées sur les documents (factures, devis, bons de livraison, tickets)</span>
        <div className="header-accent" />
      </div>

      <div className="card-table" style={{ padding: 20, maxWidth: 980 }}>
        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}><label>Nom / Raison sociale</label><input value={form.name} onChange={e => set('name', e.target.value)} placeholder="HAMDI PC" /></div>
          <div className="form-group"><label>Téléphone</label><input value={form.phone} onChange={e => set('phone', e.target.value)} /></div>
          <div className="form-group"><label>Email</label><input value={form.email} onChange={e => set('email', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}><label>Adresse</label><input value={form.address} onChange={e => set('address', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>ICE</label><input value={form.ice} onChange={e => set('ice', e.target.value)} /></div>
          <div className="form-group"><label>RC</label><input value={form.rc} onChange={e => set('rc', e.target.value)} /></div>
          <div className="form-group"><label>IF</label><input value={form.ifNum} onChange={e => set('ifNum', e.target.value)} /></div>
          <div className="form-group"><label>Patente</label><input value={form.patente} onChange={e => set('patente', e.target.value)} /></div>
          <div className="form-group"><label>CNSS</label><input value={form.cnss} onChange={e => set('cnss', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label>RIB</label><input value={form.rib} onChange={e => set('rib', e.target.value)} /></div>
          <div className="form-group"><label>Banque</label><input value={form.bankName} onChange={e => set('bankName', e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}><label>Note de bas de page (conditions, mentions légales…)</label><input value={form.footerNote} onChange={e => set('footerNote', e.target.value)} placeholder="Merci de votre confiance" /></div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label>Logo</label>
            <input type="file" accept="image/png,image/jpeg" onChange={handleLogo} />
            {form.logo && (
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
                <img src={form.logo} alt="logo" style={{ maxHeight: 56, maxWidth: 180, objectFit: 'contain', background: '#fff', padding: 4, borderRadius: 6 }} />
                <button type="button" className="btn btn-secondary btn-sm" onClick={() => set('logo', '')}>Retirer</button>
              </div>
            )}
          </div>
          <div className="form-group">
            <label>Imprimante ticket (80mm)</label>
            <select className="toolbar-filter" value={form.thermalPrinter} onChange={e => set('thermalPrinter', e.target.value)}>
              <option value="">Imprimante par défaut</option>
              {printers.map(p => <option key={p.name} value={p.name}>{p.displayName || p.name}</option>)}
            </select>
          </div>
        </div>
        <div className="form-actions">
          <button className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Enregistrement…' : 'Enregistrer'}</button>
        </div>
      </div>
    </div>
  );
}

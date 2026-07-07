'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/lib/cart';

// Real WhatsApp business line (the 0536… number is a landline, not WhatsApp).
const WA_PHONE = process.env['NEXT_PUBLIC_STORE_PHONE'] ?? '212622265053';

const CAT_STYLE: Record<string, { icon: string; color: string }> = {
  'Écrans & Dalles': { icon: 'desktop_windows', color: '#0014bd' },
  'Batteries': { icon: 'battery_full', color: '#00897b' },
  'Chargeurs & Adaptateurs': { icon: 'power', color: '#6d28d9' },
  'Claviers & Touches': { icon: 'keyboard', color: '#2a39d4' },
  'PC Portables': { icon: 'laptop_mac', color: '#0277bd' },
  'PC de Bureau & Composants': { icon: 'memory', color: '#455a64' },
  'Impression & Scan': { icon: 'print', color: '#00695c' },
  'Réseau & Connectique': { icon: 'router', color: '#1565c0' },
  'Périphériques & Accessoires': { icon: 'mouse', color: '#5e35b1' },
  'Multimédia & Audio': { icon: 'headphones', color: '#ad1457' },
  'Sécurité & Surveillance': { icon: 'security', color: '#2e7d32' },
  'Gaming': { icon: 'sports_esports', color: '#c62828' },
  'Services & Réparation': { icon: 'build', color: '#ef6c00' },
};
const catStyle = (c: string) => CAT_STYLE[c] ?? { icon: 'memory', color: '#0014bd' };
const fmt = (c: number) => (c / 100).toLocaleString('fr-FR', { maximumFractionDigits: 0 });
const sym = (name: string, cls = '') => <span className={`material-symbols-outlined ${cls}`}>{name}</span>;

export function CartView(): React.JSX.Element {
  const { items, removeItem, updateQuantity, clearCart, totalItems } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [city, setCity] = useState('');
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<{ name?: string; phone?: string }>({});
  const [sent, setSent] = useState(false);

  const { total, hasAsk } = useMemo(() => {
    let t = 0; let ask = false;
    for (const it of items) { if (it.price != null) t += it.price * it.quantity; else ask = true; }
    return { total: t, hasAsk: ask };
  }, [items]);

  if (items.length === 0) {
    return (
      <div className="text-center py-20 md:py-28">
        <div className="w-24 h-24 rounded-full bg-surface-container text-primary grid place-items-center mx-auto mb-6">
          <span className="material-symbols-outlined text-5xl">shopping_cart</span>
        </div>
        <h3 className="font-headline font-black text-2xl text-on-surface mb-2">Votre panier est vide</h3>
        <p className="text-on-surface-variant mb-8 max-w-sm mx-auto">Parcourez le catalogue et ajoutez les pièces dont vous avez besoin — vous commanderez en un message WhatsApp.</p>
        <Link href="/catalogue" className="inline-flex items-center gap-2 primary-gradient text-white px-8 py-4 rounded-xl font-headline font-bold hover:scale-105 transition-transform">
          {sym('grid_view')} Explorer le catalogue
        </Link>
      </div>
    );
  }

  function buildMessage(): string {
    const d = new Date();
    const ref = `CMD-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(Math.floor(d.getTime() / 1000) % 10000).padStart(4, '0')}`;
    const lines = items.map((it, i) => {
      const detail = it.price != null
        ? `   ${it.quantity} × ${fmt(it.price)} DH = ${fmt(it.price * it.quantity)} DH`
        : `   Qté ${it.quantity} — Sur demande`;
      return `${i + 1}. ${it.designation}\n${detail}`;
    });
    const parts = [
      '🛒 *NOUVELLE COMMANDE — HAMDI PC*',
      `Réf : ${ref}`,
      '',
      `👤 Client : ${name.trim()}`,
      `📞 Téléphone : ${phone.trim()}`,
      city.trim() ? `📍 Ville / Adresse : ${city.trim()}` : null,
      '',
      `🧾 *Articles (${totalItems})*`,
      ...lines,
      '',
      `💰 *TOTAL : ${fmt(total)} DH*${hasAsk ? ' (+ articles sur demande)' : ''}`,
      note.trim() ? `\n📝 Note : ${note.trim()}` : null,
      '',
      'Merci de confirmer la disponibilité et le prix final. 🙏',
    ].filter((x): x is string => x != null);
    return parts.join('\n');
  }

  function handleCheckout() {
    const errs: { name?: string; phone?: string } = {};
    if (!name.trim()) errs.name = 'Votre nom est requis';
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) errs.phone = 'Numéro de téléphone invalide';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const url = `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(buildMessage())}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setSent(true);
  }

  const field = 'w-full bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-body text-sm text-on-surface outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition';

  return (
    <div className="grid lg:grid-cols-[1fr_390px] gap-8 py-12 items-start">
      {/* items */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <span className="font-label text-sm text-on-surface-variant uppercase tracking-widest">{totalItems} article{totalItems > 1 ? 's' : ''}</span>
          <button onClick={clearCart} className="text-sm font-headline font-bold text-error/80 hover:text-error transition inline-flex items-center gap-1.5">{sym('delete_sweep', 'text-[18px]')} Vider</button>
        </div>
        <div className="space-y-3">
          {items.map((item) => {
            const cs = catStyle(item.category);
            return (
              <div key={item.lotId} className="flex items-center gap-4 bg-surface-container-lowest ghost-border rounded-xl p-3 sm:p-4">
                <div className="w-14 h-14 shrink-0 rounded-lg grid place-items-center" style={{ background: `linear-gradient(135deg, ${cs.color}18, ${cs.color}0c)` }}>
                  <span className="material-symbols-outlined" style={{ color: cs.color }}>{cs.icon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <span className="block text-[10px] font-label uppercase tracking-widest mb-0.5" style={{ color: cs.color }}>{item.category}</span>
                  <h3 className="font-headline font-bold text-sm text-on-surface leading-snug line-clamp-2">{item.designation}</h3>
                  <span className="text-xs text-on-surface-variant">{item.price != null ? `${fmt(item.price)} DH / unité` : 'Prix sur demande'}</span>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-1 bg-surface-container rounded-lg p-0.5">
                    <button onClick={() => updateQuantity(item.lotId, item.quantity - 1)} className="w-7 h-7 grid place-items-center rounded-md text-primary hover:bg-surface-container-high transition" aria-label="Diminuer">{sym('remove', 'text-[16px]')}</button>
                    <span className="min-w-6 text-center font-headline font-bold text-sm text-on-surface">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.lotId, item.quantity + 1)} className="w-7 h-7 grid place-items-center rounded-md text-primary hover:bg-surface-container-high transition" aria-label="Augmenter">{sym('add', 'text-[16px]')}</button>
                  </div>
                  {item.price != null && <span className="font-headline font-black text-primary text-sm">{fmt(item.price * item.quantity)} DH</span>}
                  <button onClick={() => removeItem(item.lotId)} className="text-on-surface-variant/60 hover:text-error transition" aria-label="Retirer">{sym('close', 'text-[18px]')}</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* summary + checkout */}
      <div className="lg:sticky lg:top-24 space-y-5">
        <div className="bg-surface-container-lowest ghost-border rounded-2xl p-6">
          <h3 className="font-headline font-black text-lg text-on-surface mb-4">Récapitulatif</h3>
          <div className="flex justify-between text-sm mb-2"><span className="text-on-surface-variant">Articles</span><span className="font-medium text-on-surface">{totalItems}</span></div>
          <div className="flex justify-between items-end pt-3 mt-3 border-t border-outline-variant/50">
            <span className="font-headline font-bold text-on-surface">Total</span>
            <span className="font-headline font-black text-2xl text-primary">{fmt(total)} DH</span>
          </div>
          {hasAsk && <p className="text-xs text-on-surface-variant mt-2">+ certains articles au prix sur demande (confirmés sur WhatsApp).</p>}
        </div>

        <div className="bg-surface-container-lowest ghost-border rounded-2xl p-6 space-y-4">
          <h3 className="font-headline font-black text-lg text-on-surface">Vos coordonnées</h3>
          <div>
            <input className={field} placeholder="Nom complet *" value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((x) => ({ ...x, name: undefined })); }} maxLength={80} />
            {errors.name && <span className="text-error text-xs mt-1 block">{errors.name}</span>}
          </div>
          <div>
            <input className={field} placeholder="Téléphone * (ex : +212 6XX XXX XXX)" value={phone} onChange={(e) => { setPhone(e.target.value); if (errors.phone) setErrors((x) => ({ ...x, phone: undefined })); }} maxLength={20} inputMode="tel" />
            {errors.phone && <span className="text-error text-xs mt-1 block">{errors.phone}</span>}
          </div>
          <input className={field} placeholder="Ville / Adresse de livraison" value={city} onChange={(e) => setCity(e.target.value)} maxLength={120} />
          <textarea className={`${field} resize-none`} rows={2} placeholder="Note (modèle exact, précisions…)" value={note} onChange={(e) => setNote(e.target.value)} maxLength={400} />
        </div>

        <button onClick={handleCheckout} className="w-full flex items-center justify-center gap-2.5 bg-whatsapp text-white rounded-xl py-4 font-headline font-bold text-base hover:brightness-95 active:scale-[0.99] transition shadow-lg shadow-whatsapp/30">
          <span className="material-symbols-outlined" style={{ fontVariationSettings: "'FILL' 1" }}>chat</span>
          Commander sur WhatsApp
        </button>

        {sent && (
          <div className="flex items-start gap-2.5 bg-whatsapp/10 border border-whatsapp/40 rounded-xl p-3.5 text-sm text-on-surface">
            {sym('check_circle', 'text-whatsapp')}
            <span>WhatsApp s'est ouvert avec le détail de votre commande. Envoyez le message pour finaliser — le magasin confirmera dispo &amp; prix.</span>
          </div>
        )}

        <div className="flex items-start gap-2.5 text-xs text-on-surface-variant leading-relaxed">
          {sym('lock', 'text-[16px] text-on-surface-variant')}
          <span><strong className="text-on-surface">Aucun paiement en ligne.</strong> Votre commande part par WhatsApp avec tous les détails ; vous réglez directement avec le magasin à la confirmation.</span>
        </div>
      </div>
    </div>
  );
}

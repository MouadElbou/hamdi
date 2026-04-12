import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

interface Supplier { id: string; code: string }
interface Boutique { id: string; name: string }
interface Category { id: string; name: string }
interface SubCategory { id: string; name: string; category_id: string }
interface RefItem { id: string; name: string }
interface Tariff { id: string; label: string; particuliers_price: number | null; rev_price: number | null }

interface ReferenceData {
  suppliers: Supplier[];
  boutiques: Boutique[];
  categories: Category[];
  subCategories: SubCategory[];
  maintenanceTypes: RefItem[];
  expenseDesignations: RefItem[];
  batteryTariffs: Tariff[];
  loadError: string | null;
  addSupplier: (code: string) => Promise<Supplier>;
  addBoutique: (name: string) => Promise<Boutique>;
  addCategory: (name: string) => Promise<Category>;
  addSubCategory: (name: string, categoryId: string) => Promise<SubCategory>;
  addMaintenanceType: (name: string) => Promise<RefItem>;
  addExpenseDesignation: (name: string) => Promise<RefItem>;
  refreshTariffs: () => void;
}

const ReferenceDataContext = createContext<ReferenceData | null>(null);

export function ReferenceDataProvider({ children }: { children: React.ReactNode }): React.JSX.Element {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [boutiques, setBoutiques] = useState<Boutique[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [subCategories, setSubCategories] = useState<SubCategory[]>([]);
  const [maintenanceTypes, setMaintenanceTypes] = useState<RefItem[]>([]);
  const [expenseDesignations, setExpenseDesignations] = useState<RefItem[]>([]);
  const [batteryTariffs, setBatteryTariffs] = useState<Tariff[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadAll = useCallback(() => {
    setLoadError(null);
    Promise.allSettled([
      window.api.suppliers.list(),
      window.api.boutiques.list(),
      window.api.categories.list(),
      window.api.subCategories.list(),
      window.api.maintenanceTypes.list(),
      window.api.expenseDesignations.list(),
      window.api.batteryRepair.tariffs(),
    ]).then(([suppRes, boutRes, catRes, subCatRes, mtRes, edRes, btRes]) => {
      const errors: string[] = [];
      if (suppRes.status === 'fulfilled') setSuppliers(suppRes.value as Supplier[]);
      else errors.push('suppliers');
      if (boutRes.status === 'fulfilled') setBoutiques(boutRes.value as Boutique[]);
      else errors.push('boutiques');
      if (catRes.status === 'fulfilled') setCategories(catRes.value as Category[]);
      else errors.push('categories');
      if (subCatRes.status === 'fulfilled') setSubCategories(subCatRes.value as SubCategory[]);
      else errors.push('subCategories');
      if (mtRes.status === 'fulfilled') setMaintenanceTypes(mtRes.value as RefItem[]);
      else errors.push('maintenanceTypes');
      if (edRes.status === 'fulfilled') setExpenseDesignations(edRes.value as RefItem[]);
      else errors.push('expenseDesignations');
      if (btRes.status === 'fulfilled') setBatteryTariffs(btRes.value as Tariff[]);
      else errors.push('batteryTariffs');
      if (errors.length > 0) {
        setLoadError(`Failed to load: ${errors.join(', ')}`);
      }
    });
  }, []);

  useEffect(loadAll, [loadAll]);

  const addSupplier = useCallback(async (code: string): Promise<Supplier> => {
    const result = await window.api.suppliers.create({ code }) as Supplier;
    setSuppliers(prev => {
      if (prev.some(s => s.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.code.localeCompare(b.code));
    });
    return result;
  }, []);

  const addBoutique = useCallback(async (name: string): Promise<Boutique> => {
    const result = await window.api.boutiques.create({ name }) as Boutique;
    setBoutiques(prev => {
      if (prev.some(b => b.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, []);

  const addCategory = useCallback(async (name: string): Promise<Category> => {
    const result = await window.api.categories.create({ name }) as Category;
    setCategories(prev => {
      if (prev.some(c => c.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, []);

  const addSubCategory = useCallback(async (name: string, categoryId: string): Promise<SubCategory> => {
    const result = await window.api.subCategories.create({ name, categoryId }) as SubCategory;
    setSubCategories(prev => {
      if (prev.some(sc => sc.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, []);

  const addMaintenanceType = useCallback(async (name: string): Promise<RefItem> => {
    const result = await window.api.maintenanceTypes.create({ name }) as RefItem;
    setMaintenanceTypes(prev => {
      if (prev.some(t => t.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, []);

  const addExpenseDesignation = useCallback(async (name: string): Promise<RefItem> => {
    const result = await window.api.expenseDesignations.create({ name }) as RefItem;
    setExpenseDesignations(prev => {
      if (prev.some(d => d.id === result.id)) return prev;
      return [...prev, result].sort((a, b) => a.name.localeCompare(b.name));
    });
    return result;
  }, []);

  const refreshTariffs = useCallback(() => {
    window.api.batteryRepair.tariffs().then(r => setBatteryTariffs(r as Tariff[])).catch(err => console.error('[ReferenceData] Failed to refresh tariffs:', err));
  }, []);

  return (
    <ReferenceDataContext.Provider value={{
      suppliers, boutiques, categories, subCategories, maintenanceTypes, expenseDesignations, batteryTariffs, loadError,
      addSupplier, addBoutique, addCategory, addSubCategory, addMaintenanceType, addExpenseDesignation, refreshTariffs,
    }}>
      {children}
    </ReferenceDataContext.Provider>
  );
}

export function useReferenceData(): ReferenceData {
  const ctx = useContext(ReferenceDataContext);
  if (!ctx) throw new Error('useReferenceData must be used within ReferenceDataProvider');
  return ctx;
}

import React from 'react';

const BRANDS = [
  'Apple', 'Samsung', 'Xiaomi', 'Huawei', 'Dell',
  'HP', 'Lenovo', 'Sony', 'Asus', 'Acer',
];

export function BrandBar(): React.JSX.Element {
  // Duplicate for seamless infinite scroll
  const doubled = [...BRANDS, ...BRANDS];

  return (
    <section className="brand-bar">
      <div className="container">
        <div className="section-header">
          <div className="section-header-left">
            <span className="section-label">Partenaires</span>
            <h2 className="section-title">Nos Marques</h2>
          </div>
        </div>
        <div className="brand-list">
          {doubled.map((name, i) => (
            <div key={`${name}-${i}`} className="brand-item" title={name}>
              <span className="brand-name">{name}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

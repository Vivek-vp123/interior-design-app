import React from 'react';

export default function ModelPicker({ models, onSelect, selectedId }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
      {models.map((model) => (
        <div
          key={model.id}
          onClick={() => onSelect(model)}
          style={{
            border: selectedId === model.id ? '2px solid #6366f1' : '2px solid #eee',
            borderRadius: 12,
            padding: 8,
            cursor: 'pointer',
            width: 140,
            background: selectedId === model.id ? 'rgba(99,102,241,0.08)' : '#fff',
            boxShadow: selectedId === model.id ? '0 2px 8px #6366f133' : '0 1px 4px #0001',
            transition: 'all 0.2s',
            textAlign: 'center',
          }}
        >
          <img
            src={model.image}
            alt={model.title}
            style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 8 }}
          />
          <div style={{ fontWeight: 600, fontSize: 15 }}>{model.title}</div>
          <div style={{ fontSize: 13, color: '#666', margin: '4px 0' }}>{model.category}</div>
          <div style={{ fontSize: 13, color: '#888' }}>{model.price}</div>
        </div>
      ))}
    </div>
  );
}

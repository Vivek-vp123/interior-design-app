import React, { useState } from 'react';

export default function ARTutorial({ onClose }) {
  const [step, setStep] = useState(0);
  const steps = [
    {
      title: 'Welcome to AR Placement!',
      text: 'You can preview furniture and decor in your real space using your camera. Let’s get started!'
    },
    {
      title: '1. Select a Model',
      text: 'Choose a furniture or decor item from the catalog above.'
    },
    {
      title: '2. Calibrate for Real Size',
      text: 'Tap “Calibrate Scale”, then tap two points in your room with a known distance (e.g., door width), enter the distance, and set. This ensures accurate placement.'
    },
    {
      title: '3. Place and Preview',
      text: 'Drag, scale, and rotate the item to see how it fits. On supported devices, use the AR icon for native AR.'
    },
    {
      title: 'All set!',
      text: 'You’re ready to design your space. You can revisit this tutorial anytime.'
    }
  ];
  return (
    <div style={{ position: 'fixed', zIndex: 1000, left: 0, top: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.65)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: 32, maxWidth: 340, width: '90%', boxShadow: '0 4px 32px #0003', textAlign: 'center' }}>
        <h2 style={{ fontSize: 22, marginBottom: 12 }}>{steps[step].title}</h2>
        <div style={{ fontSize: 16, color: '#444', marginBottom: 24 }}>{steps[step].text}</div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          {step > 0 && <button onClick={() => setStep(step - 1)} style={btnStyle}>Back</button>}
          {step < steps.length - 1 && <button onClick={() => setStep(step + 1)} style={btnStyle}>Next</button>}
          {step === steps.length - 1 && <button onClick={onClose} style={btnStyle}>Finish</button>}
        </div>
      </div>
    </div>
  );
}

const btnStyle = {
  padding: '8px 18px',
  borderRadius: 8,
  border: 'none',
  background: '#6366f1',
  color: '#fff',
  fontWeight: 600,
  fontSize: 15,
  cursor: 'pointer',
};

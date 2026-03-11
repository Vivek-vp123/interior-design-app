import React, { useEffect, useState } from 'react'
import Layout from '../components/Layout'
import ARPlacement from '../components/ARPlacement'
import ModelPicker from '../components/ModelPicker'
import ARTutorial from '../components/ARTutorial'
import API from '../lib/api'

export default function ARPage() {
  // For demo purposes we include a sample GLB URL and a fallback image
  // Replace `modelSrc` with a real glTF/glb hosted file in production (CORS must allow access).
  const [models, setModels] = useState([])
  const [selectedModel, setSelectedModel] = useState(null)
  const [modelWidthM, setModelWidthM] = useState('')
  const [loading, setLoading] = useState(true)
  const [showTutorial, setShowTutorial] = useState(() => {
    // Show tutorial only for first-time users (localStorage flag)
    if (typeof window !== 'undefined') {
      return !localStorage.getItem('ar_tutorial_seen');
    }
    return false;
  });
  // Mark tutorial as seen
  const handleTutorialClose = () => {
    setShowTutorial(false);
    if (typeof window !== 'undefined') {
      localStorage.setItem('ar_tutorial_seen', '1');
    }
  };

  useEffect(() => {
    // Fetch catalog from backend
    async function fetchModels() {
      try {
        const res = await API.get('/user/catalog');
        setModels(res.data || []);
        setLoading(false);
      } catch (err) {
        // fallback to static
        setModels([
          {
            id: 1,
            title: 'Modern Sectional Sofa',
            desc: 'A sleek grey fabric sectional for a neutral palette.',
            image: 'https://picsum.photos/400/300?random=101',
            price: '$1299',
            category: 'Furniture',
            modelUrl: '/models/sofa.glb',
            fallbackImage: 'https://picsum.photos/400/300?random=101',
            realWidthM: 2.2
          },
          {
            id: 2,
            title: 'Reclaimed Wood Coffee Table',
            desc: 'Natural oak finish with industrial metal legs.',
            image: 'https://picsum.photos/400/300?random=102',
            price: '$449',
            category: 'Furniture',
            modelUrl: '/models/table.glb',
            fallbackImage: 'https://picsum.photos/400/300?random=102',
            realWidthM: 1.1
          },
          {
            id: 3,
            title: 'Ambient Floor Lamp',
            desc: 'Minimalist arc floor lamp with warm LED lighting.',
            image: 'https://picsum.photos/400/300?random=103',
            price: '$229',
            category: 'Lighting',
            modelUrl: '/models/lamp.glb',
            fallbackImage: 'https://picsum.photos/400/300?random=103',
            realWidthM: 0.4
          }
        ]);
        setLoading(false);
      }
    }
    fetchModels();
  }, []);

  return (
    <Layout>
      {showTutorial && <ARTutorial onClose={handleTutorialClose} />}
      <div style={{ maxWidth: 980, margin: '24px auto', padding: '0 16px' }}>
        <h1>AR Placement</h1>
        <p style={{ color: '#444', fontSize: 16, marginBottom: 16 }}>Select a furniture or decor item below, then see it placed in your real space using your camera. Use calibration for real-world scale.</p>

        {loading ? <div>Loading models...</div> : (
          <ModelPicker
            models={models}
            onSelect={m => {
              setSelectedModel(m);
              setModelWidthM(m.realWidthM ? String(m.realWidthM) : '');
            }}
            selectedId={selectedModel?.id}
          />
        )}

        {selectedModel && (
          <div style={{ marginBottom: 16, fontSize: 15, color: '#333' }}>
            <strong>Selected:</strong> {selectedModel.title} — {selectedModel.category} — {selectedModel.price}
            <div style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{selectedModel.desc}</div>
          </div>
        )}

        <div style={{ marginBottom: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
          <input placeholder="Model real width (meters) e.g. 1.2" value={modelWidthM} onChange={e=>setModelWidthM(e.target.value)} style={{ width: 220, padding: 8 }} />
          <div style={{ color: '#666', fontSize: 13 }}>Set the real-world width of your model for accurate AR placement.</div>
        </div>

        <ARPlacement
          modelSrc={selectedModel?.modelUrl || '/models/sample.glb'}
          fallbackImageSrc={selectedModel?.fallbackImage || selectedModel?.image || '/images/sample-furniture.png'}
          alt={selectedModel?.title || 'item'}
          modelRealWidthMeters={parseFloat(modelWidthM) || null}
        />

        <div style={{ marginTop: 12, fontSize: 14, color: '#555' }}>
          <strong>How it works:</strong>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>Select a model to place in your space.</li>
            <li>On supported devices, tap the AR icon for native AR (WebXR/Scene Viewer/Quick Look).</li>
            <li>On other devices, use the camera overlay and calibrate for real size.</li>
            <li>Drag, scale, and rotate the item to preview placement.</li>
            <li>Use the "Calibrate Scale" button to match real-world measurements.</li>
          </ul>
        </div>
      </div>
    </Layout>
  )
}

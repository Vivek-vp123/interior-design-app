import React, { useEffect, useRef, useState } from 'react'

// ARPlacement: progressive enhancement for AR placement
// - Tries to use <model-viewer> (web component) for device AR (Android Scene Viewer / iOS Quick Look / WebXR)
// - Falls back to a camera overlay with a draggable/scalable/rotatable 2D preview for devices without AR support

export default function ARPlacement({ modelSrc, fallbackImageSrc, alt = 'item', modelRealWidthMeters = null }) {
  const [canUseModelViewer, setCanUseModelViewer] = useState(false)
  const [mounted, setMounted] = useState(false)
  const videoRef = useRef(null)
  const spriteRef = useRef(null)
  const containerRef = useRef(null)

  // placement state for fallback overlay
  const [pos, setPos] = useState({ x: 0.5, y: 0.5 }) // normalized
  const [scale, setScale] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState(null)
  const overlayCanvasRef = useRef(null)
  const [roomWidthM, setRoomWidthM] = useState('')
  const [roomLengthM, setRoomLengthM] = useState('')
  const [calibrationMode, setCalibrationMode] = useState(false)
  const [calibrationPoints, setCalibrationPoints] = useState([])
  const [pixelsPerMeter, setPixelsPerMeter] = useState(null)
  const [pendingDistanceM, setPendingDistanceM] = useState('')

  useEffect(() => {
    setMounted(true)

    // load model-viewer only on client when available
    if (typeof window !== 'undefined') {
      // dynamic import of the polyfilled webcomponent if available in package
      try {
        // feature detect WebXR or model-viewer support
        const hasWebXR = !!(navigator.xr && navigator.xr.isSessionSupported)
        // We'll attempt to load model-viewer; if it registers the element, use it
        import('@google/model-viewer').then(() => {
          // model-viewer registers <model-viewer>
          // Prefer to enable it when possible - even if WebXR isn't available, model-viewer provides Quick Look/Scene Viewer fallbacks on mobile
          setCanUseModelViewer(true)
        }).catch(() => {
          // not installed or failed to load; fallback
          setCanUseModelViewer(false)
        })
      } catch (e) {
        setCanUseModelViewer(false)
      }
    }

    return () => {
      // stop camera if active
      const v = videoRef.current
      if (v && v.srcObject) {
        v.srcObject.getTracks().forEach(t => t.stop())
      }
    }
  }, [])

  useEffect(() => {
    // Start camera for fallback when model-viewer isn't usable
    if (!canUseModelViewer && mounted) {
      const startCamera = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
          if (videoRef.current) {
            videoRef.current.srcObject = stream
            videoRef.current.play().catch(() => {})
          }
        } catch (err) {
          // permission denied or no camera - leave blank
          console.warn('Camera not available for AR fallback', err)
        }
      }
      startCamera()
    }
  }, [canUseModelViewer, mounted])

  // helper: draw mask image over overlay canvas
  const drawMaskOnOverlay = async (maskUrl) => {
    try {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.src = maskUrl
      await new Promise((res, rej) => {
        img.onload = res
        img.onerror = rej
      })

      const canvas = overlayCanvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return

      // match canvas size to video display size
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`

      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // draw mask with transparency
      // scale mask to canvas size
      ctx.globalAlpha = 0.6
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      ctx.globalAlpha = 1.0
    } catch (err) {
      console.warn('Failed to draw mask overlay', err)
    }
  }

  // pointer handlers for dragging
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let dragging = false
    let last = null

    const toNormalized = (clientX, clientY) => {
      const r = el.getBoundingClientRect()
      return { x: (clientX - r.left) / r.width, y: (clientY - r.top) / r.height }
    }

    const onPointerDown = (e) => {
      // If in calibration mode, capture two points (screen coords) instead of dragging
      const rect = el.getBoundingClientRect()
      if (calibrationMode) {
        const p = { x: e.clientX - rect.left, y: e.clientY - rect.top }
        setCalibrationPoints(prev => {
          const next = [...prev, p].slice(-2)
          return next
        })
        return
      }

      dragging = true
      last = { x: e.clientX, y: e.clientY }
      ;(e.target || e.srcElement).setPointerCapture && (e.target || e.srcElement).setPointerCapture(e.pointerId)
    }

    const onPointerMove = (e) => {
      if (!dragging) return
      const n = toNormalized(e.clientX, e.clientY)
      setPos(n)
      last = { x: e.clientX, y: e.clientY }
    }

    const onPointerUp = (e) => {
      dragging = false
      last = null
    }

    el.addEventListener('pointerdown', onPointerDown)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [])

  // Watch calibration points - when two are available prompt for real distance (or show input)
  useEffect(() => {
    if (calibrationPoints.length === 2) {
      // show pending input in UI (we don't prompt here)
      // Optionally, we could prefill a sample value
    }
  }, [calibrationPoints])

  // helpers for controls
  const increaseScale = () => setScale(s => Math.min(3, s + 0.1))
  const decreaseScale = () => setScale(s => Math.max(0.1, s - 0.1))
  const rotateLeft = () => setRotation(r => r - 10)
  const rotateRight = () => setRotation(r => r + 10)

  const captureAndAnalyze = async () => {
    if (!videoRef.current) return
    setAnalyzing(true)
    try {
      // capture frame
      const vid = videoRef.current
      const cw = vid.videoWidth || vid.clientWidth
      const ch = vid.videoHeight || vid.clientHeight
      const c = document.createElement('canvas')
      c.width = cw
      c.height = ch
      const ctx = c.getContext('2d')
      ctx.drawImage(vid, 0, 0, c.width, c.height)

      // convert to blob
      const blob = await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.9))

      // send to segmentation service (FastAPI) directly
      const SEG_URL = (process.env.NEXT_PUBLIC_SEGMENTATION_URL || 'http://localhost:8000').replace(/\/+$/, '')
      const form = new FormData()
      form.append('file', blob, 'capture.jpg')

      const resp = await fetch(`${SEG_URL}/segment`, {
        method: 'POST',
        body: form,
      })

      if (!resp.ok) throw new Error('Segmentation service returned ' + resp.status)
      const data = await resp.json()
      setAnalysisResult(data)

      // draw mask overlay
      if (data.mask_url) {
        const maskFull = data.mask_url.startsWith('/') ? `${SEG_URL}${data.mask_url}` : data.mask_url
        await drawMaskOnOverlay(maskFull)
      }
    } catch (err) {
      console.error('Analyze error', err)
      alert('Analysis failed: ' + (err.message || err))
    } finally {
      setAnalyzing(false)
    }
  }

  const confirmCalibration = () => {
    if (calibrationPoints.length < 2) return
    const el = containerRef.current
    const rect = el.getBoundingClientRect()
    const [p1, p2] = calibrationPoints
    const dx = p2.x - p1.x
    const dy = p2.y - p1.y
    const pixelDist = Math.hypot(dx, dy)
    const meters = parseFloat(pendingDistanceM)
    if (!meters || meters <= 0) {
      alert('Enter a valid distance in meters')
      return
    }
    const ppm = pixelDist / meters
    setPixelsPerMeter(ppm)
    setCalibrationMode(false)
    // clear points
    setCalibrationPoints([])
    setPendingDistanceM('')
  }

  // resize overlay canvas when container/video size changes
  useEffect(() => {
    const resizeOverlay = () => {
      const canvas = overlayCanvasRef.current
      const video = videoRef.current
      if (!canvas || !video) return
      const rect = video.getBoundingClientRect()
      canvas.width = rect.width
      canvas.height = rect.height
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
      // redraw existing mask if any
      if (analysisResult?.mask_url) {
        const SEG_URL = (process.env.NEXT_PUBLIC_SEGMENTATION_URL || 'http://localhost:8000').replace(/\/+$/, '')
        const maskFull = analysisResult.mask_url.startsWith('/') ? `${SEG_URL}${analysisResult.mask_url}` : analysisResult.mask_url
        drawMaskOnOverlay(maskFull).catch(()=>{})
      }
    }

    window.addEventListener('resize', resizeOverlay)
    const ro = new ResizeObserver(resizeOverlay)
    if (containerRef.current) ro.observe(containerRef.current)
    if (videoRef.current) ro.observe(videoRef.current)
    // initial
    setTimeout(resizeOverlay, 300)

    return () => {
      window.removeEventListener('resize', resizeOverlay)
      try { ro.disconnect() } catch(e){}
    }
  }, [analysisResult])

  // Render
  if (!mounted) return null

  // Always use model-viewer for 3D preview if AR is not available
  if (typeof window !== 'undefined') {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ marginBottom: 8 }}>
          <strong>{canUseModelViewer ? 'AR mode' : '3D Preview'}</strong> — {canUseModelViewer ? 'tap the AR icon to place the item in your environment. If your device supports Quick Look / Scene Viewer it will open the native viewer.' : 'AR is not supported on this device, but you can still view and interact with the 3D model.'}
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <model-viewer
          src={modelSrc}
          alt={alt}
          ar={canUseModelViewer}
          ar-modes="scene-viewer quick-look webxr"
          camera-controls
          style={{ width: '100%', height: '80vh', backgroundColor: '#000' }}
        />
        <div style={{ marginTop: 8, fontSize: 13, color: '#666' }}>
          {canUseModelViewer
            ? "If the AR icon doesn't appear, your device may not support native AR from the browser — the component will fall back to 3D preview."
            : "AR is not available, but you can still rotate, zoom, and inspect the 3D model here."}
        </div>
      </div>
    )
  }
}

const controlButtonStyle = {
  width: 44,
  height: 44,
  borderRadius: 8,
  border: 'none',
  background: 'rgba(255,255,255,0.9)',
  fontSize: 18,
  cursor: 'pointer'
}

const controlSmall = {
  padding: '8px 12px',
  borderRadius: 8,
  border: 'none',
  background: 'rgba(255,255,255,0.95)',
  fontSize: 14,
  cursor: 'pointer'
}

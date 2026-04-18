import React, { useEffect, useMemo, useRef, useState } from "react";

export default function ARPlacement({
  modelSrc,
  fallbackImageSrc,
  alt = "item",
  modelRealWidthMeters = null,
}) {
  const containerRef = useRef(null);
  const videoRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const gestureRef = useRef(null);
  const positionRef = useRef({ x: 0.5, y: 0.78 });
  const rotationRef = useRef(0);
  const manualScaleRef = useRef(1);

  const [mounted, setMounted] = useState(false);
  const [mode, setMode] = useState("camera");
  const [supportsModelViewer, setSupportsModelViewer] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [cameraReady, setCameraReady] = useState(false);

  const [position, setPosition] = useState({ x: 0.5, y: 0.78 });
  const [rotation, setRotation] = useState(0);
  const [manualScale, setManualScale] = useState(1);

  const [imageAspectRatio, setImageAspectRatio] = useState(1);

  const [calibrationMode, setCalibrationMode] = useState(false);
  const [calibrationPoints, setCalibrationPoints] = useState([]);
  const [calibrationDistanceM, setCalibrationDistanceM] = useState("");
  const [pixelsPerMeter, setPixelsPerMeter] = useState(null);

  useEffect(() => {
    setMounted(true);

    import("@google/model-viewer")
      .then(() => setSupportsModelViewer(true))
      .catch(() => setSupportsModelViewer(false));
  }, []);

  useEffect(() => {
    let stream;

    const stopCurrentStream = () => {
      const current = videoRef.current?.srcObject;
      if (current && current.getTracks) {
        current.getTracks().forEach((track) => track.stop());
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };

    const startCamera = async () => {
      if (!mounted || mode !== "camera") return;

      setCameraError("");
      setCameraReady(false);

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          setCameraReady(true);
        }
      } catch (err) {
        setCameraError("Camera access failed. Allow camera permission or use 3D preview.");
      }
    };

    if (mode === "camera") {
      startCamera();
    } else {
      stopCurrentStream();
    }

    return () => {
      stopCurrentStream();
    };
  }, [mounted, mode]);

  useEffect(() => {
    setPosition({ x: 0.5, y: 0.78 });
    setRotation(0);
    setManualScale(1);
  }, [fallbackImageSrc]);

  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    rotationRef.current = rotation;
  }, [rotation]);

  useEffect(() => {
    manualScaleRef.current = manualScale;
  }, [manualScale]);

  useEffect(() => {
    if (calibrationMode || mode !== "camera") {
      activePointersRef.current.clear();
      gestureRef.current = null;
    }
  }, [calibrationMode, mode]);

  const displayedWidthPx = useMemo(() => {
    if (pixelsPerMeter && modelRealWidthMeters && modelRealWidthMeters > 0) {
      return Math.max(48, pixelsPerMeter * modelRealWidthMeters * manualScale);
    }
    return 180 * manualScale;
  }, [pixelsPerMeter, modelRealWidthMeters, manualScale]);

  const displayedHeightPx = useMemo(() => {
    const ratio = imageAspectRatio > 0 ? imageAspectRatio : 1;
    return displayedWidthPx / ratio;
  }, [displayedWidthPx, imageAspectRatio]);

  const clampPosition = (x, y) => ({
    x: Math.max(0.05, Math.min(0.95, x)),
    y: Math.max(0.05, Math.min(0.95, y)),
  });

  const clampScale = (s) => Math.max(0.3, Math.min(3, s));

  const getTwoPointers = () => {
    const pts = Array.from(activePointersRef.current.values());
    if (pts.length < 2) return null;
    return [pts[0], pts[1]];
  };

  const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  const angle = (a, b) => Math.atan2(b.y - a.y, b.x - a.x);
  const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

  const initializeOnePointerGesture = (e) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    gestureRef.current = {
      kind: e.pointerType === "mouse" && e.shiftKey ? "rotate" : "move",
      startPointerId: e.pointerId,
      startPointerX: e.clientX,
      startPointerY: e.clientY,
      startPos: positionRef.current,
      startRotation: rotationRef.current,
      width: rect.width,
      height: rect.height,
    };
  };

  const initializeTwoPointerGesture = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const pair = getTwoPointers();
    if (!pair) return;
    const [p1, p2] = pair;

    const startDistance = Math.max(1, distance(p1, p2));
    const startAngle = angle(p1, p2);
    const startMid = midpoint(p1, p2);

    gestureRef.current = {
      kind: "transform",
      startDistance,
      startAngle,
      startMid,
      startPos: positionRef.current,
      startScale: manualScaleRef.current,
      startRotation: rotationRef.current,
      width: rect.width,
      height: rect.height,
    };
  };

  const onObjectPointerDown = (e) => {
    if (calibrationMode) return;
    if (e.pointerType === "mouse" && e.button !== 0) return;

    e.preventDefault();
    e.stopPropagation();

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if capture fails (Safari quirks / non-capturable targets)
    }

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const count = activePointersRef.current.size;
    if (count === 1) initializeOnePointerGesture(e);
    if (count === 2) initializeTwoPointerGesture();
  };

  const onObjectPointerMove = (e) => {
    if (calibrationMode) return;
    if (!activePointersRef.current.has(e.pointerId)) return;

    activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const state = gestureRef.current;
    if (!state) return;

    if (activePointersRef.current.size === 1 && (state.kind === "move" || state.kind === "rotate")) {
      const dx = (e.clientX - state.startPointerX) / state.width;
      const dy = (e.clientY - state.startPointerY) / state.height;

      if (state.kind === "rotate") {
        setRotation(state.startRotation + dx * 180);
      } else {
        setPosition(clampPosition(state.startPos.x + dx, state.startPos.y + dy));
      }

      return;
    }

    if (activePointersRef.current.size >= 2 && state.kind === "transform") {
      const pair = getTwoPointers();
      if (!pair) return;
      const [p1, p2] = pair;

      const currentDistance = Math.max(1, distance(p1, p2));
      const currentAngle = angle(p1, p2);
      const currentMid = midpoint(p1, p2);

      const scaleFactor = currentDistance / state.startDistance;
      setManualScale(clampScale(state.startScale * scaleFactor));

      const deltaAngleDeg = ((currentAngle - state.startAngle) * 180) / Math.PI;
      setRotation(state.startRotation + deltaAngleDeg);

      const dx = (currentMid.x - state.startMid.x) / state.width;
      const dy = (currentMid.y - state.startMid.y) / state.height;
      setPosition(clampPosition(state.startPos.x + dx, state.startPos.y + dy));
    }
  };

  const onObjectPointerUpOrCancel = (e) => {
    if (!activePointersRef.current.has(e.pointerId)) return;

    activePointersRef.current.delete(e.pointerId);

    const remainingCount = activePointersRef.current.size;
    if (remainingCount === 0) {
      gestureRef.current = null;
      return;
    }

    if (remainingCount === 1) {
      const remainingId = Array.from(activePointersRef.current.keys())[0];
      const remainingPt = activePointersRef.current.get(remainingId);
      if (!remainingPt) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      gestureRef.current = {
        kind: "move",
        startPointerId: remainingId,
        startPointerX: remainingPt.x,
        startPointerY: remainingPt.y,
        startPos: positionRef.current,
        startRotation: rotationRef.current,
        width: rect.width,
        height: rect.height,
      };
      return;
    }

    if (remainingCount >= 2) {
      initializeTwoPointerGesture();
    }
  };

  const onObjectWheel = (e) => {
    if (calibrationMode) return;
    // Make desktop adjustments possible without buttons.
    e.preventDefault();
    e.stopPropagation();

    const delta = Math.sign(e.deltaY);
    const step = e.ctrlKey ? 0.02 : 0.05;
    setManualScale((s) => clampScale(s - delta * step));
  };

  const onContainerPointerDown = (e) => {
    if (!calibrationMode) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setCalibrationPoints((prev) => {
      if (prev.length >= 2) return [{ x, y }];
      return [...prev, { x, y }];
    });
  };

  const applyCalibration = () => {
    if (calibrationPoints.length !== 2) return;

    const meters = Number(calibrationDistanceM);
    if (!meters || meters <= 0) {
      alert("Enter a valid real-world distance in meters.");
      return;
    }

    const [p1, p2] = calibrationPoints;
    const pixelDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    if (pixelDistance < 8) {
      alert("Calibration points are too close. Pick two farther points.");
      return;
    }

    setPixelsPerMeter(pixelDistance / meters);
    setCalibrationMode(false);
    setCalibrationPoints([]);
    setCalibrationDistanceM("");
  };

  const resetCalibration = () => {
    setPixelsPerMeter(null);
    setCalibrationMode(false);
    setCalibrationPoints([]);
    setCalibrationDistanceM("");
  };

  const alignToFloor = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const y = (rect.height - displayedHeightPx * 0.5 - 12) / rect.height;
    setPosition(clampPosition(position.x, y));
  };

  if (!mounted) return null;

  return (
    <div style={{ display: "grid", gap: 12 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button onClick={() => setMode("camera")} style={mode === "camera" ? activeButton : button}>
          Camera Placement
        </button>
        <button onClick={() => setMode("preview")} style={mode === "preview" ? activeButton : button}>
          3D Preview
        </button>
      </div>


      {(mode === "preview") && supportsModelViewer && (
        <div style={{ display: "grid", gap: 10 }}>
          <model-viewer
            src={modelSrc}
            alt={alt}
            camera-controls
            auto-rotate
            ar
            shadow-intensity="1"
            shadow-softness="0.5"
            loading="eager"
            poster={fallbackImageSrc}
            style={{ width: "100%", height: "72vh", background: "radial-gradient(circle at 50% 50%, #f8fafc, #e2e8f0)", borderRadius: 14 }}
          >
            <div slot="progress-bar" style={{
              position: "absolute", bottom: 0, left: 0, right: 0, height: 4,
              background: "#e2e8f0", borderRadius: "0 0 14px 14px", overflow: "hidden"
            }}>
              <div style={{
                height: "100%", background: "linear-gradient(90deg, #4f46e5, #7c3aed)",
                transition: "width 0.3s ease", width: "100%",
                animation: "loadPulse 1.5s ease-in-out infinite"
              }} />
            </div>
          </model-viewer>
          <p style={hintText}>Rotate and zoom the 3D model. Tap the AR icon in the corner if on a supported device.</p>
        </div>
      )}

      {(mode === "preview") && !supportsModelViewer && (
        <div style={{ display: "grid", gap: 10 }}>
          <div style={{ width: "100%", height: "72vh", background: "#f8fafc", borderRadius: 14, display: "grid", placeItems: "center" }}>
             <img src={fallbackImageSrc} alt={alt} style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain' }} />
          </div>
          <p style={hintText}>3D viewer is not supported on this device. Showing image fallback.</p>
        </div>
      )}

      {mode === "camera" && (
        <div style={{ display: "grid", gap: 10 }}>
          <div
            ref={containerRef}
            onPointerDown={onContainerPointerDown}
            style={{
              position: "relative",
              width: "100%",
              height: "72vh",
              borderRadius: 14,
              overflow: "hidden",
              background: "#0f172a",
              border: "1px solid #334155",
              touchAction: "none",
            }}
          >
            <video
              ref={videoRef}
              playsInline
              muted
              style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
            />
            {!cameraReady && !cameraError && (
              <div style={overlayText}>Starting camera...</div>
            )}
            {cameraError && <div style={overlayText}>{cameraError}</div>}

            {supportsModelViewer && modelSrc ? (
              <div
                onPointerDown={onObjectPointerDown}
                onPointerMove={onObjectPointerMove}
                onPointerUp={onObjectPointerUpOrCancel}
                onPointerCancel={onObjectPointerUpOrCancel}
                onWheel={onObjectWheel}
                style={{
                  position: "absolute",
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                  width: displayedWidthPx,
                  height: displayedHeightPx,
                  transform: `translate(-50%, -50%)`,
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                  zIndex: 10,
                  pointerEvents: calibrationMode ? "none" : "auto",
                }}
              >
                <div style={{ width: "100%", height: "100%", filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.35))" }}>
                  <model-viewer
                    src={modelSrc}
                    alt={alt}
                    disable-zoom
                    disable-pan
                    camera-orbit={`${rotation}deg 75deg 105%`}
                    interaction-prompt="none"
                    style={{ width: "100%", height: "100%", backgroundColor: "transparent", pointerEvents: "none" }}
                  />
                </div>
              </div>
            ) : (
              <img
                src={fallbackImageSrc}
                alt={alt}
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth && img.naturalHeight) {
                    setImageAspectRatio(img.naturalWidth / img.naturalHeight);
                  }
                }}
                onPointerDown={onObjectPointerDown}
                onPointerMove={onObjectPointerMove}
                onPointerUp={onObjectPointerUpOrCancel}
                onPointerCancel={onObjectPointerUpOrCancel}
                onWheel={onObjectWheel}
                style={{
                  position: "absolute",
                  left: `${position.x * 100}%`,
                  top: `${position.y * 100}%`,
                  width: displayedWidthPx,
                  height: displayedHeightPx,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  objectFit: "contain",
                  cursor: "grab",
                  userSelect: "none",
                  touchAction: "none",
                  filter: "drop-shadow(0 14px 18px rgba(0,0,0,0.35))",
                  pointerEvents: calibrationMode ? "none" : "auto",
                }}
                draggable={false}
              />
            )}

            {calibrationPoints.length > 0 && (
              <svg
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}
              >
                {calibrationPoints.map((p, idx) => (
                  <circle key={`${p.x}-${p.y}-${idx}`} cx={p.x} cy={p.y} r="6" fill="#f97316" />
                ))}
                {calibrationPoints.length === 2 && (
                  <line
                    x1={calibrationPoints[0].x}
                    y1={calibrationPoints[0].y}
                    x2={calibrationPoints[1].x}
                    y2={calibrationPoints[1].y}
                    stroke="#f97316"
                    strokeWidth="3"
                  />
                )}
              </svg>
            )}
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <button onClick={alignToFloor} style={button}>Align to Floor</button>
            <button onClick={() => setCalibrationMode((v) => !v)} style={calibrationMode ? activeButton : button}>
              {calibrationMode ? "Stop Calibrate" : "Calibrate Scale"}
            </button>
            <button onClick={resetCalibration} style={button}>Reset Calibration</button>
          </div>

          {calibrationMode && (
            <div style={panel}>
              <div style={{ fontSize: 14, fontWeight: 600 }}>Calibration</div>
              <p style={hintText}>Tap two points in camera view with known distance (for example, door width), then enter meters.</p>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  value={calibrationDistanceM}
                  onChange={(e) => setCalibrationDistanceM(e.target.value)}
                  placeholder="Distance in meters"
                  type="number"
                  step="0.01"
                  style={input}
                />
                <button onClick={applyCalibration} style={activeButton} disabled={calibrationPoints.length !== 2}>
                  Apply
                </button>
              </div>
              <div style={hintText}>Points selected: {calibrationPoints.length}/2</div>
            </div>
          )}

          <div style={panel}>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Placement Metrics</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8, marginTop: 6 }}>
              <div style={metric}><strong>Model width:</strong> {modelRealWidthMeters ? `${modelRealWidthMeters} m` : "not set"}</div>
              <div style={metric}><strong>Pixels/meter:</strong> {pixelsPerMeter ? pixelsPerMeter.toFixed(2) : "not calibrated"}</div>
              <div style={metric}><strong>Rendered width:</strong> {Math.round(displayedWidthPx)} px</div>
              <div style={metric}><strong>Tip:</strong> drag to move, pinch to scale, twist to rotate. (Desktop: Shift-drag rotates, wheel scales.)</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const button = {
  padding: "8px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5e1",
  background: "#fff",
  cursor: "pointer",
  fontSize: 14,
};

const activeButton = {
  ...button,
  border: "1px solid #4f46e5",
  background: "#4f46e5",
  color: "#fff",
};

const overlayText = {
  position: "absolute",
  inset: 0,
  display: "grid",
  placeItems: "center",
  color: "#fff",
  background: "rgba(2,6,23,0.45)",
  fontSize: 14,
};

const hintText = {
  fontSize: 13,
  color: "#64748b",
  margin: 0,
};

const input = {
  border: "1px solid #cbd5e1",
  borderRadius: 8,
  padding: "8px 10px",
  minWidth: 180,
};

const panel = {
  border: "1px solid #e2e8f0",
  borderRadius: 10,
  padding: 10,
  background: "#f8fafc",
  display: "grid",
  gap: 8,
};

const metric = {
  background: "#fff",
  border: "1px solid #e2e8f0",
  borderRadius: 8,
  padding: "8px 10px",
  fontSize: 13,
};

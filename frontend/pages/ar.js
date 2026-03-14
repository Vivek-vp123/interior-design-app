import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/router";
import Layout from "../components/Layout";
import ARPlacement from "../components/ARPlacement";
import ModelPicker from "../components/ModelPicker";
import ARTutorial from "../components/ARTutorial";
import API from "../lib/api";

function inferRealWidthMeters(item) {
  const category = (item.category || "").toLowerCase();
  if (category.includes("lighting")) return 0.45;
  if (category.includes("decor")) return 0.8;
  if (category.includes("storage")) return 1.1;
  if (category.includes("textiles")) return 1.5;
  return 1.2;
}

export default function ARPage() {
  const router = useRouter();
  const roomId = typeof router.query.roomId === "string" ? router.query.roomId : "";

  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [modelWidthM, setModelWidthM] = useState("");
  const [loading, setLoading] = useState(true);
  const [sourceLabel, setSourceLabel] = useState("catalog");

  const [showTutorial, setShowTutorial] = useState(() => {
    if (typeof window !== "undefined") {
      return !localStorage.getItem("ar_tutorial_seen");
    }
    return false;
  });

  const handleTutorialClose = () => {
    setShowTutorial(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("ar_tutorial_seen", "1");
    }
  };

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      setLoading(true);

      try {
        if (roomId) {
          const suggestionRes = await API.get(`/suggestions/${roomId}`);
          const suggestions = Array.isArray(suggestionRes.data)
            ? suggestionRes.data
            : suggestionRes.data?.suggestions || [];

          const suggestionModels = suggestions.map((item, idx) => ({
            id: item.id || `suggested-${idx}`,
            title: item.title,
            desc: item.desc || item.reason || "AI-recommended item",
            image: item.imageUrl,
            price: item.price || "$--",
            category: item.category || "Furniture",
            modelUrl: item.modelUrl || "/models/mid_century_lounge_chair_4k.glb",
            fallbackImage: item.imageUrl,
            realWidthM: Number(item.realWidthM) || inferRealWidthMeters(item),
            confidence: item.confidence,
          }));

          if (!cancelled && suggestionModels.length > 0) {
            setModels(suggestionModels);
            setSelectedModel(suggestionModels[0]);
            setModelWidthM(String(suggestionModels[0].realWidthM || 1.2));
            setSourceLabel("room suggestions");
            setLoading(false);
            return;
          }
        }

        const catalogRes = await API.get("/user/catalog");
        const catalogModels = (catalogRes.data || []).map((item) => ({
          ...item,
          fallbackImage: item.image,
          realWidthM: Number(item.realWidthM) || inferRealWidthMeters(item),
        }));

        if (!cancelled) {
          setModels(catalogModels);
          if (catalogModels[0]) {
            setSelectedModel(catalogModels[0]);
            setModelWidthM(String(catalogModels[0].realWidthM || 1.2));
          }
          setSourceLabel("catalog");
        }
      } catch (err) {
        if (!cancelled) {
          const fallback = [
            {
              id: 1,
              title: "Mid-Century Lounge Chair",
              desc: "Iconic lounge chair, perfect for modern interiors.",
              image: "https://picsum.photos/400/300?random=109",
              price: "$899",
              category: "Furniture",
              modelUrl: "/models/mid_century_lounge_chair_4k.glb",
              fallbackImage: "https://picsum.photos/400/300?random=109",
              realWidthM: 0.85,
            },
          ];

          setModels(fallback);
          setSelectedModel(fallback[0]);
          setModelWidthM(String(fallback[0].realWidthM));
          setSourceLabel("fallback");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [roomId]);

  const selectedLabel = useMemo(() => {
    if (!selectedModel) return "No item selected";
    return `${selectedModel.title} - ${selectedModel.category} - ${selectedModel.price}`;
  }, [selectedModel]);

  return (
    <Layout>
      {showTutorial && <ARTutorial onClose={handleTutorialClose} />}
      <div style={{ maxWidth: 1100, margin: "24px auto", padding: "0 16px", display: "grid", gap: 16 }}>
        <h1>AR Placement</h1>
        <p style={{ color: "#444", fontSize: 15, margin: 0 }}>
          Select furniture, calibrate against a real reference distance, then place with camera-aligned size and position.
        </p>
        <p style={{ color: "#64748b", fontSize: 13, margin: 0 }}>
          Source: {sourceLabel}{roomId ? ` | roomId: ${roomId}` : ""}
        </p>

        {loading ? (
          <div>Loading selectable furniture...</div>
        ) : (
          <ModelPicker
            models={models}
            onSelect={(model) => {
              setSelectedModel(model);
              setModelWidthM(String(model.realWidthM || 1.2));
            }}
            selectedId={selectedModel?.id}
          />
        )}

        {selectedModel && (
          <div style={{ fontSize: 14, color: "#334155", display: "grid", gap: 4 }}>
            <strong>Selected:</strong> {selectedLabel}
            <div style={{ color: "#64748b" }}>{selectedModel.desc}</div>
            {selectedModel.confidence ? (
              <div style={{ color: "#4f46e5", fontSize: 13 }}>AI match confidence: {selectedModel.confidence}%</div>
            ) : null}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <input
            placeholder="Model real width (meters), e.g. 1.2"
            value={modelWidthM}
            onChange={(e) => setModelWidthM(e.target.value)}
            type="number"
            step="0.01"
            min="0"
            style={{ width: 260, padding: 8, border: "1px solid #cbd5e1", borderRadius: 8 }}
          />
          <div style={{ color: "#666", fontSize: 13 }}>
            Set real width for physically accurate scaling after calibration.
          </div>
        </div>

        <ARPlacement
          modelSrc={selectedModel?.modelUrl || "/models/mid_century_lounge_chair_4k.glb"}
          fallbackImageSrc={selectedModel?.fallbackImage || selectedModel?.image || "/vercel.svg"}
          alt={selectedModel?.title || "selected furniture"}
          modelRealWidthMeters={parseFloat(modelWidthM) || null}
        />
      </div>
    </Layout>
  );
}

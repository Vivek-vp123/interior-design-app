import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/router";
import API from "../lib/api";
import Layout from "../components/Layout";

export default function Visualizer() {
  const router = useRouter();
  const { roomId } = router.query;
  const [room, setRoom] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [placedItems, setPlacedItems] = useState([]);
  const containerRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch room
        const roomRes = await API.get(`/upload/${roomId}`);
        setRoom(roomRes.data.data);

        // Fetch suggestions
        const suggRes = await API.get(`/suggestions/${roomId}`);
        setSuggestions(Array.isArray(suggRes.data) ? suggRes.data : suggRes.data.suggestions || []);
      } catch (err) {
        console.error("Failed to load data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [roomId]);

  const handleDragStart = (e, item, isSidebarItem = true, placedId = null) => {
    e.dataTransfer.setData(
      "application/json",
      JSON.stringify({ ...item, isSidebarItem, placedId })
    );
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (!containerRef.current) return;
    try {
      const data = JSON.parse(e.dataTransfer.getData("application/json"));
      const rect = containerRef.current.getBoundingClientRect();
      const dropX = e.clientX - rect.left;
      const dropY = e.clientY - rect.top;

      if (data.isSidebarItem) {
        // Add new item
        setPlacedItems((prev) => [
          ...prev,
          {
            ...data,
            id: `placed-${Date.now()}-${Math.random()}`,
            x: dropX - 50, // center approximately (assuming 100px width)
            y: dropY - 50,
          },
        ]);
      } else {
        // Move existing placed item
        setPlacedItems((prev) =>
          prev.map((item) =>
            item.id === data.placedId
              ? { ...item, x: dropX - 50, y: dropY - 50 }
              : item
          )
        );
      }
    } catch (err) {
      console.error("Drop error:", err);
    }
  };

  const removeItem = (e, id) => {
    e.stopPropagation();
    setPlacedItems((prev) => prev.filter((item) => item.id !== id));
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600 font-medium">Loading Visualizer...</p>
        </div>
      </Layout>
    );
  }

  if (!room) {
    return (
      <Layout>
        <div className="text-center p-12">
          <h2 className="text-2xl font-bold text-gray-900">Room not found</h2>
          <button
            onClick={() => router.push("/rooms")}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-8">
          {/* Main Visualizer Canvas */}
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Drag & Drop Visualizer
            </h1>
            <p className="text-gray-600 mb-6">
              Drag suggested items onto your room image to visualize your new design.
            </p>

            <div
              ref={containerRef}
              className="relative rounded-xl overflow-hidden shadow-2xl border-4 border-gray-200 bg-gray-100"
              style={{ minHeight: "500px" }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              <img
                src={`${process.env.NEXT_PUBLIC_FILES_URL || "http://localhost:5000"}${room.filePath}`}
                alt="Room"
                className="w-full h-auto object-cover opacity-90"
              />

              {placedItems.map((item) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => handleDragStart(e, item, false, item.id)}
                  className="absolute cursor-move group"
                  style={{
                    left: `${item.x}px`,
                    top: `${item.y}px`,
                  }}
                >
                  <div className="relative border-2 border-indigo-400 border-dashed rounded-lg bg-white/20 backdrop-blur-sm p-1">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-32 h-32 object-contain pointer-events-none rounded"
                      crossOrigin="anonymous"
                    />
                    <button
                      onClick={(e) => removeItem(e, item.id)}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sidebar */}
          <div className="w-full md:w-80 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-4">
                AI Suggestions
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Drag items below into your room.
              </p>

              <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                {suggestions.map((item) => (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, item, true)}
                    className="p-3 bg-gray-50 border border-gray-100 rounded-lg cursor-grab active:cursor-grabbing hover:shadow-md transition-shadow"
                  >
                    <div className="flex gap-4 items-center">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-16 h-16 object-cover rounded shadow-sm bg-white"
                        crossOrigin="anonymous"
                      />
                      <div>
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-1">
                          {item.title}
                        </h3>
                        <p className="text-xs text-indigo-600 font-medium font-mono mt-1">
                          {item.price}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}

                {suggestions.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-8">
                    No suggestions available to place.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}

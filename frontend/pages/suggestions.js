import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import API from "../lib/api";
import Layout from "../components/Layout";

export default function Suggestions() {
  const FILES_BASE = process.env.NEXT_PUBLIC_FILES_URL || "http://localhost:5000";
  const [rooms, setRooms] = useState([]);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [roomsLoading, setRoomsLoading] = useState(true);
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const router = useRouter();

  // Fetch user's uploaded rooms
  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await API.get("/upload");
        const roomsData = Array.isArray(res.data) ? res.data : (res.data.data || res.data.rooms || []);
        setRooms(roomsData);

        // Auto-select room if roomId is in query params
        const { roomId } = router.query;
        if (roomId && roomsData.length > 0) {
          const room = roomsData.find((r) => r._id === roomId);
          if (room) {
            setSelectedRoom(room);
            fetchSuggestions(roomId);
          }
        }
      } catch (err) {
        console.error("Failed to load rooms:", err);
      } finally {
        setRoomsLoading(false);
      }
    };
    fetchRooms();
  }, [router.query.roomId]);

  // Fetch suggestions for a selected room
const fetchSuggestions = async (roomId) => {
  setLoading(true);
  try {
    const res = await API.get(`/suggestions/${roomId}`); // FIXED interpolation
    // Always normalize to array
    const data = Array.isArray(res.data)
      ? res.data
      : (res.data.suggestions || []);
    setSuggestions(data);
  } catch (err) {
    console.error("Failed to load suggestions:", err);
    setSuggestions([]);
  } finally {
    setLoading(false);
  }
};

  const handleRoomSelect = (roomId) => {
    const room = rooms.find((r) => r._id === roomId);
    setSelectedRoom(room);
    if (roomId) {
      fetchSuggestions(roomId);
      // Update URL without reload
      router.push(`/suggestions?roomId=${roomId}`, undefined, { shallow: true });
    }
  };

  const getCategoryIcon = (category) => {
    const icons = {
      Furniture: "M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z",
      Decor: "M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z",
      Lighting: "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z",
      Textiles: "M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zM21 5a2 2 0 00-2-2h-4a2 2 0 00-2 2v12a4 4 0 004 4h4a2 2 0 002-2V5z",
      Storage: "M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
    };
    return icons[category] || icons.Furniture;
  };

  if (roomsLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
              <svg className="animate-spin w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-600 font-medium">Loading your rooms...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Suggestions</h1>
              <p className="mt-2 text-gray-600">Get personalized furniture and decor recommendations</p>
            </div>
            <div className="flex items-center gap-3">
              {/* View Mode Toggle */}
              <div className="flex items-center bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "grid" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                  </svg>
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    viewMode === "list" 
                      ? "bg-white text-gray-900 shadow-sm" 
                      : "text-gray-600 hover:text-gray-900"
                  }`}
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
              </div>
              {suggestions.length > 0 && (
                <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1.5 rounded-lg">
                  {suggestions.length} items
                </span>
              )}
            </div>
          </div>
        </div>

        

        {/* Room Selector Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select a room to get suggestions
              </label>
              <select
                value={selectedRoom?._id || ""}
                onChange={(e) => handleRoomSelect(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all"
              >
                <option value="">Choose a room...</option>
                {rooms.map((room) => (
                  <option key={room._id} value={room._id}>
                    {room.originalName}
                  </option>
                ))}
              </select>
              
              {rooms.length === 0 && (
                <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <p className="text-sm text-amber-800">
                    No rooms uploaded yet.{" "}
                    <button
                      onClick={() => router.push("/upload")}
                      className="font-medium text-amber-900 underline hover:no-underline"
                    >
                      Upload your first room
                    </button>
                  </p>
                </div>
              )}
            </div>

            {/* Selected Room Preview */}
            {selectedRoom && (
              <div className="relative rounded-lg overflow-hidden bg-gray-100 h-48">
                <img
                  src={`${FILES_BASE}${selectedRoom.filePath}`}
                  alt={selectedRoom.originalName}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent"></div>
                <div className="absolute bottom-0 left-0 right-0 p-4 text-white">
                  <h3 className="font-semibold text-lg">{selectedRoom.originalName}</h3>
                  {selectedRoom.dominantColors && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs opacity-75">Colors:</span>
                      <div className="flex gap-1">
                        {selectedRoom.dominantColors.slice(0, 4).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-4 h-4 rounded-full border border-white/50"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-gray-200 rounded-full"></div>
              <div className="absolute top-0 left-0 w-16 h-16 border-4 border-indigo-600 rounded-full animate-spin border-t-transparent"></div>
            </div>
            <p className="mt-4 text-gray-600 font-medium">Analyzing your room...</p>
            <p className="text-sm text-gray-500 mt-1">Finding the perfect matches</p>
          </div>
        )}

        {/* Suggestions Grid/List */}
        {!loading && suggestions.length > 0 && (
          <>
            {viewMode === "grid" ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {suggestions.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 group"
                  >
                    <div className="relative aspect-w-16 aspect-h-12">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-56 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute top-3 left-3">
                        <span className="bg-indigo-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                          {item.confidence || 95}% Match
                        </span>
                      </div>
                      <div className="absolute top-3 right-3 bg-white/90 backdrop-blur-sm rounded-lg p-2 shadow-sm">
                        <svg className="w-5 h-5 text-gray-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCategoryIcon(item.category)} />
                        </svg>
                      </div>
                    </div>
                    
                    <div className="p-5">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="font-semibold text-lg text-gray-900 group-hover:text-indigo-600 transition-colors">
                          {item.title}
                        </h3>
                        <span className="text-lg font-bold text-indigo-600">
                          {item.price}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
                        {item.desc}
                      </p>
                      
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                            {item.category}
                          </span>
                          {item.colorTags && (
                            <div className="flex gap-1">
                              {item.colorTags.slice(0, 3).map((color, idx) => (
                                <div
                                  key={idx}
                                  className="w-3 h-3 rounded-full border border-gray-300"
                                  style={{ backgroundColor: color }}
                                  title={color}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                        
                                                <button onClick={() => router.push(`/visualizer?roomId=${selectedRoom._id}`)} className="text-sm font-medium text-indigo-600 hover:text-indigo-700 flex items-center gap-1 group/btn">
                          Place in Room
                          <svg className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-4">
                {suggestions.map((item, index) => (
                  <div
                    key={item.id || index}
                    className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-lg transition-all duration-300"
                  >
                    <div className="flex gap-6">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-32 h-32 object-cover rounded-lg flex-shrink-0"
                      />
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-2">
                          <div>
                            <h3 className="font-semibold text-lg text-gray-900 mb-1">
                              {item.title}
                            </h3>
                            <div className="flex items-center gap-3 text-sm text-gray-500">
                              <span className="flex items-center gap-1">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={getCategoryIcon(item.category)} />
                                </svg>
                                {item.category}
                              </span>
                              <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-medium">
                                {item.confidence || 95}% Match
                              </span>
                            </div>
                          </div>
                          <span className="text-xl font-bold text-indigo-600">
                            {item.price}
                          </span>
                        </div>
                        
                        <p className="text-gray-600 mb-3">
                          {item.desc}
                        </p>
                        
                        <div className="flex items-center justify-between">
                          {item.colorTags && (
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-500">Colors:</span>
                              <div className="flex gap-1">
                                {item.colorTags.map((color, idx) => (
                                  <div
                                    key={idx}
                                    className="w-4 h-4 rounded-full border border-gray-300"
                                    style={{ backgroundColor: color }}
                                    title={color}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                          
                          <button onClick={() => router.push(`/visualizer?roomId=${selectedRoom._id}`)} className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                            Place in Room
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Empty State */}
        {!loading && suggestions.length === 0 && selectedRoom && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="text-center max-w-md mx-auto">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
                <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No suggestions available</h3>
              <p className="text-gray-500 mb-6">
                We couldn&apos;t find any matching items for this room. Try uploading a different room or check back later as we update our catalog.
              </p>
              <button
                onClick={() => router.push("/upload")}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Upload Another Room
              </button>
            </div>
          </div>
        )}

        {/* AR Preview Section */}
        {selectedRoom && suggestions.length > 0 && (
          <div className="mt-12 bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50 rounded-xl p-8 border border-indigo-100">
            <div className="max-w-4xl mx-auto">
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-full shadow-lg mb-4">
                  <svg className="w-8 h-8 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Visualize in Your Space
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto">
                  Use our AR technology to see how these furniture pieces would look in your actual room. 
                  Place, rotate, and scale items to find the perfect fit.
                </p>
              </div>
              
              <div className="grid md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">📱</div>
                  <h3 className="font-medium text-gray-900 mb-1">Mobile AR</h3>
                  <p className="text-sm text-gray-600">View on your phone</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">🎯</div>
                  <h3 className="font-medium text-gray-900 mb-1">Accurate Sizing</h3>
                  <p className="text-sm text-gray-600">True-to-scale models</p>
                </div>
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-3xl mb-2">🎨</div>
                  <h3 className="font-medium text-gray-900 mb-1">Multiple Options</h3>
                  <p className="text-sm text-gray-600">Try different styles</p>
                </div>
              </div>
              
              <div className="text-center">
                <button 
                  onClick={() => router.push(`/ar?roomId=${selectedRoom._id}`)}
                  className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-all duration-200 transform hover:scale-105 shadow-lg">
                  <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Launch AR Experience
                </button>
                <p className="text-xs text-gray-500 mt-2">Works on iOS and Android</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

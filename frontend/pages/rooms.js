import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import API from "../lib/api";
import Layout from "../components/Layout";

export default function Rooms() {
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sortBy, setSortBy] = useState("date");
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomDetails, setRoomDetails] = useState(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const res = await API.get("/upload");
        if (Array.isArray(res.data)) {
          setRooms(res.data);
        } else if (res.data.rooms) {
          setRooms(res.data.rooms);
        } else {
          setRooms([]);
        }
      } catch (err) {
        console.error("Failed to load rooms:", err);
        if (err.response?.status === 401) {
          router.push("/auth/login");
        }
      } finally {
        setLoading(false);
      }
    };
    fetchRooms();
  }, [router]);

  const fetchRoomDetails = async (roomId) => {
    setDetailsLoading(true);
    setDetailsError(null);
    try {
      const res = await API.get(`/upload/${roomId}/details`);
      setRoomDetails(res.data.data);
    } catch (err) {
      console.error("Failed to fetch room details:", err);
      setDetailsError("Failed to load room analysis details");
      // Use basic room data if details endpoint fails
      const basicRoom = rooms.find(r => r._id === roomId);
      if (basicRoom) {
        setRoomDetails({
          ...basicRoom,
          analysis: {
            objects: [],
            roomType: "Analysis Failed",
            totalObjects: 0,
            colorScheme: "Unknown"
          }
        });
      }
    } finally {
      setDetailsLoading(false);
    }
  };

  const handleViewDetails = (room) => {
    setSelectedRoom(room);
    fetchRoomDetails(room._id);
  };

  const handleCloseDetails = () => {
    setSelectedRoom(null);
    setRoomDetails(null);
    setDetailsError(null);
  };

  const handleDelete = async (roomId) => {
    if (!confirm("Are you sure you want to delete this room?")) return;
    setDeleting(roomId);
    try {
      await API.delete(`/upload/${roomId}`);
      setRooms((prev) => prev.filter((r) => r._id !== roomId));
      if (selectedRoom?._id === roomId) {
        handleCloseDetails();
      }
    } catch (err) {
      console.error("Failed to delete room:", err);
      alert("Delete failed. Try again.");
    } finally {
      setDeleting(null);
    }
  };

  const filteredRooms = rooms.filter(room => {
    if (filter === "analyzed") return room.maskUrl;
    if (filter === "pending") return !room.maskUrl;
    return true;
  });

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    if (sortBy === "name") {
      return a.originalName.localeCompare(b.originalName);
    }
    return new Date(b.date) - new Date(a.date);
  });

  if (loading) {
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
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">My Room Gallery</h1>
              <p className="mt-2 text-gray-600">
                {rooms.length} room{rooms.length !== 1 ? 's' : ''} uploaded
              </p>
            </div>
            <Link
              href="/upload"
              className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Upload New Room
            </Link>
          </div>
        </div>

        {/* Filters and Sort */}
        <div className="mb-6 flex flex-col sm:flex-row gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Filter:</span>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['all', 'analyzed', 'pending'].map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setFilter(filterOption)}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                    filter === filterOption
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {filterOption.charAt(0).toUpperCase() + filterOption.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-700">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="date">Date (newest first)</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Rooms Grid */}
        {sortedRooms.length === 0 ? (
          <div className="text-center bg-white rounded-xl shadow-sm border border-gray-200 p-12">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-full mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900">
              {filter === 'all' ? 'No rooms found' : `No ${filter} rooms`}
            </h3>
            <p className="text-gray-500 mt-2 mb-6">
              {filter === 'all' 
                ? 'Get started by uploading a photo of your room.'
                : `You don't have any ${filter} rooms yet.`}
            </p>
            {filter === 'all' && (
              <Link
                href="/upload"
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Upload Room
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sortedRooms.map((room) => (
              <div
                key={room._id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300"
              >
                {/* Image Preview - Always show original image */}
                <div className="relative h-48 bg-gray-100">
                  <img
                    src={`${process.env.NEXT_PUBLIC_FILES_URL}${room.filePath}`}
                    alt={room.originalName}
                    className="w-full h-full object-cover"
                  />
                  
                  {/* Status Badge */}
                  <div className="absolute top-3 right-3">
                    {room.maskUrl ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        Analyzed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                        <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                        </svg>
                        Pending
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-5">
                  <h3 className="font-semibold text-lg text-gray-900 truncate">
                    {room.originalName}
                  </h3>
                  
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(room.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>

                  {/* Color Palette */}
                  {room.dominantColors && room.dominantColors.length > 0 && (
                    <div className="flex items-center gap-2 mt-3">
                      <span className="text-xs text-gray-500">Colors:</span>
                      <div className="flex gap-1">
                        {room.dominantColors.slice(0, 5).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-5 h-5 rounded border border-gray-200 shadow-sm"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="mt-4 space-y-2">
                    <button
                      onClick={() => handleViewDetails(room)}
                      className="w-full px-3 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
                    >
                      View Details
                    </button>
                    
                    <div className="flex gap-2">
                      <Link
                        href={`/suggestions?roomId=${room._id}`}
                        className="flex-1 px-3 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors text-center"
                      >
                        Suggestions
                      </Link>
                      
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(room._id);
                        }}
                        className="px-3 py-2 bg-red-50 text-red-600 text-sm font-medium rounded-lg hover:bg-red-100 transition-colors"
                        disabled={deleting === room._id}
                      >
                        {deleting === room._id ? (
                          <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          'Delete'
                        )}
                                              </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

     {/* Room Details Modal */}
{selectedRoom && (
  <div className="fixed inset-0 z-50 overflow-y-auto">
    <div className="flex items-center justify-center min-h-screen px-4 py-6">
      {/* Transparent background overlay with blur */}
      <div 
        className="fixed inset-0 transition-opacity bg-black bg-opacity-40 backdrop-blur-sm"
        onClick={handleCloseDetails}
      />

      {/* Modal panel - floating with shadow */}
      <div className="relative w-full max-w-5xl mx-auto">
        <div className="bg-white shadow-2xl rounded-2xl overflow-hidden transform transition-all">
          {/* Modal Header with gradient */}
          <div className="px-6 py-4 bg-gradient-to-r from-indigo-600 to-purple-600">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-semibold text-white">
                Room Analysis Details
              </h3>
              <button
                onClick={handleCloseDetails}
                className="text-white hover:text-gray-200 focus:outline-none transition-colors"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="px-6 py-6 max-h-[calc(100vh-180px)] overflow-y-auto">
            {detailsLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <svg className="animate-spin w-8 h-8 text-indigo-600 mx-auto mb-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-gray-600">Analyzing room details...</p>
                </div>
              </div>
            ) : detailsError ? (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-red-100 rounded-full mb-4">
                  <svg className="w-8 h-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Analysis Failed</h3>
                <p className="text-gray-500">{detailsError}</p>
                {roomDetails && (
                  <p className="text-sm text-gray-400 mt-2">Showing basic information only</p>
                )}
              </div>
            ) : roomDetails ? (
              <div className="space-y-6">
                {/* Quick Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-blue-700">
                      {roomDetails.analysis?.totalObjects || 0}
                    </div>
                    <p className="text-xs text-blue-600 mt-1">Objects Detected</p>
                  </div>
                  <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-purple-700">
                      {roomDetails.dominantColors?.length || 0}
                    </div>
                    <p className="text-xs text-purple-600 mt-1">Colors Found</p>
                  </div>
                  <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-green-700">
                      {roomDetails.maskUrl ? '✓' : '⏳'}
                    </div>
                    <p className="text-xs text-green-600 mt-1">Analysis Status</p>
                  </div>
                  <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-xl p-4 text-center">
                    <div className="text-2xl font-bold text-orange-700">
                      {roomDetails.width || 'N/A'}
                    </div>
                    <p className="text-xs text-orange-600 mt-1">Width (px)</p>
                  </div>
                </div>

                {/* Images Comparison */}
                <div>
                  <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                    <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    Image Analysis
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-gray-700">Original Image</p>
                      <div className="relative rounded-xl overflow-hidden bg-gray-100 shadow-md">
                        <img
                          src={`${process.env.NEXT_PUBLIC_FILES_URL}${roomDetails.filePath}`}
                          alt="Original"
                          className="w-full h-auto"
                          onError={(e) => {
                            e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMTUwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg==';
                            e.target.onerror = null;
                          }}
                        />
                      </div>
                    </div>
                    {roomDetails.maskUrl ? (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Segmentation Mask</p>
                        <div className="relative rounded-xl overflow-hidden bg-gray-100 shadow-md">
                          <img
                            src={`${process.env.NEXT_PUBLIC_FILES_URL}${roomDetails.maskUrl}`}
                            alt="Segmentation"
                            className="w-full h-auto"
                            onError={(e) => {
                              e.target.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iNDAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0iI2VlZSIvPjx0ZXh0IHRleHQtYW5jaG9yPSJtaWRkbGUiIHg9IjIwMCIgeT0iMTUwIiBzdHlsZT0iZmlsbDojYWFhO2ZvbnQtd2VpZ2h0OmJvbGQ7Zm9udC1zaXplOjE5cHg7Zm9udC1mYW1pbHk6QXJpYWwsSGVsdmV0aWNhLHNhbnMtc2VyaWY7ZG9taW5hbnQtYmFzZWxpbmU6Y2VudHJhbCI+TWFzayBOb3QgRm91bmQ8L3RleHQ+PC9zdmc+';
                              e.target.onerror = null;
                            }}
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Segmentation Status</p>
                        <div className="relative rounded-xl overflow-hidden bg-gradient-to-br from-gray-100 to-gray-200 p-12">
                          <div className="text-center">
                            <svg className="w-16 h-16 text-gray-400 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                            </svg>
                            <p className="text-gray-600 font-medium">Segmentation Pending</p>
                            <p className="text-sm text-gray-500 mt-1">Analysis in progress...</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Detected Objects */}
                {roomDetails.segmentationData?.detectedObjects?.length > 0 || roomDetails.analysis?.objects?.length > 0 ? (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                      </svg>
                      Detected Objects
                    </h4>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {(roomDetails.segmentationData?.detectedObjects || roomDetails.analysis?.objects || []).map((obj, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-gradient-to-br from-indigo-100 to-indigo-200 rounded-lg flex items-center justify-center">
                                  <span className="text-xl">🪑</span>
                                </div>
                                <div>
                                  <p className="font-semibold text-gray-900 capitalize">{obj.class || obj.type}</p>
                                  <p className="text-sm text-gray-600">Coverage: {obj.percentage || obj.coverage}%</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-green-600">
                                  {obj.confidence ? `${(obj.confidence * 100).toFixed(0)}%` : 'N/A'}
                                </p>
                                <p className="text-xs text-gray-500">Confidence</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      Object Detection
                    </h4>
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <p className="text-gray-500">No objects detected yet</p>
                                            <p className="text-sm text-gray-400 mt-1">Object detection analysis is pending</p>
                    </div>
                  </div>
                )}

                {/* Color Analysis */}
                {roomDetails.dominantColors && roomDetails.dominantColors.length > 0 ? (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      Color Palette Analysis
                    </h4>
                    <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {roomDetails.dominantColors.map((color, idx) => (
                          <div key={idx} className="bg-white rounded-lg p-4 shadow-sm border border-gray-200">
                            <div className="flex items-center gap-3">
                              <div 
                                className="w-16 h-16 rounded-lg shadow-inner"
                                style={{ backgroundColor: color }}
                              />
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{color.toUpperCase()}</p>
                                <p className="text-xs text-gray-500">
                                  {idx === 0 ? 'Primary' : idx === 1 ? 'Secondary' : `Accent ${idx - 1}`}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                      {roomDetails.colorAnalysis?.colorScheme && (
                        <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-600">Color Scheme:</span>
                            <span className="font-medium text-gray-900">{roomDetails.colorAnalysis.colorScheme}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                      </svg>
                      Color Analysis
                    </h4>
                    <div className="bg-gray-50 rounded-xl p-8 text-center">
                      <p className="text-gray-500">Color analysis not available</p>
                      <p className="text-sm text-gray-400 mt-1">Color extraction is pending</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-gray-600">No additional details available for this room.</p>
              </div>
            )}
          </div>
          
          {/* Modal Footer */}
          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3">
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/suggestions?roomId=${selectedRoom._id}`}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg"
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                    Get AI Suggestions
                  </span>
                </Link>
                <Link
                  href={`/visualizer?roomId=${selectedRoom._id}`}
                  className="px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-sm font-medium rounded-lg hover:from-pink-600 hover:to-rose-600 transition-all shadow-md hover:shadow-lg"
                >
                  <span className="flex items-center">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                    </svg>
                    Drag & Drop Studio
                  </span>
                </Link>
                {selectedRoom.maskUrl && (
                  <button
                    onClick={() => window.open(`${process.env.NEXT_PUBLIC_FILES_URL}${selectedRoom.maskUrl}`, '_blank')}
                    className="px-4 py-2 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    <span className="flex items-center">
                      <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      View Full Mask
                    </span>
                  </button>
                )}
              </div>
              <button
                onClick={handleCloseDetails}
                className="px-6 py-2 text-gray-600 hover:text-gray-800 text-sm font-medium transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
)}
</Layout>
  );
}
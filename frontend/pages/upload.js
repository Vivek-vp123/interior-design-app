import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import API from "../lib/api";
import Layout from "../components/Layout";

export default function Upload() {
  const FILES_BASE = process.env.NEXT_PUBLIC_FILES_URL || "http://localhost:5000";
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [rooms, setRooms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const router = useRouter();

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError("Please select a file first");
      return;
    }

    setLoading(true);
    setError("");
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await API.post("/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percentCompleted);
        }
      });

      const uploadedRoom = res?.data?.data || res?.data;
      if (!uploadedRoom?._id) {
        throw new Error("Upload succeeded but room payload was invalid");
      }

      setRooms((prev) => [uploadedRoom, ...prev]);
      setFile(null);
      setPreview(null);
      setUploadProgress(0);
      
      // Show success message
      setTimeout(() => {
        router.push(`/suggestions?roomId=${uploadedRoom._id}`);
      }, 1000);
    } catch (err) {
      setError(err.response?.data?.msg || "Upload failed. Please try again.");
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (selectedFile) => {
    if (selectedFile) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!validTypes.includes(selectedFile.type)) {
        setError("Please select a valid image file (JPG, PNG, WebP)");
        return;
      }

      // Validate file size (10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB");
        return;
      }

      setFile(selectedFile);
      setError("");

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(selectedFile);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  useEffect(() => {
  const fetchRooms = async () => {
    try {
      const res = await API.get("/upload");
      // Handle both array response and paginated response
      if (Array.isArray(res.data)) {
        setRooms(res.data);
      } else if (res.data.rooms) {
        setRooms(res.data.rooms);
      } else {
        setRooms([]);
      }
    } catch (err) {
      console.error("Failed to fetch rooms:", err);
    }
  };
  fetchRooms();
}, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Room</h1>
          <p className="mt-2 text-gray-600">
            Upload a photo of your room to get AI-powered analysis and design suggestions
          </p>
        </div>

        {/* Upload Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="p-8">
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Drag & Drop Area */}
              <div
                className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-all duration-200 ${
                  dragActive
                    ? "border-indigo-500 bg-indigo-50"
                    : file
                    ? "border-green-400 bg-green-50"
                    : "border-gray-300 hover:border-indigo-400 hover:bg-gray-50"
                }`}
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleFileSelect(e.target.files[0])}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  disabled={loading}
                />
                
                {preview ? (
                  <div className="space-y-4">
                    <div className="relative inline-block">
                      <img
                        src={preview}
                        alt="Preview"
                        className="max-h-64 rounded-lg shadow-md"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          setFile(null);
                          setPreview(null);
                        }}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{file.name}</p>
                      <p className="text-xs text-gray-500">{formatFileSize(file.size)}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-gray-100 rounded-full">
                      <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        Drop your image here, or <span className="text-indigo-600">browse</span>
                      </p>
                      <p className="text-xs text-gray-500">PNG, JPG, WebP up to 10MB</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Progress Bar */}
              {loading && uploadProgress > 0 && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              )}

              {/* Upload Button */}
              <button
                type="submit"
                disabled={loading || !file}
                className={`w-full flex items-center justify-center px-6 py-3 rounded-lg text-white font-medium transition-all duration-200 ${
                  loading || !file
                    ? "bg-gray-400 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg"
                }`}
              >
                {loading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    Analyze Room
                  </>
                )}
              </button>
            </form>

            {/* Error Message */}
            {error && (
              <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-center">
                  <svg className="w-5 h-5 text-red-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Recent Uploads */}
        {rooms.length > 0 && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-gray-900">Recent Uploads</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.slice(0, 6).map((room) => (
                <div
                  key={room._id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-300 cursor-pointer"
                  onClick={() => router.push(`/suggestions?roomId=${room._id}`)}
                >
                  <div className="relative aspect-w-16 aspect-h-10">
                    <img
                      src={`${FILES_BASE}${room.filePath}`}
                      alt={room.originalName}
                      className="w-full h-48 object-cover"
                    />
                    {room.maskUrl && (
                      <div className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-1 rounded-full">
                        ✓ Analyzed
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4">
                    <h3 className="font-medium text-gray-900 truncate">
                      {room.originalName}
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDate(room.date)}
                    </p>
                    
                    {room.dominantColors && room.dominantColors.length > 0 && (
                      <div className="flex gap-1 mt-3">
                        {room.dominantColors.map((color, idx) => (
                          <div
                            key={idx}
                            className="w-6 h-6 rounded border border-gray-200"
                            style={{ backgroundColor: color }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {rooms.length > 6 && (
              <div className="text-center">
                <button
                  onClick={() => router.push("/rooms")}
                  className="text-indigo-600 hover:text-indigo-700 font-medium"
                >
                  View all rooms →
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}

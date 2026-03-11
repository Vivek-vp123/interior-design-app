import axios from "axios";

// Use env var (Next.js requires NEXT_PUBLIC_ prefix for frontend)
const API = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api",
});

// Attach token automatically
API.interceptors.request.use((req) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("token");
    if (token) {
      req.headers.Authorization = `Bearer ${token}`;
    }
  }
  return req;
});

// Global error handler
API.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      // Auto-logout if token expired/invalid
      if (typeof window !== "undefined") {
        localStorage.removeItem("token");
        // 🚨 Ensure we use the right route
        window.location.href = "/auth/login";
      }
    }
    return Promise.reject(err);
  }
);

export default API;

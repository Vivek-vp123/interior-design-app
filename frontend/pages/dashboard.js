import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import API from "../lib/api";
import Layout from "../components/Layout";

export default function Dashboard() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ rooms: 0, designs: 0, suggestions: 0 });
  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [userRes, roomsRes] = await Promise.all([
          API.get("/user/me"),
          API.get("/upload")
        ]);
        
        setUser(userRes.data);
        const rooms = roomsRes.data;

        // Fetch suggestions for all rooms to calculate total
        const suggestionsPromises = rooms.map(room => API.get(`/suggestions/${room._id}`));
        const suggestionsResults = await Promise.all(suggestionsPromises);
        const totalSuggestions = suggestionsResults.reduce((acc, res) => acc + res.data.length, 0);

        setStats({
          totalRooms: rooms.length,
          designs: rooms.length, // Assuming each room is a 'design'
          suggestions: totalSuggestions
        });

      } catch (err) {
        router.push("/auth/login");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-indigo-100 rounded-full mb-4">
            <svg className="animate-spin h-8 w-8 text-indigo-600" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <p className="text-gray-600">Loading your workspace...</p>
        </div>
      </div>
    );
  }

  const handleLogout = () => {
    localStorage.removeItem("token");
    router.replace("/auth/login");
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto">
        {/* Welcome Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Welcome back, {user.name}! 👋
              </h1>
              <p className="mt-2 text-gray-600">
                Ready to transform more spaces today?
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-gradient-to-br from-blue-50 to-indigo-100 p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-indigo-600">Total Rooms</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.totalRooms}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-pink-100 p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-600">Designs Created</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.designs}</p>
              </div>
              <div className="w-12 h-12 bg-purple-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-emerald-100 p-6 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-600">AI Suggestions</p>
                <p className="text-3xl font-bold text-gray-900 mt-1">{stats.suggestions}</p>
              </div>
              <div className="w-12 h-12 bg-green-600 bg-opacity-10 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Link href="/upload">
              <div className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-indigo-300 transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 transition-colors">
                    <svg className="w-6 h-6 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      Upload New Room
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Start a new design project with AI-powered segmentation
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-indigo-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link href="/rooms">
              <div className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-purple-300 transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                    <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-purple-600 transition-colors">
                      My Room Gallery
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      View and manage all your uploaded rooms and designs
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-purple-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>

            <Link href="/suggestions">
              <div className="group bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg hover:border-green-300 transition-all cursor-pointer">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center group-hover:bg-green-200 transition-colors">
                    <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 group-hover:text-green-600 transition-colors">
                      AI Suggestions
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      Get personalized decor and furniture recommendations
                    </p>
                  </div>
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-green-600 group-hover:translate-x-1 transition-all" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </Link>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Activity</h2>
          <div className="space-y-4">
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-gray-600">New design created for "Living Room"</span>
              <span className="text-gray-400 ml-auto">2 hours ago</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-gray-600">Room "Master Bedroom" uploaded</span>
              <span className="text-gray-400 ml-auto">5 hours ago</span>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              <span className="text-gray-600">AI suggestions generated for "Kitchen"</span>
              <span className="text-gray-400 ml-auto">1 day ago</span>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
}
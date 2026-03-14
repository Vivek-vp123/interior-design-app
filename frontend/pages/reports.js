import { useEffect, useState } from "react";
import Layout from "../components/Layout";
import API from "../lib/api";

export default function ReportsPage() {
  const [stats, setStats] = useState({ totalRooms: 0, analyzedRooms: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const res = await API.get("/upload/stats/summary");
        setStats(res.data?.data || { totalRooms: 0, analyzedRooms: 0 });
      } catch (_) {
        setStats({ totalRooms: 0, analyzedRooms: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
        <p className="mt-2 text-gray-600">Quick analytics from your uploaded rooms.</p>

        <div className="grid md:grid-cols-2 gap-6 mt-8">
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-sm text-gray-500">Total Rooms</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? "-" : stats.totalRooms}</p>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-6">
            <p className="text-sm text-gray-500">Analyzed Rooms</p>
            <p className="text-3xl font-bold text-gray-900 mt-2">{loading ? "-" : stats.analyzedRooms}</p>
          </div>
        </div>
      </div>
    </Layout>
  );
}

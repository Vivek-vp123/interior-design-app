import Link from "next/link";

export default function DemoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">Product Demo</h1>
        <p className="mt-4 text-gray-600">
          Demo flow: upload a room, generate AI suggestions, and preview furniture placement in visualizer or AR mode.
        </p>
        <div className="mt-8 flex gap-4">
          <Link href="/auth/signup" className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">
            Start Free
          </Link>
          <Link href="/" className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-100">
            Back Home
          </Link>
        </div>
      </div>
    </div>
  );
}

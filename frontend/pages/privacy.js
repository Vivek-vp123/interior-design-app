import Link from "next/link";

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
        <p className="mt-4 text-gray-600">
          Uploaded room images are stored to provide segmentation, suggestions, and design history.
        </p>
        <p className="mt-2 text-gray-600">
          Authentication data is stored securely in your backend database. Configure secrets and production storage before launch.
        </p>
        <Link href="/" className="inline-block mt-8 text-indigo-600 hover:text-indigo-700">
          Back to home
        </Link>
      </div>
    </div>
  );
}

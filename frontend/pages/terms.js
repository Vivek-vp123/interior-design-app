import Link from "next/link";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
        <p className="mt-4 text-gray-600">
          This app is provided for interior design assistance. Users are responsible for uploaded content and local laws.
        </p>
        <p className="mt-2 text-gray-600">
          AI suggestions are guidance only and may contain inaccuracies. Validate dimensions before purchasing.
        </p>
        <Link href="/" className="inline-block mt-8 text-indigo-600 hover:text-indigo-700">
          Back to home
        </Link>
      </div>
    </div>
  );
}

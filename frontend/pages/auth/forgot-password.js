import Link from "next/link";

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-2xl font-bold text-gray-900">Forgot Password</h1>
        <p className="mt-3 text-gray-600">
          Password reset flow is not configured yet. Please contact support or implement email reset integration.
        </p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Login
        </Link>
      </div>
    </div>
  );
}

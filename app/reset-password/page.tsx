"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Lock, ShieldCheck, Eye, EyeOff, ArrowLeft } from 'lucide-react';

export default function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  const router = useRouter();

  // Password strength indicators
  const hasMinLength = newPassword.length >= 12;
  const hasUppercase = /[A-Z]/.test(newPassword);
  const hasLowercase = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);
  const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const passwordsMatch = newPassword === confirmPassword && confirmPassword.length > 0;

  const strengthScore = [hasMinLength, hasUppercase, hasLowercase, hasNumber, hasSpecial].filter(Boolean).length;
  const strengthLabel = strengthScore <= 2 ? 'Weak' : strengthScore <= 3 ? 'Fair' : strengthScore <= 4 ? 'Good' : 'Strong';
  const strengthColor = strengthScore <= 2 ? 'bg-red-500' : strengthScore <= 3 ? 'bg-yellow-500' : strengthScore <= 4 ? 'bg-blue-500' : 'bg-green-500';

  useEffect(() => {
    // Listen for the PASSWORD_RECOVERY event from Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setSessionReady(true);
        setCheckingSession(false);
      }
    });

    // Also check if there's already a session (user may have arrived with token in URL)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setSessionReady(true);
      }
      setCheckingSession(false);
    };

    checkSession();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    // Validate password strength
    if (!hasMinLength) {
      setErrorMessage('Password must be at least 12 characters long.');
      setLoading(false);
      return;
    }

    if (strengthScore < 3) {
      setErrorMessage('Password is too weak. Include uppercase, lowercase, numbers, and special characters.');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setLoading(false);
      return;
    }

    try {
      // Update password via Supabase Auth
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) {
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      // Update profile password tracking
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from('profiles')
          .update({
            password_changed_at: new Date().toISOString(),
            password_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
            must_change_password: false,
          })
          .eq('id', user.id);
      }

      setSuccess(true);
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    }

    setLoading(false);
  };

  // Loading state while checking session
  if (checkingSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Verifying reset link...</p>
        </div>
      </div>
    );
  }

  // Invalid or expired link
  if (!sessionReady) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
              <Lock size={32} className="text-red-600" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Invalid or Expired Link</h2>
            <p className="text-gray-500 mb-6">
              This password reset link is invalid or has expired. Please request a new one from the login page.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-bold rounded-xl hover:from-blue-700 hover:to-indigo-700 transition shadow-lg"
            >
              <ArrowLeft size={18} />
              Back to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100 text-center">
            <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
              <CheckCircle2 size={40} className="text-white" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Password Updated!</h2>
            <p className="text-gray-500 mb-6">
              Your password has been successfully reset. You can now sign in with your new password.
            </p>
            <button
              onClick={() => router.push('/login')}
              className="w-full py-3.5 px-4 bg-gradient-to-r from-green-600 to-emerald-600 text-white font-bold rounded-xl hover:from-green-700 hover:to-emerald-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Reset password form
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <CheckCircle2 size={24} className="text-white" />
            </div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              TaskFlow
            </h1>
          </div>

          <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
            {/* Header */}
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-purple-100 mb-4">
                <ShieldCheck size={32} className="text-purple-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Set New Password</h2>
              <p className="text-gray-500">
                Choose a strong password to secure your account
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-5">
              {/* New Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    className="w-full pl-10 pr-12 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>

                {/* Password Strength Meter */}
                {newPassword.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${strengthColor}`}
                          style={{ width: `${(strengthScore / 5) * 100}%` }}
                        />
                      </div>
                      <span className={`text-xs font-semibold ${
                        strengthScore <= 2 ? 'text-red-600' : strengthScore <= 3 ? 'text-yellow-600' : strengthScore <= 4 ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {strengthLabel}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1">
                      {[
                        { check: hasMinLength, label: '12+ characters' },
                        { check: hasUppercase, label: 'Uppercase letter' },
                        { check: hasLowercase, label: 'Lowercase letter' },
                        { check: hasNumber, label: 'Number' },
                        { check: hasSpecial, label: 'Special character' },
                      ].map((rule, i) => (
                        <div key={i} className="flex items-center gap-1.5">
                          <div className={`w-3.5 h-3.5 rounded-full flex items-center justify-center ${
                            rule.check ? 'bg-green-500' : 'bg-gray-300'
                          }`}>
                            {rule.check && <CheckCircle2 size={10} className="text-white" />}
                          </div>
                          <span className={`text-xs ${rule.check ? 'text-green-700' : 'text-gray-500'}`}>
                            {rule.label}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Confirm New Password
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    required
                    minLength={12}
                    className={`w-full pl-10 pr-12 py-3 border-2 rounded-xl outline-none transition ${
                      confirmPassword.length > 0
                        ? passwordsMatch
                          ? 'border-green-400 focus:border-green-500 focus:ring-2 focus:ring-green-100'
                          : 'border-red-300 focus:border-red-500 focus:ring-2 focus:ring-red-100'
                        : 'border-gray-200 focus:border-purple-500 focus:ring-2 focus:ring-purple-100'
                    }`}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {confirmPassword.length > 0 && !passwordsMatch && (
                  <p className="text-xs text-red-500 mt-1.5">Passwords do not match</p>
                )}
                {passwordsMatch && (
                  <p className="text-xs text-green-600 mt-1.5 flex items-center gap-1">
                    <CheckCircle2 size={12} /> Passwords match
                  </p>
                )}
              </div>

              {/* Error Message */}
              {errorMessage && (
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                  <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading || !hasMinLength || !passwordsMatch}
                className={`w-full py-3.5 px-4 text-white font-bold rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 ${
                  loading || !hasMinLength || !passwordsMatch ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Updating Password...
                  </>
                ) : (
                  <>
                    <ShieldCheck size={20} />
                    Reset Password
                  </>
                )}
              </button>

              {/* Back to login */}
              <button
                type="button"
                onClick={() => router.push('/login')}
                className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-600 hover:text-gray-800 font-medium"
              >
                <ArrowLeft size={16} />
                Back to Login
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}

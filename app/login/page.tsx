"use client";

import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useRouter } from 'next/navigation';
import { CheckCircle2, User, Mail, Lock, Briefcase, LogIn, UserPlus, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstname, setFirstname] = useState('');
  const [lastname, setLastname] = useState('');
  const [position, setPosition] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [lockoutMessage, setLockoutMessage] = useState('');
  const [passwordExpired, setPasswordExpired] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  
  // New State: Are we Logging in or Signing Up?
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  
  const router = useRouter();

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    if (newPassword.length < 12) {
      setErrorMessage('New password must be at least 12 characters long');
      setLoading(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match');
      setLoading(false);
      return;
    }

    // Update password in Supabase Auth
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      // Update password expiration tracking
      await supabase
        .from('profiles')
        .update({
          password_changed_at: new Date().toISOString(),
          password_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString(),
          must_change_password: false
        })
        .eq('username', email);

      alert('Password updated successfully!');
      setPasswordExpired(false);
      setNewPassword('');
      setConfirmPassword('');
      router.push('/');
      router.refresh();
    }
    setLoading(false);
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');

    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: `${window.location.origin}/login`,
    });

    if (error) {
      setErrorMessage(error.message);
    } else {
      setResetSent(true);
    }
    setLoading(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage('');
    setLockoutMessage('');

    if (isSignUpMode) {
      // --- SIGN UP LOGIC ---
      // Validate password strength
      if (password.length < 12) {
        setErrorMessage('Password must be at least 12 characters long');
        setLoading(false);
        return;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            firstname: firstname,
            lastname: lastname,
            position: position
          }
        }
      });
      
      if (error) {
        setErrorMessage(error.message);
      } else if (data.user) {
        // Create profile entry with additional info
        const { error: profileError } = await supabase
          .from('profiles')
          .insert({
            id: data.user.id,
            username: email,
            firstname: firstname,
            lastname: lastname,
            position: position,
            password_changed_at: new Date().toISOString(),
            password_expires_at: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
          });
        
        if (profileError) {
          console.error('Profile creation error:', profileError);
        }
        
        // Store initial password hash in history
        const { error: historyError } = await supabase.rpc('cleanup_old_password_history');
        if (historyError) {
          console.error('History cleanup error:', historyError);
        }
        
        alert("Account created successfully! Please log in.");
        setIsSignUpMode(false);
        // Clear signup fields
        setFirstname('');
        setLastname('');
        setPosition('');
        setPassword('');
      }
    } else {
      // --- LOG IN LOGIC ---
      // Check if account is locked
      const { data: profileData } = await supabase
        .from('profiles')
        .select('account_locked_until')
        .eq('username', email)
        .single();

      if (profileData?.account_locked_until) {
        const lockoutTime = new Date(profileData.account_locked_until);
        if (lockoutTime > new Date()) {
          const minutesLeft = Math.ceil((lockoutTime.getTime() - Date.now()) / 60000);
          setLockoutMessage(`Account is locked. Try again in ${minutesLeft} minutes.`);
          setLoading(false);
          return;
        }
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      // Track login attempt
      await supabase.from('login_attempts').insert({
        email: email,
        success: !error,
        attempted_at: new Date().toISOString()
      });

      if (error) {
        // Count recent failed attempts
        const { data: attempts } = await supabase
          .from('login_attempts')
          .select('*')
          .eq('email', email)
          .eq('success', false)
          .gte('attempted_at', new Date(Date.now() - 15 * 60000).toISOString());

        const failedCount = (attempts?.length || 0) + 1;
        
        if (failedCount >= 5) {
          // Lock account for 30 minutes
          await supabase
            .from('profiles')
            .update({ account_locked_until: new Date(Date.now() + 30 * 60000).toISOString() })
            .eq('username', email);
          
          setLockoutMessage('Too many failed attempts. Account locked for 30 minutes.');
        } else {
          setErrorMessage(`Invalid credentials. ${5 - failedCount} attempts remaining.`);
        }
      } else {
        // Clear any lockout on successful login
        await supabase
          .from('profiles')
          .update({ account_locked_until: null })
          .eq('username', email);
        
        // Check if password has expired
        const { data: profileData } = await supabase
          .from('profiles')
          .select('password_expires_at, must_change_password')
          .eq('username', email)
          .single();

        if (profileData?.must_change_password || 
            (profileData?.password_expires_at && new Date(profileData.password_expires_at) < new Date())) {
          setPasswordExpired(true);
          setLockoutMessage('Your password has expired. Please change it to continue.');
          setLoading(false);
          return;
        }
        
        router.push('/'); 
        router.refresh();
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      <div className="flex min-h-screen">
        {/* Left Side - Branding (hidden on mobile) */}
        <div className="hidden lg:flex lg:flex-1 lg:items-center lg:justify-center lg:p-12">
          <div className="max-w-lg">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <CheckCircle2 size={28} className="text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskFlow
              </h1>
            </div>
            <h2 className="text-3xl font-bold text-gray-800 mb-4">
              Manage your tasks with ease
            </h2>
            <p className="text-lg text-gray-600 mb-8">
              Collaborate with your team, track progress, and achieve your goals faster with our intuitive task management platform.
            </p>
            <div className="space-y-3">
              {['Real-time collaboration', 'Task tracking & subtasks', 'Team notifications', 'Progress analytics'].map((feature, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                    <CheckCircle2 size={14} className="text-green-600" />
                  </div>
                  <span className="text-gray-700">{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Side - Auth Form */}
        <div className="flex-1 flex items-center justify-center p-6 lg:p-12">
          <div className="w-full max-w-md">
            {/* Mobile Logo */}
            <div className="lg:hidden flex items-center justify-center gap-3 mb-8">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                <CheckCircle2 size={24} className="text-white" />
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                TaskFlow
              </h1>
            </div>

            <div className="bg-white rounded-2xl shadow-2xl p-8 border border-gray-100">
              {/* Header with icon */}
              <div className="text-center mb-8">
                <div className={`inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 ${
                  forgotPasswordMode ? 'bg-purple-100' : passwordExpired ? 'bg-orange-100' : isSignUpMode ? 'bg-green-100' : 'bg-blue-100'
                }`}>
                {forgotPasswordMode ? (
                  <Mail size={32} className="text-purple-600" />
                ) : passwordExpired ? (
                  <Lock size={32} className="text-orange-600" />
                ) : isSignUpMode ? (
                  <UserPlus size={32} className="text-green-600" />
                ) : (
                  <LogIn size={32} className="text-blue-600" />
                )}
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">
                {forgotPasswordMode ? "Reset Password" : passwordExpired ? "Change Password" : isSignUpMode ? "Create Account" : "Welcome Back"}
              </h2>
              <p className="text-gray-500">
                {forgotPasswordMode ? "Enter your email to receive a reset link" : passwordExpired ? "Your password has expired after 90 days" : isSignUpMode ? "Start managing your tasks today" : "Sign in to continue to TaskFlow"}
              </p>
            </div>
        
        {forgotPasswordMode ? (
          // FORGOT PASSWORD FORM
          <div className="space-y-5">
            {!resetSent ? (
              <form onSubmit={handleForgotPassword} className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="email"
                      required
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-purple-500 focus:ring-2 focus:ring-purple-100 transition"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="you@example.com"
                    />
                  </div>
                </div>

                {errorMessage && (
                  <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                    <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className={`w-full py-3.5 px-4 text-white font-bold rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 ${
                    loading ? 'opacity-70 cursor-not-allowed' : ''
                  }`}
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Mail size={20} />
                      Send Reset Link
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setResetEmail('');
                    setErrorMessage('');
                  }}
                  className="w-full text-sm text-gray-600 hover:text-gray-800 font-medium"
                >
                  ← Back to Login
                </button>
              </form>
            ) : (
              <div className="bg-green-50 border-2 border-green-200 rounded-xl p-6 text-center">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-800 mb-2">Check Your Email</h3>
                <p className="text-gray-600 text-sm mb-4">
                  We've sent a password reset link to <strong>{resetEmail}</strong>
                </p>
                <p className="text-gray-500 text-xs mb-4">
                  Click the link in the email to reset your password. The link will expire in 1 hour.
                </p>
                <button
                  onClick={() => {
                    setForgotPasswordMode(false);
                    setResetSent(false);
                    setResetEmail('');
                  }}
                  className="text-purple-600 hover:text-purple-700 font-semibold text-sm"
                >
                  ← Back to Login
                </button>
              </div>
            )}
          </div>
        ) : passwordExpired ? (
          // PASSWORD CHANGE FORM
          <form onSubmit={handlePasswordChange} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Password *
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={12}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Must be at least 12 characters long
              </p>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Confirm New Password *
              </label>
              <div className="relative">
                <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="password"
                  required
                  minLength={12}
                  className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-orange-500 focus:ring-2 focus:ring-orange-100 transition"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3">
                <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className={`w-full py-3.5 px-4 text-white font-bold rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 ${
                loading ? 'opacity-70 cursor-not-allowed' : ''
              }`}
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Updating...
                </>
              ) : (
                <>
                  <Lock size={20} />
                  Change Password
                </>
              )}
            </button>
          </form>
        ) : (
          // REGULAR LOGIN/SIGNUP FORM
        <form onSubmit={handleAuth} className="space-y-5">
          {/* Show additional fields only in Sign Up mode */}
          {isSignUpMode && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    First Name *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                      value={firstname}
                      onChange={(e) => setFirstname(e.target.value)}
                      placeholder="John"
                    />
                  </div>
                </div>
                
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <div className="relative">
                    <User size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      required
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                      value={lastname}
                      onChange={(e) => setLastname(e.target.value)}
                      placeholder="Doe"
                    />
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Position <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <div className="relative">
                  <Briefcase size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none focus:border-green-500 focus:ring-2 focus:ring-green-100 transition"
                    value={position}
                    onChange={(e) => setPosition(e.target.value)}
                    placeholder="Software Engineer"
                  />
                </div>
              </div>
            </>
          )}
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Email Address
            </label>
            <div className="relative">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="email"
                required
                className={`w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none transition ${
                  isSignUpMode 
                    ? 'focus:border-green-500 focus:ring-2 focus:ring-green-100' 
                    : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Password
            </label>
            <div className="relative">
              <Lock size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                required
                minLength={isSignUpMode ? 12 : 6}
                className={`w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl outline-none transition ${
                  isSignUpMode 
                    ? 'focus:border-green-500 focus:ring-2 focus:ring-green-100' 
                    : 'focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
                }`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
              />
            </div>
            {isSignUpMode && (
              <p className="text-xs text-gray-500 mt-2">
                Must be at least 12 characters long (uppercase, lowercase, numbers recommended)
              </p>
            )}
            {!isSignUpMode && (
              <div className="text-right">
                <button
                  type="button"
                  onClick={() => {
                    setForgotPasswordMode(true);
                    setErrorMessage('');
                    setLockoutMessage('');
                  }}
                  className="text-sm text-blue-600 hover:text-blue-700 font-medium hover:underline"
                >
                  Forgot password?
                </button>
              </div>
            )}
          </div>

          {/* Error Messages */}
          {errorMessage && (
            <div className="bg-red-50 border-2 border-red-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-red-600 text-sm font-medium">{errorMessage}</span>
            </div>
          )}
          {lockoutMessage && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-3 flex items-start gap-2">
              <span className="text-orange-600 text-sm font-medium">{lockoutMessage}</span>
            </div>
          )}

          {/* The Main Button */}
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-3.5 px-4 text-white font-bold rounded-xl transition duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2 ${
              isSignUpMode 
                ? 'bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700' 
                : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700'
            } ${loading ? 'opacity-70 cursor-not-allowed' : ''}`}
          >
            {loading ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {isSignUpMode ? (
                  <>
                    <Sparkles size={20} />
                    Create Account
                  </>
                ) : (
                  <>
                    <LogIn size={20} />
                    Sign In
                  </>
                )}
              </>
            )}
          </button>
        </form>
        )}

        {/* The Toggle Link - Only show if not in password expired or forgot password mode */}
        {!passwordExpired && !forgotPasswordMode && (
        <div className="mt-6 text-center">
          <p className="text-sm text-gray-600 mb-2">
            {isSignUpMode ? "Already have an account?" : "Don't have an account?"}
          </p>
          <button
            type="button"
            onClick={() => setIsSignUpMode(!isSignUpMode)}
            className={`text-sm font-bold hover:underline ${
              isSignUpMode ? 'text-green-600 hover:text-green-700' : 'text-blue-600 hover:text-blue-700'
            }`}
          >
            {isSignUpMode ? "Back to Login" : "Create an Account →"}
          </button>
        </div>
        )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
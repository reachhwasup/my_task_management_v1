"use client";

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import { Shield, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function MfaSetup() {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isEnrolled, setIsEnrolled] = useState(false);
    const [qrCodeString, setQrCodeString] = useState('');
    const [factorId, setFactorId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [verifying, setVerifying] = useState(false);

    useEffect(() => {
        checkMfaStatus();
    }, []);

    async function checkMfaStatus() {
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase.auth.mfa.listFactors();
            if (error) throw error;

            const totpFactor = data?.totp.find(f => f.status === 'verified');
            if (totpFactor) {
                setIsEnrolled(true);
            }
        } catch (err: any) {
            setError('Failed to load MFA status: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    async function startEnrollment() {
        setLoading(true);
        setError('');

        try {
            // Step 1: Try to unenroll ALL factors including hidden unverified ones.
            // We attempt to call listFactors first, then unenroll each.
            const { data: existingFactors } = await supabase.auth.mfa.listFactors();
            for (const factor of existingFactors?.totp ?? []) {
                await supabase.auth.mfa.unenroll({ factorId: factor.id });
            }

            // Step 2: Enroll with a unique name to avoid empty-string name collisions
            // from stuck unverified factors that can't be listed by the client API.
            const { data, error: enrollError } = await supabase.auth.mfa.enroll({
                factorType: 'totp',
                friendlyName: `TaskFlow-${Date.now()}`
            });

            if (enrollError) {
                if (enrollError.message.includes('already exists')) {
                    throw new Error(
                        'A previous setup attempt left a stuck factor. ' +
                        'Please go to Supabase Dashboard → Authentication → Users → [your user] → MFA Factors, delete any existing factors, then try again.'
                    );
                }
                throw enrollError;
            }

            setFactorId(data.id);
            setQrCodeString(data.totp.uri);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    async function verifyEnrollment() {
        if (verificationCode.length < 6) {
            setError('Please enter a valid 6-digit code');
            return;
        }

        setVerifying(true);
        setError('');

        try {
            const { data, error } = await supabase.auth.mfa.challengeAndVerify({
                factorId,
                code: verificationCode
            });

            if (error) throw error;

            setIsEnrolled(true);
            setQrCodeString('');
            setFactorId('');
            setVerificationCode('');
        } catch (err: any) {
            setError('Failed to verify code: ' + err.message);
        } finally {
            setVerifying(false);
        }
    }

    async function handleUnenroll() {
        if (!confirm('Are you sure you want to disable Two-Factor Authentication? This will make your account less secure.')) {
            return;
        }

        setLoading(true);
        setError('');

        try {
            const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
            if (factorsError) throw factorsError;

            const totpFactor = factors?.totp.find(f => f.status === 'verified');
            if (totpFactor) {
                const { error: unenrollError } = await supabase.auth.mfa.unenroll({ factorId: totpFactor.id });
                if (unenrollError) throw unenrollError;
                setIsEnrolled(false);
            }
        } catch (err: any) {
            setError('Failed to disable MFA: ' + err.message);
        } finally {
            setLoading(false);
        }
    }

    if (loading && !qrCodeString) {
        return (
            <div className="flex justify-center items-center py-8">
                <RefreshCw className="animate-spin text-blue-500" size={24} />
            </div>
        );
    }

    return (
        <div className="bg-white border rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isEnrolled ? 'bg-green-100' : 'bg-gray-100'}`}>
                    <Shield className={isEnrolled ? "text-green-600" : "text-gray-500"} size={20} />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-gray-800">Two-Factor Authentication (2FA)</h3>
                    <p className="text-sm text-gray-500">
                        {isEnrolled ? 'Your account is protected by 2FA.' : 'Add an extra layer of security to your account.'}
                    </p>
                </div>
            </div>

            {error && (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle size={16} className="mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {isEnrolled ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="flex items-center gap-2 text-green-700">
                        <CheckCircle size={18} />
                        <span className="font-medium">Authenticator App Enabled</span>
                    </div>
                    <button
                        onClick={handleUnenroll}
                        disabled={loading}
                        className="px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 border border-red-200 rounded-lg transition disabled:opacity-50"
                    >
                        Disable 2FA
                    </button>
                </div>
            ) : qrCodeString ? (
                <div className="space-y-6">
                    <div className="bg-gray-50 p-4 rounded-lg">
                        <h4 className="font-semibold text-gray-800 mb-2">1. Scan the QR Code</h4>
                        <p className="text-sm text-gray-600 mb-4">
                            Open your authenticator app (like Google Authenticator or Authy) and scan this QR code.
                        </p>
                        <div className="flex justify-center bg-white p-4 rounded-lg border inline-block mx-auto w-fit">
                            <QRCodeSVG value={qrCodeString} size={200} />
                        </div>
                    </div>

                    <div>
                        <h4 className="font-semibold text-gray-800 mb-2">2. Enter Verification Code</h4>
                        <p className="text-sm text-gray-600 mb-3">
                            Enter the 6-digit code generated by your app to verify setup.
                        </p>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                placeholder="000000"
                                maxLength={6}
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                                className="flex-1 px-4 py-2 border-2 border-gray-300 rounded-lg outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 text-center text-lg tracking-widest font-mono"
                            />
                            <button
                                onClick={verifyEnrollment}
                                disabled={verifying || verificationCode.length < 6}
                                className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {verifying && <RefreshCw className="animate-spin" size={16} />}
                                Verify
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setQrCodeString('');
                            setFactorId('');
                        }}
                        className="text-sm text-gray-500 hover:text-gray-700"
                    >
                        Cancel setup
                    </button>
                </div>
            ) : (
                <button
                    onClick={startEnrollment}
                    disabled={loading}
                    className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                    Set up Authenticator App
                </button>
            )}
        </div>
    );
}

/**
 * KioskMode — Fullscreen clock-in/out kiosk for restaurant tablets
 * Features:
 * - Fullscreen mode (no sidebar, no header)
 * - Large 6-digit PIN keypad for employee identification
 * - Camera capture on clock-in (mandatory, anti-buddy-punching)
 * - Auto-lock after 30s inactivity
 * - iPad landscape optimized (80px buttons)
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
    LogIn,
    LogOut,
    Camera,
    Lock,
    Unlock,
    X,
    Delete,
    Maximize,
    Clock,
    CheckCircle,
    AlertCircle,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';

// ── Types ─────────────────────────────────────────────────────────
interface Employee {
    id: string;
    full_name: string;
    role_name: string;
    pin_code?: string;
    avatar_url?: string;
}

interface ClockAction {
    type: 'clock_in' | 'clock_out';
    employeeName: string;
    timestamp: Date;
    photoUrl?: string;
}

// ── Constants ─────────────────────────────────────────────────────
const AUTO_LOCK_MS = 30_000; // 30 seconds
const PIN_LENGTH = 6;
const SUCCESS_DISPLAY_MS = 3_000; // Show success for 3 seconds
const CAMERA_TIMEOUT_MS = 15_000; // 15 seconds max for camera

export default function KioskMode() {
  const { t } = useTranslation();
    const { locationId } = useParams<{ locationId: string }>();
    const navigate = useNavigate();

    // ── State ─────────────────────────────────────────────────────
    const [locked, setLocked] = useState(true);
    const [pin, setPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [employee, setEmployee] = useState<Employee | null>(null);
    const [activeClockIn, setActiveClockIn] = useState<string | null>(null);
    const [showCamera, setShowCamera] = useState(false);
    const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const [lastAction, setLastAction] = useState<ClockAction | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [locationName, setLocationName] = useState('');
    const [error, setError] = useState<string | null>(null);

    // ── Refs ──────────────────────────────────────────────────────
    const lockTimerRef = useRef<NodeJS.Timeout | null>(null);
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    // ── Clock ────────────────────────────────────────────────────
    useEffect(() => {
        const interval = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Load location name ───────────────────────────────────────
    useEffect(() => {
        if (!locationId) return;
        supabase
            .from('locations')
            .select('name')
            .eq('id', locationId)
            .single()
            .then(({ data }) => {
                if (data) setLocationName(data.name);
            });
    }, [locationId]);

    // ── Auto-lock timer ──────────────────────────────────────────
    const resetLockTimer = useCallback(() => {
        if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        lockTimerRef.current = setTimeout(() => {
            setLocked(true);
            setPin('');
            setEmployee(null);
            setActiveClockIn(null);
            setShowCamera(false);
            setPhotoBlob(null);
            setPhotoPreview(null);
            setLastAction(null);
            setError(null);
            stopCamera();
        }, AUTO_LOCK_MS);
    }, []);

    useEffect(() => {
        if (!locked) resetLockTimer();
        return () => {
            if (lockTimerRef.current) clearTimeout(lockTimerRef.current);
        };
    }, [locked, resetLockTimer]);

    // ── Fullscreen ───────────────────────────────────────────────
    const toggleFullscreen = () => {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => { });
        } else {
            document.exitFullscreen().catch(() => { });
        }
    };

    // ── Camera ───────────────────────────────────────────────────
    const startCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: 'user', width: 640, height: 480 },
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setShowCamera(true);
        } catch (err) {
            console.error('Camera error:', err);
            setError('No se pudo acceder a la cámara. Permite el acceso para fichar.');
        }
    };

    const stopCamera = () => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((t) => t.stop());
            streamRef.current = null;
        }
        setShowCamera(false);
    };

    const capturePhoto = (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            if (!videoRef.current || !canvasRef.current) {
                resolve(null);
                return;
            }
            const canvas = canvasRef.current;
            const video = videoRef.current;
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            if (!ctx) { resolve(null); return; }
            ctx.drawImage(video, 0, 0);
            canvas.toBlob((blob) => {
                if (blob) {
                    setPhotoBlob(blob);
                    setPhotoPreview(URL.createObjectURL(blob));
                }
                resolve(blob);
            }, 'image/jpeg', 0.8);
        });
    };

    // ── PIN input ────────────────────────────────────────────────
    const handleDigit = (digit: string) => {
        resetLockTimer();
        setError(null);
        if (pin.length < PIN_LENGTH) {
            const newPin = pin + digit;
            setPin(newPin);
            if (newPin.length === PIN_LENGTH) {
                lookupEmployee(newPin);
            }
        }
    };

    const handleDelete = () => {
        resetLockTimer();
        setPin((prev) => prev.slice(0, -1));
        setError(null);
    };

    const handleClear = () => {
        resetLockTimer();
        setPin('');
        setEmployee(null);
        setActiveClockIn(null);
        setShowCamera(false);
        setPhotoBlob(null);
        setPhotoPreview(null);
        setError(null);
        stopCamera();
    };

    // ── Employee lookup ──────────────────────────────────────────
    const lookupEmployee = async (pinCode: string) => {
        setLoading(true);
        setError(null);
        try {
            // pin_code was added via migration — cast to bypass auto-generated types
            const { data, error: err } = await (supabase
                .from('employees')
                .select('id, full_name, role_name, pin_code, avatar_url')
                .eq('pin_code' as any, pinCode)
                .eq('location_id', locationId)
                .eq('active', true)
                .single() as any);

            if (err || !data) {
                setError('PIN no reconocido. Inténtalo de nuevo.');
                setPin('');
                setLoading(false);
                return;
            }

            setEmployee(data as Employee);

            // Check if there's an active clock-in
            const { data: activeRecord } = await supabase
                .from('employee_clock_records')
                .select('id')
                .eq('employee_id', data.id)
                .is('clock_out', null)
                .order('clock_in', { ascending: false })
                .limit(1)
                .single();

            setActiveClockIn(activeRecord?.id || null);

            // Start camera for clock-in (mandatory photo)
            if (!activeRecord) {
                await startCamera();
            }
        } catch (e) {
            setError('Error al buscar empleado');
            setPin('');
        } finally {
            setLoading(false);
        }
    };

    // ── Clock In ─────────────────────────────────────────────────
    const handleClockIn = async () => {
        if (!employee || !locationId) return;
        resetLockTimer();
        setLoading(true);
        setError(null);

        try {
            // Capture photo (mandatory)
            const photo = await capturePhoto();
            if (!photo) {
                setError('Debes tomar una foto para fichar. Permite el acceso a la cámara.');
                setLoading(false);
                return;
            }

            // Upload photo to Supabase storage
            let photoPath: string | null = null;
            const fileName = `kiosk/${locationId}/${employee.id}_${Date.now()}.jpg`;
            const { error: uploadErr } = await supabase.storage
                .from('clock-photos')
                .upload(fileName, photo, { contentType: 'image/jpeg' });

            if (!uploadErr) {
                photoPath = fileName;
            } else {
                console.warn('Photo upload failed (non-blocking):', uploadErr);
            }

            // Create clock record
            const { error: insertErr } = await supabase
                .from('employee_clock_records')
                .insert({
                    employee_id: employee.id,
                    location_id: locationId,
                    clock_in: new Date().toISOString(),
                    source: 'kiosk',
                    notes: photoPath ? JSON.stringify({ photo_path: photoPath }) : null,
                });

            if (insertErr) throw insertErr;

            stopCamera();
            setLastAction({
                type: 'clock_in',
                employeeName: employee.full_name,
                timestamp: new Date(),
                photoUrl: photoPreview || undefined,
            });

            // Auto-clear after success display
            setTimeout(() => {
                handleClear();
                setLastAction(null);
            }, SUCCESS_DISPLAY_MS);
        } catch (e: any) {
            setError('Error al fichar entrada: ' + (e.message || 'desconocido'));
        } finally {
            setLoading(false);
        }
    };

    // ── Clock Out ────────────────────────────────────────────────
    const handleClockOut = async () => {
        if (!employee || !activeClockIn) return;
        resetLockTimer();
        setLoading(true);
        setError(null);

        try {
            const { error: updateErr } = await supabase
                .from('employee_clock_records')
                .update({ clock_out: new Date().toISOString() })
                .eq('id', activeClockIn);

            if (updateErr) throw updateErr;

            setLastAction({
                type: 'clock_out',
                employeeName: employee.full_name,
                timestamp: new Date(),
            });

            setTimeout(() => {
                handleClear();
                setLastAction(null);
            }, SUCCESS_DISPLAY_MS);
        } catch (e: any) {
            setError('Error al fichar salida: ' + (e.message || 'desconocido'));
        } finally {
            setLoading(false);
        }
    };

    // ── Unlock ───────────────────────────────────────────────────
    const handleUnlock = () => {
        setLocked(false);
        resetLockTimer();
    };

    // ── Render: Lock Screen ──────────────────────────────────────
    if (locked) {
        return (
            <div
                className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col items-center justify-center cursor-pointer select-none z-50"
                onClick={handleUnlock}
            >
                <div className="text-center space-y-6 animate-pulse">
                    <Lock className="h-20 w-20 text-slate-400 mx-auto" />
                    <div>
                        <p className="text-6xl font-bold text-white font-display">
                            {format(currentTime, 'HH:mm')}
                        </p>
                        <p className="text-xl text-slate-400 mt-2 capitalize">
                            {format(currentTime, "EEEE, d 'de' MMMM", { locale: es })}
                        </p>
                    </div>
                    <p className="text-slate-500 text-lg">{locationName || 'Josephine'}</p>
                    <p className="text-slate-600 text-sm mt-8">Toca para desbloquear</p>
                </div>
            </div>
        );
    }

    // ── Render: Success ──────────────────────────────────────────
    if (lastAction) {
        const isIn = lastAction.type === 'clock_in';
        return (
            <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50">
                <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
                    <div className={`h-24 w-24 rounded-full mx-auto flex items-center justify-center ${isIn ? 'bg-emerald-500/20' : 'bg-amber-500/20'}`}>
                        <CheckCircle className={`h-14 w-14 ${isIn ? 'text-emerald-400' : 'text-amber-400'}`} />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-white">{lastAction.employeeName}</p>
                        <p className={`text-xl mt-2 ${isIn ? 'text-emerald-400' : 'text-amber-400'}`}>
                            {isIn ? '✅ Entrada registrada' : '👋 Salida registrada'}
                        </p>
                        <p className="text-slate-400 mt-1">
                            {format(lastAction.timestamp, 'HH:mm:ss')}
                        </p>
                    </div>
                    {lastAction.photoUrl && (
                        <img
                            src={lastAction.photoUrl}
                            alt={t("workforce.clockPhoto")}
                            className="w-32 h-32 rounded-full mx-auto object-cover border-4 border-emerald-500/30"
                        />
                    )}
                </div>
            </div>
        );
    }

    // ── Render: Main Kiosk ───────────────────────────────────────
    return (
        <div
            className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col z-50 select-none"
            onClick={resetLockTimer}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4">
                <div className="flex items-center gap-3">
                    <Clock className="h-6 w-6 text-slate-400" />
                    <span className="text-2xl font-bold text-white font-display">
                        {format(currentTime, 'HH:mm:ss')}
                    </span>
                    <span className="text-slate-500 text-sm capitalize">
                        {format(currentTime, "EEEE, d MMM", { locale: es })}
                    </span>
                </div>
                <div className="flex items-center gap-3">
                    <span className="text-slate-400 text-sm">{locationName}</span>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-white"
                        onClick={toggleFullscreen}
                    >
                        <Maximize className="h-5 w-5" />
                    </Button>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-slate-500 hover:text-white"
                        onClick={() => navigate('/dashboard')}
                    >
                        <X className="h-5 w-5" />
                    </Button>
                </div>
            </div>

            {/* Main content */}
            <div className="flex-1 flex items-center justify-center gap-8 px-6 pb-6">
                {/* Left side: Camera / Employee Info */}
                <div className="flex-1 flex items-center justify-center max-w-lg">
                    {employee ? (
                        <div className="text-center space-y-4 w-full">
                            {/* Employee info */}
                            <div className="space-y-2">
                                <div className="h-20 w-20 rounded-full bg-indigo-500/20 mx-auto flex items-center justify-center">
                                    <span className="text-3xl font-bold text-indigo-400">
                                        {employee.full_name.charAt(0)}
                                    </span>
                                </div>
                                <p className="text-2xl font-bold text-white">{employee.full_name}</p>
                                <p className="text-slate-400">{employee.role_name}</p>
                            </div>

                            {/* Camera view (for clock-in) */}
                            {showCamera && (
                                <div className="space-y-4">
                                    <div className="relative w-64 h-48 mx-auto rounded-xl overflow-hidden border-2 border-indigo-500/30">
                                        <video
                                            ref={videoRef}
                                            autoPlay
                                            playsInline
                                            muted
                                            className="w-full h-full object-cover mirror"
                                            style={{ transform: 'scaleX(-1)' }}
                                        />
                                    </div>
                                    <canvas ref={canvasRef} className="hidden" />
                                    <Button
                                        size="lg"
                                        onClick={handleClockIn}
                                        disabled={loading}
                                        className="w-full max-w-xs mx-auto bg-emerald-600 hover:bg-emerald-700 text-white text-xl h-16 rounded-xl"
                                    >
                                        <Camera className="h-6 w-6 mr-3" />
                                        {loading ? 'Fichando...' : 'Fichar Entrada'}
                                    </Button>
                                </div>
                            )}

                            {/* Clock-out button (no camera needed) */}
                            {activeClockIn && !showCamera && (
                                <Button
                                    size="lg"
                                    onClick={handleClockOut}
                                    disabled={loading}
                                    className="w-full max-w-xs mx-auto bg-amber-600 hover:bg-amber-700 text-white text-xl h-16 rounded-xl"
                                >
                                    <LogOut className="h-6 w-6 mr-3" />
                                    {loading ? 'Fichando...' : 'Fichar Salida'}
                                </Button>
                            )}

                            <Button
                                variant="ghost"
                                onClick={handleClear}
                                className="text-slate-500 hover:text-white"
                            >
                                Cancelar
                            </Button>
                        </div>
                    ) : (
                        <div className="text-center space-y-4">
                            <Unlock className="h-16 w-16 text-slate-600 mx-auto" />
                            <p className="text-xl text-slate-400">
                                Introduce tu PIN de 6 dígitos
                            </p>
                            {error && (
                                <div className="flex items-center gap-2 text-red-400 justify-center">
                                    <AlertCircle className="h-5 w-5" />
                                    <span>{error}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right side: PIN Pad */}
                {!employee && (
                    <div className="flex flex-col items-center gap-6">
                        {/* PIN display */}
                        <div className="flex gap-3">
                            {Array.from({ length: PIN_LENGTH }).map((_, i) => (
                                <div
                                    key={i}
                                    className={`w-12 h-12 rounded-xl border-2 flex items-center justify-center transition-all duration-200 ${i < pin.length
                                        ? 'border-indigo-500 bg-indigo-500/20'
                                        : 'border-slate-600 bg-slate-800'
                                        }`}
                                >
                                    {i < pin.length && (
                                        <div className="w-4 h-4 rounded-full bg-indigo-400" />
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Keypad */}
                        <div className="grid grid-cols-3 gap-3">
                            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'del'].map(
                                (key) => {
                                    if (key === '') return <div key="empty" />;
                                    if (key === 'del') {
                                        return (
                                            <button
                                                key="del"
                                                onClick={handleDelete}
                                                disabled={loading || pin.length === 0}
                                                className="w-20 h-20 rounded-2xl bg-slate-700/50 hover:bg-slate-700 active:bg-slate-600 flex items-center justify-center transition-all duration-150 disabled:opacity-30"
                                            >
                                                <Delete className="h-7 w-7 text-slate-300" />
                                            </button>
                                        );
                                    }
                                    return (
                                        <button
                                            key={key}
                                            onClick={() => handleDigit(key)}
                                            disabled={loading || pin.length >= PIN_LENGTH}
                                            className="w-20 h-20 rounded-2xl bg-slate-700/50 hover:bg-slate-700 active:bg-indigo-600 text-3xl font-bold text-white transition-all duration-150 disabled:opacity-30 active:scale-95"
                                        >
                                            {key}
                                        </button>
                                    );
                                }
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

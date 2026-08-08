'use client';

import { useEffect, useState, useCallback, lazy, Suspense, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { useSocketStore } from '@/stores/socket-store';
import { useTripStore } from '@/stores/trip-store';
import { formatCurrency } from '@/lib/utils';
import api from '@/lib/api';
import RatingModal from '@/components/rating-modal';
import MapSkeleton from '@/components/map/map-skeleton';

const MapView = lazy(() => import('@/components/map/map-view'));

/* ─── Status config ────────────────────────────────────────── */
const stateConfig: Record<string, {
  label: string; sub: string; icon: string;
  color: string; bg: string; border: string; accent: string;
  step: number;
}> = {
  SEARCHING: {
    label: 'Finding your driver', sub: 'Scanning nearby drivers...',
    icon: '🔍', color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200', accent: 'bg-amber-500',
    step: 1,
  },
  MATCHED: {
    label: 'Driver on the way', sub: 'Your driver is heading to pickup',
    icon: '🚗', color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', accent: 'bg-blue-500',
    step: 2,
  },
  ARRIVED: {
    label: 'Driver has arrived', sub: 'Your driver is waiting at pickup',
    icon: '📍', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-500',
    step: 2,
  },
  IN_TRANSIT: {
    label: 'Trip in progress', sub: 'Enjoy your ride!',
    icon: '🛣️', color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-200', accent: 'bg-indigo-500',
    step: 3,
  },
  COMPLETED: {
    label: 'Trip completed', sub: 'Thanks for riding with us!',
    icon: '✅', color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-200', accent: 'bg-green-500',
    step: 4,
  },
  CANCELLED: {
    label: 'Trip cancelled', sub: 'No charges applied',
    icon: '❌', color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200', accent: 'bg-red-500',
    step: 0,
  },
};

const stepLabels = ['Searching', 'Matched', 'In Transit', 'Completed'];

export default function ActiveTripPage() {
  const router = useRouter();
  const params = useParams();
  const tripId = params.id as string;

  const user = useAuthStore((s) => s.user);
  const socket = useSocketStore((s) => s.socket);
  const tripState = useTripStore((s) => s.state);
  const tripData = useTripStore((s) => s.data);
  const driverLocation = useTripStore((s) => s.driverLocation);
  const driverDisconnected = useTripStore((s) => s.driverDisconnected);
  const reset = useTripStore((s) => s.reset);

  const isDriver = user?.role === 'DRIVER';
  const config = stateConfig[tripState] || stateConfig.SEARCHING;

  const [elapsed, setElapsed] = useState(0);
  const [showSOS, setShowSOS] = useState(false);
  const [sosContacts, setSosContacts] = useState<{name: string, phone: string, callLink: string}[] | null>(null);
  const [sosLoading, setSosLoading] = useState(false);
  const [showRating, setShowRating] = useState(false);
  const [fetchingTrip, setFetchingTrip] = useState(false);
  const [etaSeconds, setEtaSeconds] = useState<number | null>(null);
  
  // Chat State
  const [messages, setMessages] = useState<any[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [chatInput, setChatInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Split Fare State
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitCount, setSplitCount] = useState(2);
  const [shareData, setShareData] = useState<{shareCode: string, perPersonAmount: number, splitCount: number, shareLink: string} | null>(null);
  const [splitLoading, setSplitLoading] = useState(false);
  
  // PIN State
  const [pin, setPin] = useState(['', '', '', '']);
  const [pinError, setPinError] = useState(false);
  const pinInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  const driverLocationRef = useRef(driverLocation);
  useEffect(() => { driverLocationRef.current = driverLocation; }, [driverLocation]);

  useEffect(() => {
    if (isDriver || tripState !== 'MATCHED' || !tripData) return;

    const fetchEta = async () => {
      const loc = driverLocationRef.current;
      if (!loc) return;
      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${loc.lng},${loc.lat};${tripData.pickupLng},${tripData.pickupLat}?overview=false`);
        const data = await res.json();
        if (data.routes && data.routes[0]) {
          setEtaSeconds(data.routes[0].duration);
        }
      } catch (err) {
        console.error('Failed to fetch ETA', err);
      }
    };

    fetchEta();
    const interval = setInterval(fetchEta, 15000);
    return () => clearInterval(interval);
  }, [isDriver, tripState, tripData]);


  // ── API Fallback: Hydrate trip store on page refresh ──────
  // WHY: After a browser refresh, the Zustand trip-store is empty
  // (state = 'IDLE'). Without this, the page would redirect to
  // /dashboard. Instead, we fetch the trip from the API and
  // restore the store so the page can render correctly.
  useEffect(() => {
    if (tripState !== 'IDLE' || fetchingTrip) return;
    setFetchingTrip(true);
    api.get(`/trips/${tripId}`)
      .then((res) => {
        const trip = res.data;
        // Map API status to our store state
        const statusMap: Record<string, () => void> = {
          REQUESTED: () => useTripStore.getState().setSearching({
            tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
            dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
          }),
          MATCHED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
              rideOtp: trip.rideOtp,
            });
            useTripStore.getState().setMatched({
              tripId: trip.id, driverId: trip.driverId,
              driverName: trip.driver?.name, fare: trip.fare,
              rideOtp: trip.rideOtp,
            });
          },
          STARTED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setInTransit();
          },
          COMPLETED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setCompleted(trip.fare);
          },
          CANCELLED: () => {
            useTripStore.getState().setSearching({
              tripId: trip.id, pickupLat: trip.pickupLat, pickupLng: trip.pickupLng,
              dropLat: trip.dropLat, dropLng: trip.dropLng, fare: trip.fare,
            });
            useTripStore.getState().setCancelled();
          },
        };
        const handler = statusMap[trip.status];
        if (handler) handler();
        else router.replace('/dashboard');
      })
      .catch(() => {
        toast.error('Trip not found');
        router.replace('/dashboard');
      })
      .finally(() => setFetchingTrip(false));
  }, [tripState, tripId, fetchingTrip, router]);

  // Auto-show rating modal when trip completes (riders only)
  useEffect(() => {
    if (tripState === 'COMPLETED' && !isDriver) {
      const timer = setTimeout(() => setShowRating(true), 800);
      return () => clearTimeout(timer);
    }
  }, [tripState, isDriver]);

  // Chat Socket Listeners
  useEffect(() => {
    if (!socket || !tripId) return;

    socket.emit('chat:history', { tripId });

    const handleReceive = (msg: any) => {
      setMessages(prev => [...prev, msg]);
      if (!chatOpen && msg.senderId !== user?.id) {
        setUnreadCount(prev => prev + 1);
      }
    };
    const handleHistory = (msgs: any[]) => {
      setMessages(msgs);
    };

    socket.on('chat:receive', handleReceive);
    socket.on('chat:history', handleHistory);

    return () => {
      socket.off('chat:receive', handleReceive);
      socket.off('chat:history', handleHistory);
    };
  }, [socket, tripId, chatOpen, user?.id]);

  // Listen for PIN error
  useEffect(() => {
    if (!socket) return;
    const handlePinError = (data: { message: string }) => {
      toast.error(data.message);
      setPinError(true);
      setTimeout(() => setPinError(false), 500); // clear shake after 500ms
      setPin(['', '', '', '']);
      pinInputRefs.current[0]?.focus();
    };
    socket.on('trip:pin-error', handlePinError);
    return () => {
      socket.off('trip:pin-error', handlePinError);
    };
  }, [socket]);

  useEffect(() => {
    if (chatOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setUnreadCount(0);
    }
  }, [messages, chatOpen]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || !socket) return;
    socket.emit('chat:send', { tripId, content: chatInput.trim() });
    setChatInput('');
  };

  // Timer
  useEffect(() => {
    if (tripState !== 'IN_TRANSIT') return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [tripState]);

  // If trip is idle AND we're not fetching, redirect back
  useEffect(() => {
    if (tripState === 'IDLE' && !fetchingTrip) {
      // Don't redirect immediately — give the API fetch a chance
      const timeout = setTimeout(() => {
        if (useTripStore.getState().state === 'IDLE') {
          router.replace('/dashboard');
        }
      }, 2000);
      return () => clearTimeout(timeout);
    }
  }, [tripState, fetchingTrip, router]);

  // Driver location broadcasting
  useEffect(() => {
    if (!isDriver || !socket) return;
    if (tripState !== 'MATCHED' && tripState !== 'IN_TRANSIT') return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        socket.emit('driver:location_update', {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          tripId,
        });
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [isDriver, socket, tripState, tripId]);

  const handleCancel = useCallback(() => {
    if (!socket || !tripId) return;
    socket.emit('trip:cancel', { tripId, reason: 'Cancelled by user' });
    toast('Trip cancelled');
    reset();
    router.replace('/dashboard');
  }, [socket, tripId, reset, router]);

  const handleStartTrip = useCallback(() => {
    if (!socket) return;
    const pinString = pin.join('');
    if (pinString.length !== 4) return;
    socket.emit('trip:start', { tripId, pin: pinString });
  }, [socket, tripId, pin]);

  const handleCompleteTrip = useCallback(() => {
    if (!socket) return;
    socket.emit('trip:complete', { tripId });
    toast.success('Trip completed!');
  }, [socket, tripId]);

  const handleBackHome = useCallback(() => {
    reset();
    router.replace('/dashboard');
  }, [reset, router]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const mapCenter: [number, number] = driverLocation
    ? [driverLocation.lat, driverLocation.lng]
    : tripData
      ? [tripData.pickupLat, tripData.pickupLng]
      : [28.6139, 77.209];

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 pb-8">

        {/* ── Progress Steps ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5"
        >
          <div className="flex items-center gap-1 mb-4">
            {stepLabels.map((label, i) => {
              const active = config.step >= i + 1;
              const current = config.step === i + 1;
              return (
                <div key={label} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="w-full flex items-center">
                    <div className={`flex-1 h-1 rounded-full transition-all duration-500 ${
                      active ? 'bg-indigo-500' : 'bg-gray-200'
                    } ${current ? 'animate-pulse' : ''}`} />
                  </div>
                  <span className={`text-[10px] font-medium uppercase tracking-wider ${
                    active ? 'text-indigo-600' : 'text-gray-300'
                  }`}>{label}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Status Banner ───────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`flex items-center justify-between px-5 py-3.5 rounded-xl mb-5 border ${config.bg} ${config.border}`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl">{config.icon}</span>
            <div>
              <p className={`text-sm font-semibold ${config.color}`}>{config.label}</p>
              <p className="text-[11px] text-gray-400">{config.sub}</p>
            </div>
          </div>
          <div className="text-right">
            {tripData?.fare && (
              <p className="text-sm font-bold text-gray-900">{formatCurrency(tripData.fare)}</p>
            )}
            {tripState === 'IN_TRANSIT' && (
              <p className="text-[11px] text-gray-400 font-mono">{formatTime(elapsed)}</p>
            )}
          </div>
        </motion.div>

        {/* Driver disconnected warning */}
        <AnimatePresence>
          {driverDisconnected && tripState !== 'COMPLETED' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2.5 px-4 py-3 mb-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700 overflow-hidden"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              Driver connection lost. Attempting to reconnect...
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── ETA Badge ───────────────────────────── */}
        {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-4 flex items-center justify-between text-white shadow-lg"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-xl">
                {tripState === 'IN_TRANSIT' ? '🛣️' : '⏱️'}
              </div>
              <div>
                <p className="text-sm font-semibold opacity-90">
                  {tripState === 'IN_TRANSIT' ? 'En route to destination' : 'Driver arriving in'}
                </p>
                <p className="text-xl font-bold">
                  {tripState === 'IN_TRANSIT' ? 'Enjoy your ride!' : etaSeconds !== null ? `${Math.ceil(etaSeconds / 60)} min` : 'Calculating...'}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Ride PIN Card ───────────────────────────── */}
        {!isDriver && tripState === 'MATCHED' && tripData?.rideOtp && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-5 bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-5 text-white shadow-xl flex flex-col items-center justify-center text-center relative overflow-hidden"
          >
            {/* Background design elements */}
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-indigo-400/20 rounded-full blur-2xl"></div>
            
            <p className="text-sm font-semibold opacity-90 mb-1 z-10">Share this PIN with your driver</p>
            <p className="text-xs text-indigo-200 mb-4 z-10">Your driver will ask for this PIN to verify your identity</p>
            
            <div className="flex gap-2.5 z-10">
              {tripData.rideOtp.split('').map((digit, i) => (
                <div key={i} className="w-12 h-14 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center text-2xl font-bold text-white border border-white/30 shadow-inner">
                  {digit}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Main Grid ───────────────────────────── */}
        <div className="flex flex-col-reverse lg:grid lg:grid-cols-3 gap-5">

          {tripState === 'COMPLETED' ? (
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-200 shadow-sm p-6 printable-receipt">
              <style>{`@media print { body * { visibility: hidden; } .printable-receipt, .printable-receipt * { visibility: visible; } .printable-receipt { position: absolute; left: 0; top: 0; width: 100%; border: none; box-shadow: none; } .hide-on-print { display: none !important; } }`}</style>
              <div className="text-center mb-6">
                <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-3 text-3xl">✓</div>
                <h2 className="text-2xl font-bold text-gray-900">Trip Receipt</h2>
                <p className="text-sm text-gray-500">{new Date((tripData as any)?.completedAt || Date.now()).toLocaleString()}</p>
                <p className="text-xs text-gray-400 mt-1 font-mono">ID: {tripId.split('-')[0]}</p>
              </div>

              <div className="space-y-6">
                <div className="flex justify-between items-start pb-6 border-b border-gray-100">
                  <div className="flex-1">
                    <p className="text-xs text-gray-500 mb-1">Pickup</p>
                    <p className="text-sm font-medium text-gray-900">{(tripData as any)?.pickupAddress || `${tripData?.pickupLat.toFixed(4)}, ${tripData?.pickupLng.toFixed(4)}`}</p>
                  </div>
                  <div className="px-4 text-gray-300">→</div>
                  <div className="flex-1 text-right">
                    <p className="text-xs text-gray-500 mb-1">Drop-off</p>
                    <p className="text-sm font-medium text-gray-900">{(tripData as any)?.dropAddress || `${tripData?.dropLat.toFixed(4)}, ${tripData?.dropLng.toFixed(4)}`}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pb-6 border-b border-gray-100">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Distance</p>
                    <p className="text-sm font-medium text-gray-900">{(tripData as any)?.distanceKm?.toFixed(1) || '--'} km</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 mb-1">Duration</p>
                    <p className="text-sm font-medium text-gray-900">{(tripData as any)?.durationMin || '--'} min</p>
                  </div>
                </div>

                <div className="space-y-3 pb-6 border-b border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-900 mb-4">Fare Breakdown</h3>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Base Fare</span>
                    <span className="font-medium">{formatCurrency((tripData as any)?.baseFare || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Distance Charge</span>
                    <span className="font-medium">{formatCurrency((tripData as any)?.distanceFare || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Time Charge</span>
                    <span className="font-medium">{formatCurrency((tripData as any)?.timeFare || 0)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Platform Fee</span>
                    <span className="font-medium">{formatCurrency((tripData as any)?.platformFee || 0)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-bold pt-3 mt-3 border-t border-gray-100">
                    <span>Total Amount</span>
                    <span>{formatCurrency(tripData?.fare || 0)}</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-sm">
                  <span className="text-gray-600">Payment Method</span>
                  <span className="font-medium px-3 py-1 bg-gray-100 rounded-lg">{(tripData as any)?.paymentMethod || 'CARD'}</span>
                </div>

                <div className="flex gap-3 mt-6 hide-on-print">
                  <button onClick={() => window.print()} className="flex-1 py-3 bg-indigo-50 text-indigo-700 font-semibold rounded-xl hover:bg-indigo-100 transition-colors flex items-center justify-center gap-2 cursor-pointer">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
                    Download Receipt
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.1 }}
              className="lg:col-span-2 h-[350px] lg:h-[450px] rounded-2xl overflow-hidden border border-gray-200 shadow-sm"
            >
              <Suspense
                fallback={
                  <div className="w-full h-full bg-gray-100 flex items-center justify-center">
                    <div className="w-8 h-8 border-3 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                }
              >
                <MapView
                  center={mapCenter}
                  pickup={tripData ? [tripData.pickupLat, tripData.pickupLng] : null}
                  dropoff={tripData ? [tripData.dropLat, tripData.dropLng] : null}
                  driverLocation={driverLocation}
                />
              </Suspense>
            </motion.div>
          )}

          {/* Right Panel */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="flex flex-col gap-4"
          >
            {/* Driver Info Card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] overflow-hidden">
              {tripData?.driverName ? (
                <div className="p-5">
                  <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Your Driver</p>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-lg font-bold text-white shadow-lg shadow-indigo-500/20">
                      {tripData.driverName[0]}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{tripData.driverName}</p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-xs text-amber-500">★</span>
                        <span className="text-xs text-gray-500 font-medium">4.9</span>
                        <span className="text-xs text-gray-300 mx-1">·</span>
                        <span className="text-xs text-gray-400">128 rides</span>
                      </div>
                    </div>
                  </div>
                  {/* Vehicle info */}
                  <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl">
                    <span className="text-lg">🚗</span>
                    <div>
                      <p className="text-xs font-semibold text-gray-700">{(tripData as any)?.driver?.vehicleModel || (tripData as any)?.vehicleType || 'Vehicle'}</p>
                      <p className="text-[10px] text-gray-400">{(tripData as any)?.driver?.vehicleNumber || ''}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-5 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 bg-gray-100 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-indigo-500 rounded-full animate-spin" />
                  </div>
                  <p className="text-sm font-medium text-gray-500">Finding your driver...</p>
                  <p className="text-xs text-gray-400 mt-1">This usually takes less than 30 seconds</p>
                </div>
              )}
            </div>

            {/* Route Info */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-[0_2px_12px_rgba(0,0,0,0.04)] p-5">
              <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-3">Route</p>
              <div className="flex items-start gap-3">
                <div className="flex flex-col items-center gap-0.5 mt-1">
                  <div className="w-3 h-3 rounded-full bg-green-500 border-2 border-white shadow" />
                  <div className="w-px h-8 bg-gray-200" />
                  <div className="w-3 h-3 rounded-full bg-red-500 border-2 border-white shadow" />
                </div>
                <div className="flex flex-col gap-4 flex-1">
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Pickup</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {tripData ? `${tripData.pickupLat.toFixed(4)}, ${tripData.pickupLng.toFixed(4)}` : '—'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-gray-900">Drop-off</p>
                    <p className="text-[11px] text-gray-400 truncate">
                      {tripData ? `${tripData.dropLat.toFixed(4)}, ${tripData.dropLng.toFixed(4)}` : '—'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <button
                  onClick={() => setChatOpen(true)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer relative"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  <span className="text-[10px] font-medium text-gray-600">Chat</span>
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-red-500 text-[8px] font-bold text-white">
                      {unreadCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => {
                    if ((tripData as any)?.driver?.phone) {
                      window.open(`tel:${(tripData as any).driver.phone}`);
                    } else {
                      toast('Driver phone not available');
                    }
                  }}
                  aria-label="Call Driver"
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                  <span className="text-[10px] font-medium text-gray-600">Call</span>
                </button>
                <button
                  onClick={() => setSplitOpen(true)}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <span className="text-lg leading-none mt-0.5">💰</span>
                  <span className="text-[10px] font-medium text-gray-600">Split Fare</span>
                </button>
                <button
                  onClick={() => toast.info('Trip link copied!')}
                  className="flex flex-col items-center gap-1.5 p-3 bg-white rounded-xl border border-gray-200 hover:bg-gray-50 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4f46e5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  <span className="text-[10px] font-medium text-gray-600">Share</span>
                </button>
                <button
                  onClick={() => setShowSOS(!showSOS)}
                  aria-label="Emergency SOS"
                  className="flex flex-col items-center gap-1.5 p-3 bg-red-50 rounded-xl border border-red-200 hover:bg-red-100 transition-all cursor-pointer"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <span className="text-[10px] font-medium text-red-600">SOS</span>
                </button>
              </div>
            )}

            {/* SOS Expanded */}
            <AnimatePresence>
              {showSOS && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border-2 border-red-500 rounded-xl p-4 overflow-hidden shadow-[0_0_15px_rgba(239,68,68,0.2)] animate-pulse"
                >
                  <p className="text-base font-bold text-red-700 mb-1">Emergency Help</p>
                  <p className="text-xs text-red-500 mb-4 font-medium">Your emergency contacts will receive your live location.</p>
                  <div className="flex flex-col gap-3">
                    <a
                      href="tel:112"
                      className="w-full py-3 bg-red-600 text-white text-sm font-bold rounded-lg hover:bg-red-700 transition-colors text-center block shadow-lg shadow-red-500/30"
                    >
                      📞 CALL 112 (EMERGENCY)
                    </a>
                    
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          const lat = tripData?.pickupLat;
                          const lng = tripData?.pickupLng;
                          navigator.share({
                            title: 'My Live Location',
                            text: 'I need help! Here is my live location.',
                            url: `https://www.google.com/maps?q=${lat},${lng}`,
                          }).catch(console.error);
                        } else {
                          toast.error('Sharing not supported on this browser');
                        }
                      }}
                      className="w-full py-2.5 bg-white text-gray-700 text-sm font-semibold rounded-lg border border-gray-300 hover:bg-gray-50 transition-colors cursor-pointer text-center flex items-center justify-center gap-2"
                    >
                      📍 Share Live Location
                    </button>

                    {!sosContacts ? (
                      <button
                        onClick={async () => {
                          try {
                            setSosLoading(true);
                            const res = await api.post('/emergency/alert', {
                              tripId,
                              lat: tripData?.pickupLat,
                              lng: tripData?.pickupLng,
                            });
                            setSosContacts(res.data.contacts || []);
                            toast.success('🚨 SOS alert sent to your emergency contacts!');
                          } catch {
                            toast.error('Failed to send SOS alert. Call 112 directly.');
                          } finally {
                            setSosLoading(false);
                          }
                        }}
                        disabled={sosLoading}
                        className="w-full py-2.5 bg-red-100 text-red-700 text-sm font-bold rounded-lg border border-red-300 hover:bg-red-200 transition-colors cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
                      >
                        {sosLoading ? (
                          <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          '🚨 Alert Emergency Contacts'
                        )}
                      </button>
                    ) : (
                      <div className="mt-2 bg-white rounded-lg p-3 border border-red-200">
                        <p className="text-xs font-bold text-red-600 mb-2">Notified Contacts:</p>
                        {sosContacts.length > 0 ? (
                          <div className="flex flex-col gap-2">
                            {sosContacts.map((c, i) => (
                              <a
                                key={i}
                                href={c.callLink || `tel:${c.phone}`}
                                className="flex items-center justify-between py-2 px-3 bg-red-50 rounded-md hover:bg-red-100 transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-semibold text-gray-900">{c.name}</p>
                                  <p className="text-xs text-gray-500">{c.phone}</p>
                                </div>
                                <span className="w-8 h-8 flex items-center justify-center bg-red-100 text-red-600 rounded-full">
                                  📞
                                </span>
                              </a>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 italic">No emergency contacts found.</p>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>

        {/* ── Action Buttons ──────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="flex gap-3 mt-5"
        >
          {/* Rider: Cancel during search */}
          {!isDriver && tripState === 'SEARCHING' && (
            <button onClick={handleCancel}
              className="flex-1 py-3.5 rounded-xl border-2 border-red-200 text-red-500 text-sm font-semibold hover:bg-red-50 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel Search
            </button>
          )}

          {/* Rider: Cancel during matched/transit */}
          {!isDriver && (tripState === 'MATCHED' || tripState === 'IN_TRANSIT') && (
            <button onClick={handleCancel}
              className="flex-1 py-3.5 rounded-xl border border-gray-200 text-gray-600 text-sm font-semibold hover:bg-gray-50 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Cancel Trip
            </button>
          )}

          {/* Driver: Start trip */}
          {isDriver && tripState === 'MATCHED' && (
            <div className="flex-1 flex flex-col gap-3">
              <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col items-center shadow-sm">
                <p className="text-sm font-semibold text-gray-900 mb-1">Enter Rider's PIN to start trip</p>
                <p className="text-[11px] text-gray-400 mb-4">Ask the rider for their 4-digit verification PIN</p>
                <motion.div 
                  className="flex gap-3"
                  animate={pinError ? { x: [-10, 10, -10, 10, 0] } : {}}
                  transition={{ duration: 0.4 }}
                >
                  {pin.map((digit, index) => (
                    <input
                      key={index}
                      ref={el => { pinInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) => {
                        const val = e.target.value.replace(/[^0-9]/g, '');
                        const newPin = [...pin];
                        newPin[index] = val;
                        setPin(newPin);
                        if (val && index < 3) pinInputRefs.current[index + 1]?.focus();
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Backspace' && !pin[index] && index > 0) {
                          pinInputRefs.current[index - 1]?.focus();
                        }
                      }}
                      className="w-12 h-14 border-2 border-gray-200 rounded-xl text-center text-xl font-bold text-gray-900 focus:border-indigo-500 focus:ring-0 transition-colors"
                    />
                  ))}
                </motion.div>
              </div>
              <button onClick={handleStartTrip}
                disabled={pin.join('').length !== 4}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white text-sm font-semibold shadow-lg shadow-green-500/25 hover:shadow-green-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                Rider Picked Up — Start Trip
              </button>
            </div>
          )}

          {/* Driver: Complete trip */}
          {isDriver && tripState === 'IN_TRANSIT' && (
            <button onClick={handleCompleteTrip}
              className="flex-1 py-3.5 rounded-xl bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/25 hover:shadow-indigo-500/40 hover:-translate-y-0.5 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Destination Reached — Complete Trip
            </button>
          )}

          {/* Trip ended */}
          {(tripState === 'COMPLETED' || tripState === 'CANCELLED') && (
            <button onClick={handleBackHome}
              className="flex-1 py-3.5 rounded-xl bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-all cursor-pointer flex items-center justify-center gap-2">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
              Back to Home
            </button>
          )}
        </motion.div>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {chatOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[60vh] max-h-[500px] flex-col rounded-t-2xl bg-gray-900/95 shadow-2xl backdrop-blur-xl border-t border-gray-800 w-full md:bottom-5 md:right-5 md:left-auto md:w-[380px] md:rounded-2xl md:border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 p-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                💬 Chat
              </h3>
              <button
                onClick={() => setChatOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <p className="text-sm text-gray-500">No messages yet.</p>
                  <p className="text-xs text-gray-600 mt-1">Send a message to your driver.</p>
                </div>
              ) : (
                messages.map((msg, idx) => {
                  const isMe = msg.senderId === user?.id;
                  return (
                    <div key={msg.id || idx} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                      {!isMe && (
                        <span className="mb-1 text-[10px] font-medium text-gray-500 ml-1">
                          {msg.senderName}
                        </span>
                      )}
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                          isMe
                            ? 'bg-blue-600 text-white rounded-br-sm'
                            : 'bg-gray-800 text-gray-100 rounded-bl-sm'
                        }`}
                      >
                        {msg.content}
                      </div>
                      <span className="mt-1 text-[9px] text-gray-600">
                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form onSubmit={sendChatMessage} className="border-t border-gray-800 p-4 flex gap-2">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 rounded-xl bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                disabled={!chatInput.trim()}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Split Fare Panel */}
      <AnimatePresence>
        {splitOpen && (
          <motion.div
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[60vh] max-h-[500px] flex-col rounded-t-2xl bg-gray-900/95 shadow-2xl backdrop-blur-xl border-t border-gray-800 w-full md:bottom-5 md:right-5 md:left-auto md:w-[380px] md:rounded-2xl md:border"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-800 p-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                💰 Split Fare
              </h3>
              <button
                onClick={() => setSplitOpen(false)}
                className="rounded-full p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              {!shareData ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-sm font-medium text-gray-300">How many people are riding?</label>
                    <div className="flex gap-2 mt-3">
                      {[2, 3, 4].map(num => (
                        <button
                          key={num}
                          onClick={() => setSplitCount(num)}
                          className={`flex-1 py-3 rounded-xl border font-bold text-lg transition-colors cursor-pointer ${splitCount === num ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700'}`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div className="bg-gray-800 rounded-xl p-4 flex justify-between items-center border border-gray-700">
                    <span className="text-gray-400 font-medium">Per Person</span>
                    <span className="text-2xl font-bold text-white">
                      {formatCurrency(Math.ceil((tripData?.fare || 0) / splitCount))}
                    </span>
                  </div>

                  <button
                    onClick={async () => {
                      try {
                        setSplitLoading(true);
                        const res = await api.post(`/trips/${tripId}/split`, { splitCount });
                        setShareData(res.data);
                      } catch (err) {
                        toast.error('Failed to generate split link');
                      } finally {
                        setSplitLoading(false);
                      }
                    }}
                    disabled={splitLoading}
                    className="w-full py-3.5 rounded-xl bg-indigo-600 text-white font-bold hover:bg-indigo-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {splitLoading ? 'Generating...' : 'Generate Share Link'}
                  </button>
                </div>
              ) : (
                <div className="space-y-6 text-center">
                  <div className="w-16 h-16 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mx-auto text-3xl mb-2">✓</div>
                  <h4 className="text-xl font-bold text-white">Link Generated!</h4>
                  <p className="text-sm text-gray-400">Share this link with your friends to split the fare.</p>
                  
                  <div className="bg-gray-800 rounded-xl p-3 flex items-center gap-2 border border-gray-700">
                    <input 
                      type="text" 
                      readOnly 
                      value={shareData.shareLink}
                      className="bg-transparent text-sm text-gray-300 flex-1 outline-none"
                    />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(shareData.shareLink);
                        toast.success('Copied to clipboard');
                      }}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white cursor-pointer"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                    </button>
                  </div>

                  <div className="flex flex-col gap-3 mt-4">
                    <a
                      href={`https://wa.me/?text=${encodeURIComponent(`Hey! Let's split our ride fare. Your share is ${formatCurrency(shareData.perPersonAmount)}. Pay here: ${shareData.shareLink}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full py-3 rounded-xl bg-[#25D366] text-white font-bold hover:bg-[#128C7E] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      Share via WhatsApp
                    </a>
                    
                    <button
                      onClick={() => {
                        if (navigator.share) {
                          navigator.share({
                            title: 'Split Ride Fare',
                            text: `Hey! Let's split our ride fare. Your share is ${formatCurrency(shareData.perPersonAmount)}.`,
                            url: shareData.shareLink
                          }).catch(console.error);
                        } else {
                          toast.error('Web Share API not supported');
                        }
                      }}
                      className="w-full py-3 rounded-xl bg-gray-700 text-white font-bold hover:bg-gray-600 transition-colors flex items-center justify-center gap-2 cursor-pointer"
                    >
                      More Options
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Footer spacer for mobile */}
      <div className="h-16 md:h-0" />

      {/* Rating Modal */}
      {showRating && tripData && (
        <RatingModal
          tripId={tripId}
          driverName={tripData.driverName || 'Driver'}
          fare={tripData.fare || 0}
          onClose={() => {
            setShowRating(false);
            reset();
            router.replace('/dashboard');
          }}
        />
      )}
    </div>
  );
}

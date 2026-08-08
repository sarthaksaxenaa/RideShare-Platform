'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import api from '@/lib/api';

interface TrackData {
  status: string;
  driverName: string | null;
  vehicleType: string | null;
  vehicleModel: string | null;
  vehicleNumber: string | null;
  pickupAddress: string | null;
  dropAddress: string | null;
  durationMin: number | null;
}

export default function TrackTripClient({ code }: { code: string }) {
  const [data, setData] = useState<TrackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const fetchTrip = async () => {
      try {
        const res = await api.get(`/trips/track/${code}`);
        setData(res.data);
      } catch (err: any) {
        setError(err.response?.data?.message || 'Failed to load trip details');
      } finally {
        setLoading(false);
      }
    };

    fetchTrip();
    
    // Poll every 15s for status updates
    interval = setInterval(fetchTrip, 15000);
    return () => clearInterval(interval);
  }, [code]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <div className="w-10 h-10 border-4 border-gray-800 border-t-teal-500 rounded-full animate-spin mb-4"></div>
        <p className="text-gray-400 font-medium tracking-wide">Locating trip...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-white">
        <div className="w-16 h-16 bg-red-900/30 text-red-500 rounded-full flex items-center justify-center mb-4 text-2xl">
          ⚠️
        </div>
        <h2 className="text-xl font-bold mb-2">Trip Not Found</h2>
        <p className="text-gray-400">{error || 'This tracking link is invalid or has expired.'}</p>
      </div>
    );
  }

  const isCompleted = data.status === 'COMPLETED' || data.status === 'CANCELLED';

  return (
    <div className="min-h-screen bg-gray-950 text-gray-200 selection:bg-teal-500/30">
      <div className="max-w-md mx-auto min-h-screen flex flex-col p-5">
        
        {/* Header */}
        <header className="flex items-center justify-between mb-8 mt-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-teal-400 to-emerald-600 flex items-center justify-center font-bold text-white shadow-lg shadow-teal-500/20">
              R
            </div>
            <span className="font-bold text-lg text-white tracking-wide">RideShare</span>
          </div>
          <div className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
            isCompleted 
              ? 'bg-gray-800 text-gray-400' 
              : 'bg-teal-900/40 text-teal-400 border border-teal-800/50'
          }`}>
            {data.status.replace('_', ' ')}
          </div>
        </header>

        <main className="flex-1 flex flex-col gap-5">
          <h1 className="text-2xl font-bold text-white mb-2">Live Trip Tracking</h1>

          {/* Safety Notice */}
          {!isCompleted && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-teal-900/20 border border-teal-800/50 rounded-xl p-4 flex items-start gap-3"
            >
              <span className="text-xl mt-0.5">🛡️</span>
              <div>
                <p className="text-sm font-semibold text-teal-400">Tracked for Safety</p>
                <p className="text-xs text-teal-200/70 mt-1">
                  You are securely tracking this trip. Information is updated in real-time.
                </p>
              </div>
            </motion.div>
          )}

          {isCompleted && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4 flex items-center justify-center gap-3">
              <span className="text-xl">🏁</span>
              <p className="text-sm font-semibold text-gray-300">This trip has ended</p>
            </div>
          )}

          {/* Driver Info Card */}
          {data.driverName && (
            <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl mt-2">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-4">Driver Details</p>
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-gray-800 to-gray-700 flex items-center justify-center text-lg font-bold text-white border border-gray-700">
                    {data.driverName[0]}
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{data.driverName}</p>
                    <p className="text-xs text-gray-400 mt-0.5">RideShare Driver</p>
                  </div>
                </div>

                <div className="bg-gray-950 rounded-xl p-3 flex items-center gap-3 border border-gray-800/50">
                  <span className="text-2xl">🚗</span>
                  <div>
                    <p className="text-sm font-bold text-white">{data.vehicleModel || data.vehicleType || 'Vehicle'}</p>
                    <p className="text-xs text-gray-400 font-mono mt-0.5 tracking-widest">{data.vehicleNumber || '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Route Info */}
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 shadow-xl mt-2">
            <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-4">Route Info</p>
            <div className="flex items-start gap-4">
              <div className="flex flex-col items-center gap-1 mt-1.5">
                <div className="w-3 h-3 rounded-full bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.5)]" />
                <div className="w-0.5 h-10 bg-gray-800" />
                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
              </div>
              <div className="flex flex-col gap-5 flex-1">
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Pickup</p>
                  <p className="text-sm font-medium text-gray-200 mt-1 line-clamp-2 leading-relaxed">
                    {data.pickupAddress}
                  </p>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-gray-500 uppercase">Drop-off</p>
                  <p className="text-sm font-medium text-gray-200 mt-1 line-clamp-2 leading-relaxed">
                    {data.dropAddress}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
        </main>

        <footer className="mt-8 text-center border-t border-gray-900 pt-6">
          <p className="text-xs text-gray-600">Powered by RideShare Safety Platform</p>
        </footer>
      </div>
    </div>
  );
}

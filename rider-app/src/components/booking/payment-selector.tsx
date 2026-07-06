'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export type PaymentMethod = 'UPI' | 'CARD' | 'WALLET' | 'CASH';

interface PaymentSelectorProps {
  selected: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

const methods: { id: PaymentMethod; label: string; icon: string; sub: string }[] = [
  { id: 'UPI', label: 'UPI', icon: '📱', sub: 'Google Pay, PhonePe, Paytm' },
  { id: 'CARD', label: 'Card', icon: '💳', sub: 'Credit or Debit card' },
  { id: 'WALLET', label: 'Wallet', icon: '👛', sub: 'RideShare Wallet · ₹0.00' },
  { id: 'CASH', label: 'Cash', icon: '💵', sub: 'Pay driver directly' },
];

export default function PaymentSelector({ selected, onChange }: PaymentSelectorProps) {
  const [expanded, setExpanded] = useState(false);

  const current = methods.find((m) => m.id === selected) || methods[0];

  return (
    <div className="px-5 pb-3">
      {/* Collapsed: show selected method */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-all cursor-pointer"
      >
        <span className="text-lg">{current.icon}</span>
        <div className="flex-1 text-left">
          <p className="text-xs font-semibold text-gray-900">{current.label}</p>
          <p className="text-[10px] text-gray-400">{current.sub}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-gray-400 font-medium">Payment</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {/* Expanded: all methods */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="flex flex-col gap-1.5 mt-2">
              {methods.map((method) => {
                const isSelected = selected === method.id;
                return (
                  <button
                    key={method.id}
                    onClick={() => { onChange(method.id); setExpanded(false); }}
                    className={`flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-200'
                        : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200'
                    }`}
                  >
                    <span className="text-lg">{method.icon}</span>
                    <div className="flex-1 text-left">
                      <p className={`text-xs font-semibold ${isSelected ? 'text-indigo-700' : 'text-gray-900'}`}>
                        {method.label}
                      </p>
                      <p className="text-[10px] text-gray-400">{method.sub}</p>
                    </div>
                    {/* Radio indicator */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                      isSelected ? 'border-indigo-500' : 'border-gray-300'
                    }`}>
                      {isSelected && (
                        <motion.div
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          className="w-2 h-2 rounded-full bg-indigo-500"
                        />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

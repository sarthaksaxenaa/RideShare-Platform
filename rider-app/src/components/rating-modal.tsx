'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import api from '@/lib/api';

interface RatingModalProps {
  tripId: string;
  driverName: string;
  fare: number;
  onClose: () => void;
}

const quickTags = [
  { label: 'Clean Vehicle', emoji: '✨' },
  { label: 'Polite Driver', emoji: '😊' },
  { label: 'Smooth Ride', emoji: '🛣️' },
  { label: 'On Time', emoji: '⏰' },
  { label: 'Good Music', emoji: '🎵' },
  { label: 'Safe Driving', emoji: '🛡️' },
];

const starLabels = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'];

export default function RatingModal({ tripId, driverName, fare, onClose }: RatingModalProps) {
  const [stars, setStars] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleSubmit = useCallback(async () => {
    if (stars === 0) {
      toast.error('Please select a rating');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/ratings', {
        tripId,
        stars,
        comment: comment.trim() || null,
        tags: selectedTags.length > 0 ? selectedTags : null,
      });
      setSubmitted(true);
      toast.success('Thanks for your feedback!');
    } catch {
      toast.error('Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }, [tripId, stars, comment, selectedTags]);

  const activeStar = hoveredStar || stars;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center px-4"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden"
        >
          {!submitted ? (
            <>
              {/* Header gradient */}
              <div className="bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-600 px-6 pt-8 pb-10 text-center relative">
                <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-2xl font-bold text-white shadow-xl shadow-indigo-500/30 border-4 border-white">
                  {driverName[0]}
                </div>
                <p className="text-indigo-200 text-xs font-medium uppercase tracking-wider mb-1">Trip Completed</p>
                <h2 className="text-xl font-bold text-white">How was your ride?</h2>
              </div>

              <div className="px-6 pt-10 pb-6">
                {/* Driver name + fare */}
                <div className="text-center mb-5">
                  <p className="text-sm font-semibold text-gray-900">{driverName}</p>
                  <p className="text-xs text-gray-400">Fare: ₹{fare}</p>
                </div>

                {/* Stars */}
                <div className="flex items-center justify-center gap-2 mb-2">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setStars(s)}
                      onMouseEnter={() => setHoveredStar(s)}
                      onMouseLeave={() => setHoveredStar(0)}
                      className="cursor-pointer transition-transform hover:scale-110 active:scale-95"
                    >
                      <svg
                        width="36"
                        height="36"
                        viewBox="0 0 24 24"
                        fill={s <= activeStar ? '#f59e0b' : 'none'}
                        stroke={s <= activeStar ? '#f59e0b' : '#d1d5db'}
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                      </svg>
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm font-medium text-amber-600 h-5 mb-4">
                  {starLabels[activeStar] || ''}
                </p>

                {/* Quick tags */}
                <AnimatePresence>
                  {stars > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      transition={{ duration: 0.3 }}
                    >
                      <p className="text-[11px] text-gray-400 uppercase tracking-wider font-medium mb-2">Quick Feedback</p>
                      <div className="flex flex-wrap gap-2 mb-4">
                        {quickTags.map((tag) => (
                          <button
                            key={tag.label}
                            type="button"
                            onClick={() => toggleTag(tag.label)}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer border ${
                              selectedTags.includes(tag.label)
                                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                            }`}
                          >
                            <span>{tag.emoji}</span>
                            {tag.label}
                          </button>
                        ))}
                      </div>

                      {/* Comment */}
                      <textarea
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        placeholder="Add a comment (optional)..."
                        maxLength={200}
                        rows={2}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 placeholder:text-gray-400 outline-none resize-none transition-all focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/10"
                      />
                      <p className="text-[10px] text-gray-300 text-right mt-1">{comment.length}/200</p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Actions */}
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={onClose}
                    className="flex-1 py-3 rounded-xl border border-gray-200 text-sm font-medium text-gray-500 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    Skip
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={stars === 0 || submitting}
                    className="flex-1 py-3 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-sm font-semibold shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/30 hover:-translate-y-0.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      'Submit Rating'
                    )}
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-6 py-12 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
                className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center"
              >
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </motion.div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Thank you!</h3>
              <p className="text-sm text-gray-400 mb-6">Your feedback helps us improve</p>
              <button
                onClick={onClose}
                className="px-8 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-xl hover:bg-gray-800 transition-all cursor-pointer"
              >
                Done
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

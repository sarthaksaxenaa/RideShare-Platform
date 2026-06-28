'use client';

import { useState, type FormEvent } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';

export default function ProfilePage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const logout = useAuthStore((s) => s.logout);

  const [name, setName] = useState(user?.name || '');
  const [email] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);

  const initials = getInitials(user?.name || 'U');
  const isDriver = user?.role === 'DRIVER';

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.put('/auth/profile', { name: name.trim() });
      updateUser({ name: name.trim() });
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) { toast.error('Password must be at least 6 characters'); return; }
    setChangingPw(true);
    try {
      await api.put('/auth/password', { currentPassword, newPassword });
      toast.success('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to change password');
    } finally {
      setChangingPw(false);
    }
  };

  const handleLogout = () => {
    logout();
    window.location.href = '/login';
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-5 mb-8"
      >
        <div
          className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white ${
            isDriver ? 'bg-green-600' : 'bg-indigo-600'
          }`}
        >
          {initials}
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{user?.name}</h1>
          <p className="text-sm text-gray-400 mt-0.5">{user?.email}</p>
          <span
            className={`inline-block mt-1.5 px-2 py-0.5 rounded-md text-xs font-semibold ${
              isDriver
                ? 'bg-green-50 text-green-700 border border-green-200'
                : 'bg-indigo-50 text-indigo-700 border border-indigo-200'
            }`}
          >
            {isDriver ? 'Driver' : 'Rider'}
          </span>
        </div>
      </motion.div>

      {/* Profile Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Personal Information</h3>
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Email</label>
            <input
              value={email}
              disabled
              className="px-4 py-2.5 bg-gray-100 border border-gray-200 rounded-xl text-sm text-gray-400 cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={`self-end px-5 py-2.5 rounded-xl text-sm font-semibold text-white transition-all cursor-pointer disabled:opacity-60 ${
              isDriver
                ? 'bg-green-600 hover:bg-green-700'
                : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>
      </motion.div>

      {/* Password Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">New Password</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              minLength={6}
              className="px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-900 outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          <button
            type="submit"
            disabled={changingPw}
            className="self-end px-5 py-2.5 rounded-xl border border-gray-200 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors cursor-pointer disabled:opacity-60"
          >
            {changingPw ? 'Changing...' : 'Update Password'}
          </button>
        </form>
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white rounded-xl border border-red-200 p-6"
      >
        <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">Sign out from your account on this device.</p>
        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-xl border border-red-200 text-sm font-semibold text-red-500 hover:bg-red-50 transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}

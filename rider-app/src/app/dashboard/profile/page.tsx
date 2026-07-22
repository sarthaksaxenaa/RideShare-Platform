'use client';

import { useState, useEffect, useCallback, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { useAuthStore } from '@/stores/auth-store';
import { getInitials } from '@/lib/utils';
import api from '@/lib/api';

/**
 * 📚 SAVED LOCATION INTERFACE
 * Matches the Prisma SavedLocation model shape.
 * Each location has a label (Home/Work/Custom), coordinates,
 * and a reverse-geocoded address string.
 */
interface SavedLocation {
  id: string;
  label: string;
  icon: string;
  lat: number;
  lng: number;
  address: string;
}

/** Preset icons for quick location types */
const LOCATION_PRESETS = [
  { label: 'Home', icon: '🏠' },
  { label: 'Work', icon: '💼' },
  { label: 'Gym', icon: '🏋️' },
  { label: 'Custom', icon: '📍' },
];

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

  // ── Saved Locations State ─────────────────────────────────
  const [savedLocations, setSavedLocations] = useState<SavedLocation[]>([]);
  const [loadingLocations, setLoadingLocations] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addLabel, setAddLabel] = useState('Home');
  const [addIcon, setAddIcon] = useState('🏠');
  const [addAddress, setAddAddress] = useState('');
  const [addSuggestions, setAddSuggestions] = useState<{ display_name: string; lat: string; lon: string }[]>([]);
  const [addSaving, setAddSaving] = useState(false);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  // ── Emergency Contacts State ─────────────────────────
  interface EmergencyContact { id: string; name: string; phone: string; }
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [showAddContact, setShowAddContact] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [savingContact, setSavingContact] = useState(false);

  const initials = getInitials(user?.name || 'U');
  const isDriver = user?.role === 'DRIVER';

  // ── Fetch saved locations ─────────────────────────────────
  const fetchLocations = useCallback(async () => {
    try {
      const res = await api.get('/locations');
      setSavedLocations(res.data);
    } catch {
      // Silently fail — locations are a nice-to-have
    } finally {
      setLoadingLocations(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  // ── Fetch emergency contacts ────────────────────────
  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get('/emergency/contacts');
      setEmergencyContacts(res.data);
    } catch { /* ignore */ }
    finally { setLoadingContacts(false); }
  }, []);

  useEffect(() => { fetchContacts(); }, [fetchContacts]);

  const handleAddContact = async () => {
    if (!contactName.trim() || !contactPhone.trim()) {
      toast.error('Name and phone are required'); return;
    }
    setSavingContact(true);
    try {
      await api.post('/emergency/contacts', {
        name: contactName.trim(),
        phone: contactPhone.trim(),
      });
      toast.success('Emergency contact added');
      setContactName(''); setContactPhone('');
      setShowAddContact(false);
      fetchContacts();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to add contact');
    } finally { setSavingContact(false); }
  };

  const handleDeleteContact = async (id: string) => {
    try {
      await api.delete(`/emergency/contacts/${id}`);
      setEmergencyContacts((prev) => prev.filter((c) => c.id !== id));
      toast.success('Contact removed');
    } catch { toast.error('Failed to delete contact'); }
  };

  // ── Address search (Nominatim) ────────────────────────────
  /**
   * 📚 DEBOUNCED SEARCH
   * We don't fire an API call on every keystroke — that would
   * be 10+ requests for typing "Connaught Place". Instead, we
   * wait 400ms after the user STOPS typing, then fire once.
   * This is called "debouncing" — a fundamental UX optimization.
   */
  const handleAddressSearch = (query: string) => {
    setAddAddress(query);
    if (searchTimeout) clearTimeout(searchTimeout);
    if (query.length < 3) { setAddSuggestions([]); return; }
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=in`,
          { headers: { 'User-Agent': 'RideShareApp/1.0' } }
        );
        const data = await res.json();
        setAddSuggestions(data);
      } catch { /* ignore */ }
    }, 400);
    setSearchTimeout(timeout);
  };

  // ── Save a new location ───────────────────────────────────
  const handleSaveLocation = async (suggestion: { display_name: string; lat: string; lon: string }) => {
    setAddSaving(true);
    try {
      await api.post('/locations', {
        label: addLabel,
        icon: addIcon,
        lat: parseFloat(suggestion.lat),
        lng: parseFloat(suggestion.lon),
        address: suggestion.display_name.split(', ').slice(0, 4).join(', '),
      });
      toast.success(`${addLabel} location saved!`);
      setShowAddForm(false);
      setAddAddress('');
      setAddSuggestions([]);
      fetchLocations();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      toast.error(axiosErr?.response?.data?.message || 'Failed to save location');
    } finally {
      setAddSaving(false);
    }
  };

  // ── Delete a location ─────────────────────────────────────
  const handleDeleteLocation = async (id: string) => {
    try {
      await api.delete(`/locations/${id}`);
      setSavedLocations((prev) => prev.filter((l) => l.id !== id));
      toast.success('Location removed');
    } catch {
      toast.error('Failed to delete location');
    }
  };

  const handleUpdateProfile = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Name cannot be empty'); return; }
    setSaving(true);
    try {
      await api.put('/users/me', { name: name.trim() });
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
      await api.put('/users/me/password', { currentPassword, newPassword });
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
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">{user?.name}</h1>
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
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mb-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Personal Information</h3>
        <form onSubmit={handleUpdateProfile} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Email</label>
            <input
              value={email}
              disabled
              className="px-4 py-2.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-400 cursor-not-allowed"
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

      {/* ── Saved Locations ─────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Saved Locations</h3>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition-colors cursor-pointer"
          >
            {showAddForm ? '✕ Cancel' : '+ Add Location'}
          </button>
        </div>

        {/* Add Form */}
        <AnimatePresence>
          {showAddForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
                {/* Label selector */}
                <p className="text-xs font-semibold text-gray-500 mb-2">Location Type</p>
                <div className="flex gap-2 mb-3">
                  {LOCATION_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      onClick={() => { setAddLabel(preset.label); setAddIcon(preset.icon); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        addLabel === preset.label
                          ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 dark:bg-indigo-900 dark:text-indigo-300 dark:border-indigo-700'
                          : 'bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {preset.icon} {preset.label}
                    </button>
                  ))}
                </div>

                {/* Address search */}
                <p className="text-xs font-semibold text-gray-500 mb-2">Search Address</p>
                <input
                  value={addAddress}
                  onChange={(e) => handleAddressSearch(e.target.value)}
                  placeholder="Type an address..."
                  className="w-full px-4 py-2.5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10 placeholder:text-gray-400"
                />

                {/* Suggestions */}
                {addSuggestions.length > 0 && (
                  <div className="mt-2 border border-gray-200 dark:border-gray-600 rounded-xl overflow-hidden divide-y divide-gray-100 dark:divide-gray-700">
                    {addSuggestions.map((s, i) => (
                      <button
                        key={i}
                        onClick={() => handleSaveLocation(s)}
                        disabled={addSaving}
                        className="w-full text-left px-4 py-3 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 transition-colors text-sm text-gray-700 dark:text-gray-300 cursor-pointer disabled:opacity-50"
                      >
                        <span className="text-indigo-500 mr-1.5">📍</span>
                        {s.display_name.split(', ').slice(0, 4).join(', ')}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Saved locations list */}
        {loadingLocations ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : savedLocations.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">📍</p>
            <p className="text-sm text-gray-400">No saved locations yet</p>
            <p className="text-xs text-gray-300 mt-1">Save your Home, Work, or favorite places for quick booking</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {savedLocations.map((loc) => (
              <div
                key={loc.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-lg shrink-0">
                  {loc.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{loc.label}</p>
                  <p className="text-xs text-gray-400 truncate">{loc.address}</p>
                </div>
                <button
                  onClick={() => handleDeleteLocation(loc.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                  title="Remove location"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Password Form */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mb-6"
      >
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-semibold text-gray-500">Current Password</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
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
              className="px-4 py-2.5 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none transition-all hover:border-gray-300 focus:border-indigo-500 focus:ring-3 focus:ring-indigo-500/10"
            />
          </div>
          <button
            type="submit"
            disabled={changingPw}
            className="self-end px-5 py-2.5 rounded-xl border border-gray-200 dark:border-gray-700 text-sm font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer disabled:opacity-60"
          >
            {changingPw ? 'Changing...' : 'Update Password'}
          </button>
        </form>
      </motion.div>

      {/* ── Emergency Contacts ───────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm p-6 mb-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Emergency Contacts</h3>
            <p className="text-xs text-gray-400 mt-0.5">Up to 3 contacts for SOS alerts during trips</p>
          </div>
          {emergencyContacts.length < 3 && (
            <button
              onClick={() => setShowAddContact(!showAddContact)}
              className="text-xs font-semibold text-red-500 hover:text-red-600 transition-colors cursor-pointer"
            >
              {showAddContact ? '✕ Cancel' : '+ Add Contact'}
            </button>
          )}
        </div>

        {/* Add Contact Form */}
        <AnimatePresence>
          {showAddContact && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="p-4 bg-red-50/50 dark:bg-red-950/20 rounded-xl border border-red-100 dark:border-red-900">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                    placeholder="Contact name"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-3 focus:ring-red-500/10 placeholder:text-gray-400"
                  />
                  <input
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="Phone number"
                    type="tel"
                    className="flex-1 px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white outline-none focus:border-red-500 focus:ring-3 focus:ring-red-500/10 placeholder:text-gray-400"
                  />
                  <button
                    onClick={handleAddContact}
                    disabled={savingContact}
                    className="px-5 py-2.5 rounded-xl bg-red-500 text-white text-sm font-semibold hover:bg-red-600 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {savingContact ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Contacts List */}
        {loadingContacts ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-5 h-5 border-2 border-gray-200 border-t-red-500 rounded-full animate-spin" />
          </div>
        ) : emergencyContacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">🚨</p>
            <p className="text-sm text-gray-400">No emergency contacts yet</p>
            <p className="text-xs text-gray-300 mt-1">Add contacts who will be notified if you trigger SOS during a trip</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {emergencyContacts.map((contact) => (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center text-lg shrink-0">
                  🚨
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-white">{contact.name}</p>
                  <p className="text-xs text-gray-400">{contact.phone}</p>
                </div>
                <button
                  onClick={() => handleDeleteContact(contact.id)}
                  className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-all cursor-pointer"
                  title="Remove contact"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Danger Zone */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-white dark:bg-gray-900 rounded-xl border border-red-200 dark:border-red-900 p-6"
      >
        <h3 className="text-sm font-semibold text-red-600 mb-2">Danger Zone</h3>
        <p className="text-xs text-gray-400 mb-4">Sign out from your account on this device.</p>
        <button
          onClick={handleLogout}
          className="px-5 py-2.5 rounded-xl border border-red-200 dark:border-red-800 text-sm font-semibold text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors cursor-pointer"
        >
          Sign Out
        </button>
      </motion.div>
    </div>
  );
}

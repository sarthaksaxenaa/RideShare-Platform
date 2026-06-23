import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api';
import styles from './Profile.module.css';

interface UserProfile {
  id: string;
  email: string;
  name: string;
  role: string;
  phone: string | null;
  createdAt: string;
}

function ProfilePage() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Edit profile
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState('');

  // Change password
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdMsg, setPwdMsg] = useState('');
  const [pwdError, setPwdError] = useState('');

  const isDriver = profile?.role === 'DRIVER';

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await api.get('/users/me');
      const user: UserProfile = res.data;
      setProfile(user);
      setEditName(user.name);
      setEditPhone(user.phone || '');
    } catch {
      // Fallback to localStorage
      try {
        const raw = localStorage.getItem('user');
        if (raw) {
          const user = JSON.parse(raw);
          setProfile(user);
          setEditName(user.name || '');
          setEditPhone(user.phone || '');
        }
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveMsg('');
    try {
      const res = await api.put('/users/me', {
        name: editName.trim(),
        phone: editPhone.trim(),
      });
      const updatedUser = res.data.user;
      setProfile(updatedUser);

      // Sync localStorage
      const raw = localStorage.getItem('user');
      if (raw) {
        const stored = JSON.parse(raw);
        stored.name = updatedUser.name;
        stored.phone = updatedUser.phone;
        localStorage.setItem('user', JSON.stringify(stored));
      }
      setSaveMsg('Profile updated successfully');
      setTimeout(() => setSaveMsg(''), 3000);
    } catch (err: any) {
      setSaveMsg(err?.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPwdError('');
    setPwdMsg('');

    if (newPwd !== confirmPwd) {
      setPwdError('New passwords do not match');
      return;
    }
    if (newPwd.length < 6) {
      setPwdError('Password must be at least 6 characters');
      return;
    }

    setPwdSaving(true);
    try {
      await api.put('/users/me/password', {
        currentPassword: currentPwd,
        newPassword: newPwd,
      });
      setPwdMsg('Password changed successfully');
      setCurrentPwd('');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => setPwdMsg(''), 3000);
    } catch (err: any) {
      setPwdError(err?.response?.data?.message || 'Failed to change password');
    } finally {
      setPwdSaving(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login', { replace: true });
  };

  const handleBack = () => {
    navigate('/', { replace: true });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className={styles.loadingPage}>
        <div className={styles.loadingSpinner} />
        <div className={styles.loadingText}>Loading profile...</div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${isDriver ? styles.pageDriver : ''}`}>
      {/* Background orbs */}
      <div className={styles.bgOrb1} />
      <div className={styles.bgOrb2} />

      {/* Back button */}
      <button className={styles.backBtn} onClick={handleBack}>
        <span className={styles.backArrow}>←</span> Back
      </button>

      <div className={styles.content}>
        {/* Profile Header */}
        <div className={styles.profileHeader}>
          <div className={`${styles.avatar} ${isDriver ? styles.avatarDriver : ''}`}>
            {profile?.name?.charAt(0)?.toUpperCase() || '?'}
          </div>
          <h1 className={styles.profileName}>{profile?.name}</h1>
          <p className={styles.profileEmail}>{profile?.email}</p>
          <div className={styles.badges}>
            <span className={`${styles.roleBadge} ${isDriver ? styles.roleBadgeDriver : ''}`}>
              {isDriver ? 'Driver' : 'Rider'}
            </span>
            {profile?.createdAt && (
              <span className={styles.dateBadge}>
                Member since {formatDate(profile.createdAt)}
              </span>
            )}
          </div>
        </div>

        {/* Edit Profile Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
            Edit Profile
          </h2>
          <form onSubmit={handleSaveProfile} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Full Name</label>
              <input
                className={styles.input}
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Your name"
                required
                minLength={2}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Phone Number</label>
              <input
                className={styles.input}
                type="tel"
                value={editPhone}
                onChange={(e) => setEditPhone(e.target.value)}
                placeholder="+91 9876543210"
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Email</label>
              <input
                className={`${styles.input} ${styles.inputDisabled}`}
                type="email"
                value={profile?.email || ''}
                disabled
              />
              <span className={styles.inputHint}>Email cannot be changed</span>
            </div>

            {saveMsg && (
              <div className={`${styles.msg} ${saveMsg.includes('success') ? styles.msgSuccess : styles.msgError}`}>
                {saveMsg}
              </div>
            )}

            <button
              type="submit"
              className={`${styles.saveBtn} ${isDriver ? styles.saveBtnDriver : ''}`}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
            Change Password
          </h2>
          <form onSubmit={handleChangePassword} className={styles.form}>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Current Password</label>
              <input
                className={styles.input}
                type="password"
                value={currentPwd}
                onChange={(e) => setCurrentPwd(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>New Password</label>
              <input
                className={styles.input}
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
              />
            </div>
            <div className={styles.inputGroup}>
              <label className={styles.label}>Confirm New Password</label>
              <input
                className={styles.input}
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {pwdError && <div className={`${styles.msg} ${styles.msgError}`}>{pwdError}</div>}
            {pwdMsg && <div className={`${styles.msg} ${styles.msgSuccess}`}>{pwdMsg}</div>}

            <button
              type="submit"
              className={styles.saveBtn}
              disabled={pwdSaving}
            >
              {pwdSaving ? 'Changing...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Danger Zone */}
        <div className={`${styles.section} ${styles.dangerSection}`}>
          <h2 className={styles.sectionTitle}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            Account
          </h2>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

export default ProfilePage;

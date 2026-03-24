import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, User, Mail } from 'lucide-react'
import AdminLayout from '../components/AdminLayout'
import { adminFetch, getToken } from '../hooks/useAdmin'

export default function AdminSettings() {
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    if (!getToken()) { navigate('/admin'); return }
    adminFetch('/api/admin/profile').then(data => {
      if (data) setProfile({ name: data.name || '', email: data.email || '' })
    })
  }, [navigate])

  const handleChangePassword = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess(false)

    if (newPassword !== confirmPassword) {
      setError('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json()
      if (res.ok) {
        setSuccess(true)
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
      } else {
        setError(data.error || 'Failed to change password')
      }
    } catch {
      setError('Unable to connect to server')
    } finally {
      setSaving(false)
    }
  }

  return (
    <AdminLayout>
      <h2 className="font-display font-bold text-xl text-charcoal-900 mb-6">Settings</h2>

      <div className="max-w-lg space-y-6">
        {/* Profile Info */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-display font-bold text-base text-charcoal-900 mb-4 flex items-center gap-2">
            <User size={18} className="text-forest-700" />
            Profile
          </h3>
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm">
              <User size={16} className="text-gray-400" />
              <span className="text-gray-500">Name:</span>
              <span className="font-medium text-charcoal-900">{profile.name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <Mail size={16} className="text-gray-400" />
              <span className="text-gray-500">Email:</span>
              <span className="font-medium text-charcoal-900">{profile.email}</span>
            </div>
          </div>
        </div>

        {/* Change Password */}
        <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
          <h3 className="font-display font-bold text-base text-charcoal-900 mb-4 flex items-center gap-2">
            <Lock size={18} className="text-forest-700" />
            Change Password
          </h3>

          {success && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm flex items-center gap-2">
              <CheckCircle size={16} />
              Password updated successfully!
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  required
                  placeholder="Enter current password"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-200 text-charcoal-900 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
                <button type="button" onClick={() => setShowCurrent(!showCurrent)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                  className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-200 text-charcoal-900 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none"
                />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                placeholder="Confirm new password"
                className={`w-full px-4 py-3 rounded-lg border ${confirmPassword && confirmPassword !== newPassword ? 'border-red-300' : 'border-gray-200'} text-charcoal-900 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none`}
              />
              {confirmPassword && confirmPassword !== newPassword && (
                <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
              )}
            </div>

            <button
              type="submit"
              disabled={saving || !currentPassword || !newPassword || newPassword !== confirmPassword}
              className="w-full btn-primary py-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Updating...' : 'Update Password'}
            </button>
          </form>
        </div>
      </div>
    </AdminLayout>
  )
}

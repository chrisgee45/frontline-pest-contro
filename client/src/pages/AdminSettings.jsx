import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Lock, Eye, EyeOff, CheckCircle, User, Mail, Database, Download, Upload, Camera, RotateCcw, AlertTriangle, Clock } from 'lucide-react'
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

      <div className="max-w-2xl space-y-6">
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

        {/* Data Backup & Restore */}
        <BackupSection />
      </div>
    </AdminLayout>
  )
}

// ===================
// BACKUP & RESTORE UI
// ===================

function fmtBytes(n) {
  if (!n) return '0 B'
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function fmtRelTime(iso) {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  const delta = Date.now() - then
  const mins = Math.floor(delta / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

function BackupSection() {
  const [snapshots, setSnapshots] = useState([])
  const [loadingSnapshots, setLoadingSnapshots] = useState(true)
  const [downloading, setDownloading] = useState(false)
  const [restoring, setRestoring] = useState(false)
  const [creating, setCreating] = useState(false)
  const [msg, setMsg] = useState(null)
  const fileInput = useRef(null)

  const fetchSnapshots = useCallback(async () => {
    setLoadingSnapshots(true)
    const res = await adminFetch('/api/admin/backup/snapshots')
    setLoadingSnapshots(false)
    if (res?.snapshots) setSnapshots(res.snapshots)
  }, [])

  useEffect(() => { fetchSnapshots() }, [fetchSnapshots])

  // Download the current state as a backup file. Uses fetch so the bearer
  // token is attached, then streams the blob through an anchor tag click.
  async function handleDownloadCurrent() {
    setDownloading(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/backup/download', {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      if (!res.ok) throw new Error('Download failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `frontline-backup-${new Date().toISOString().slice(0, 10)}.json.gz`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      setMsg({ kind: 'ok', text: 'Backup downloaded to your computer.' })
    } catch (e) {
      setMsg({ kind: 'err', text: e.message || 'Download failed' })
    } finally {
      setDownloading(false)
    }
  }

  async function handleCreateSnapshot() {
    setCreating(true); setMsg(null)
    const res = await adminFetch('/api/admin/backup/snapshot', {
      method: 'POST',
      body: JSON.stringify({ label: 'manual' }),
    })
    setCreating(false)
    if (res?.success) {
      setMsg({ kind: 'ok', text: `Snapshot created: ${res.snapshot.filename}` })
      fetchSnapshots()
    } else {
      setMsg({ kind: 'err', text: res?.error || 'Failed to create snapshot' })
    }
  }

  async function handleRestoreFromUpload(file) {
    if (!file) return
    const ok = window.confirm(
      `Restore from "${file.name}"?\n\n` +
      `This will OVERWRITE your current data with the contents of this backup. ` +
      `A safety snapshot of your current state will be created first so you can roll back if needed.\n\nContinue?`
    )
    if (!ok) return
    setRestoring(true); setMsg(null)
    try {
      const buf = await file.arrayBuffer()
      const res = await fetch('/api/admin/backup/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/gzip', Authorization: `Bearer ${getToken()}` },
        body: buf,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Restore failed')
      setMsg({ kind: 'ok', text: `Restored ${data.restored.length} files. Safety snapshot: ${data.preRestoreSnapshot?.filename || 'n/a'}` })
      fetchSnapshots()
    } catch (e) {
      setMsg({ kind: 'err', text: e.message })
    } finally {
      setRestoring(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleRestoreFromSnapshot(filename) {
    const ok = window.confirm(
      `Restore from "${filename}"?\n\n` +
      `This will OVERWRITE your current data with the contents of this snapshot. ` +
      `A safety snapshot of your current state will be created first so you can roll back if needed.\n\nContinue?`
    )
    if (!ok) return
    setRestoring(true); setMsg(null)
    const res = await adminFetch(`/api/admin/backup/snapshots/${encodeURIComponent(filename)}/restore`, {
      method: 'POST',
    })
    setRestoring(false)
    if (res?.success) {
      setMsg({ kind: 'ok', text: `Restored ${res.restored.length} files from ${filename}.` })
      fetchSnapshots()
    } else {
      setMsg({ kind: 'err', text: res?.error || 'Restore failed' })
    }
  }

  function handleDownloadSnapshot(filename) {
    // Simple anchor with auth header would be ideal; since anchor tags
    // can't set headers, fetch the blob then trigger download.
    fetch(`/api/admin/backup/snapshots/${encodeURIComponent(filename)}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    }).then(r => r.blob()).then(blob => {
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
  }

  const newestSnapshot = snapshots[0]

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
      <h3 className="font-display font-bold text-base text-charcoal-900 mb-1 flex items-center gap-2">
        <Database size={18} className="text-forest-700" />
        Data Backup &amp; Restore
      </h3>
      <p className="text-xs text-gray-500 mb-4">
        Full export of every lead, job, customer, invoice, payment, and ledger entry. Snapshots are written automatically to the persistent volume every 24 hours.
      </p>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg text-sm border ${
          msg.kind === 'ok'
            ? 'bg-green-50 border-green-200 text-green-700'
            : 'bg-red-50 border-red-200 text-red-700'
        }`}>
          <span className="flex items-center gap-2">
            {msg.kind === 'ok' ? <CheckCircle size={14} /> : <AlertTriangle size={14} />}
            {msg.text}
          </span>
        </div>
      )}

      {/* Top action row */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <button
          onClick={handleDownloadCurrent}
          disabled={downloading}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-forest-700 text-white text-sm font-medium hover:bg-forest-800 disabled:opacity-50"
        >
          <Download size={14} />
          {downloading ? 'Preparing…' : 'Download Backup'}
        </button>
        <button
          onClick={() => fileInput.current?.click()}
          disabled={restoring}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-charcoal-900 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <Upload size={14} />
          {restoring ? 'Restoring…' : 'Restore from File'}
        </button>
        <button
          onClick={handleCreateSnapshot}
          disabled={creating}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-gray-300 text-charcoal-900 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
        >
          <Camera size={14} />
          {creating ? 'Saving…' : 'Save Snapshot'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept=".gz,.json.gz,application/gzip"
          className="hidden"
          onChange={e => handleRestoreFromUpload(e.target.files?.[0])}
        />
      </div>

      {/* Snapshots list */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold text-charcoal-900 flex items-center gap-1.5">
            <Clock size={14} />Recent Snapshots
          </h4>
          {newestSnapshot && (
            <span className="text-[11px] text-gray-500">
              Last snapshot {fmtRelTime(newestSnapshot.createdAt)}
            </span>
          )}
        </div>
        {loadingSnapshots ? (
          <p className="text-sm text-gray-400 py-4 text-center">Loading…</p>
        ) : snapshots.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">
            No snapshots yet. The first auto-snapshot fires ~30 seconds after the server starts; daily thereafter.
          </p>
        ) : (
          <div className="space-y-1 max-h-[280px] overflow-y-auto border border-gray-100 rounded-lg">
            {snapshots.map(s => (
              <div key={s.filename} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-gray-50 border-b border-gray-100 last:border-0">
                <Database size={12} className="text-gray-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-mono text-[11px] truncate">{s.filename}</div>
                  <div className="text-[10px] text-gray-400">
                    {new Date(s.createdAt).toLocaleString()} · {fmtBytes(s.sizeBytes)}
                  </div>
                </div>
                <button
                  onClick={() => handleDownloadSnapshot(s.filename)}
                  title="Download this snapshot to your computer"
                  className="p-1.5 text-gray-400 hover:text-forest-700"
                >
                  <Download size={12} />
                </button>
                <button
                  onClick={() => handleRestoreFromSnapshot(s.filename)}
                  disabled={restoring}
                  title="Restore from this snapshot"
                  className="p-1.5 text-gray-400 hover:text-amber-600 disabled:opacity-50"
                >
                  <RotateCcw size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <p className="text-[10px] text-gray-400 mt-2">
          Only the 30 most recent snapshots are kept. Download important ones to your computer if you want to preserve them longer.
        </p>
      </div>
    </div>
  )
}

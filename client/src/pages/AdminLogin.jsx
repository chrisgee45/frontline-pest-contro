import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { LogIn, Eye, EyeOff, Mail, ArrowLeft } from 'lucide-react'
import { LogoIcon } from '../components/Logo'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json()

      if (res.ok && data.token) {
        localStorage.setItem('frontline_admin_token', data.token)
        navigate('/admin/dashboard')
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch {
      setError('Unable to connect to server')
    } finally {
      setLoading(false)
    }
  }

  const handleForgotPassword = async (e) => {
    e.preventDefault()
    // In production, this would send an actual email
    setForgotSent(true)
  }

  return (
    <div className="min-h-screen bg-charcoal-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <LogoIcon size={64} />
          </div>
          <h1 className="font-display font-extrabold text-2xl text-white">FRONTLINE</h1>
          <p className="text-gray-500 text-sm mt-1">Termite & Pest Control — Admin Portal</p>
        </div>

        {!showForgot ? (
          /* Login form */
          <form onSubmit={handleSubmit} className="bg-charcoal-900 rounded-2xl p-6 md:p-8 border border-charcoal-800">
            <h2 className="font-display font-bold text-xl text-white mb-6">Sign In</h2>

            {error && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-red-400 text-sm">
                {error}
              </div>
            )}

            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email"
                  className="w-full pl-10 pr-4 py-3 rounded-lg bg-charcoal-800 border border-charcoal-700 text-white placeholder-gray-600 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all"
                />
              </div>
            </div>

            <div className="mb-4">
              <label htmlFor="password" className="block text-sm font-medium text-gray-400 mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="Enter password"
                  className="w-full px-4 py-3 pr-12 rounded-lg bg-charcoal-800 border border-charcoal-700 text-white placeholder-gray-600 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="flex justify-end mb-6">
              <button
                type="button"
                onClick={() => { setShowForgot(true); setForgotEmail(email) }}
                className="text-sm text-forest-400 hover:text-forest-300 transition-colors"
              >
                Forgot password?
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full btn-primary py-3.5 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : (<><LogIn size={18} /> Sign In</>)}
            </button>
          </form>
        ) : (
          /* Forgot password form */
          <div className="bg-charcoal-900 rounded-2xl p-6 md:p-8 border border-charcoal-800">
            <button
              onClick={() => { setShowForgot(false); setForgotSent(false) }}
              className="flex items-center gap-1 text-sm text-gray-400 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeft size={16} /> Back to login
            </button>

            {forgotSent ? (
              <div className="text-center py-6">
                <div className="w-16 h-16 rounded-full bg-forest-700/20 flex items-center justify-center mx-auto mb-4">
                  <Mail className="text-forest-400" size={28} />
                </div>
                <h3 className="font-display font-bold text-lg text-white mb-2">Check Your Email</h3>
                <p className="text-gray-400 text-sm">
                  If an account exists for <span className="text-white font-medium">{forgotEmail}</span>, you'll receive a password reset link shortly.
                </p>
                <button
                  onClick={() => { setShowForgot(false); setForgotSent(false) }}
                  className="mt-6 text-forest-400 text-sm font-medium hover:text-forest-300"
                >
                  Return to login
                </button>
              </div>
            ) : (
              <>
                <h2 className="font-display font-bold text-xl text-white mb-2">Reset Password</h2>
                <p className="text-gray-400 text-sm mb-6">Enter your email address and we'll send you a link to reset your password.</p>
                <form onSubmit={handleForgotPassword}>
                  <div className="mb-4">
                    <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-400 mb-1.5">Email</label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" size={18} />
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        placeholder="jmanharth@gmail.com"
                        className="w-full pl-10 pr-4 py-3 rounded-lg bg-charcoal-800 border border-charcoal-700 text-white placeholder-gray-600 focus:border-forest-500 focus:ring-2 focus:ring-forest-500/20 outline-none transition-all"
                      />
                    </div>
                  </div>
                  <button type="submit" className="w-full btn-primary py-3.5">
                    Send Reset Link
                  </button>
                </form>
              </>
            )}
          </div>
        )}

        <p className="text-center text-gray-600 text-xs mt-6">
          Frontline Termite and Pest Control — Admin Access Only
        </p>
      </div>
    </div>
  )
}

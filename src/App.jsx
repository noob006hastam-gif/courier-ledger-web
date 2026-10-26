import { useEffect, useState } from 'react'
import { supabase } from './supabase'
import Dashboard from './Dashboard'
import './App.css'

export default function App() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) setMessage(error.message)
      setUser(data?.session?.user ?? null)
      setLoading(false)
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => data.subscription.unsubscribe()
  }, [])

  async function signIn(event) {
    event.preventDefault()
    setBusy(true)
    setMessage('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) setMessage(error.message)
    setBusy(false)
  }

  async function signUp() {
    if (!email || password.length < 6) {
      setMessage('ایمیل معتبر و رمز عبور حداقل ۶ کاراکتری وارد کن.')
      return
    }

    setBusy(true)
    setMessage('')

    const { data, error } = await supabase.auth.signUp({ email, password })

    if (error) {
      setMessage(error.message)
    } else if (data.session) {
      setMessage('حساب ساخته شد.')
    } else {
      setMessage('ثبت‌نام انجام شد؛ اگر تأیید ایمیل فعال است، ایمیلت را بررسی کن.')
    }

    setBusy(false)
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) setMessage(error.message)
  }

  if (loading) {
    return <main className="page"><section className="card">در حال بررسی ورود...</section></main>
  }

  if (user) {
    return <Dashboard user={user} onSignOut={signOut} />
  }

  return (
    <main className="page">
      <section className="card">
        <div className="logo">CL</div>
        <h1>Courier Ledger</h1>
        <p className="subtitle">مدیریت سفارش‌ها و تسویهٔ پیک موتوری</p>

        <form onSubmit={signIn}>
          <label htmlFor="email">ایمیل</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />

          <label htmlFor="password">رمز عبور</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            minLength={6}
            required
          />

          <button type="submit" disabled={busy}>
            {busy ? 'لطفاً صبر کن...' : 'ورود'}
          </button>

          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={signUp}
          >
            ساخت حساب جدید
          </button>
        </form>

        {message && <div className="message">{message}</div>}
        <footer>اطلاعات سفارش‌ها در پایگاه دادهٔ آنلاین ذخیره می‌شوند.</footer>
      </section>
    </main>
  )
}
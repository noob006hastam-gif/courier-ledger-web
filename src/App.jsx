import { useEffect, useState } from 'react';
import { configured, supabase } from './supabase';
import Dashboard from './Dashboard';

export default function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!configured || !supabase) {
      setLoading(false);
      return;
    }

    let alive = true;

    supabase.auth.getSession().then(({ data, error }) => {
      if (!alive) return;
      if (error) setMessage(error.message);
      setSession(data?.session ?? null);
      setLoading(false);
    });

    const { data } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        setSession(nextSession);
      }
    );

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!supabase || busy) return;

    setBusy(true);
    setMessage('');

    try {
      const result = register
        ? await supabase.auth.signUp({ email: email.trim(), password })
        : await supabase.auth.signInWithPassword({
            email: email.trim(),
            password
          });

      if (result.error) throw result.error;

      if (
        register &&
        result.data.user &&
        !result.data.session
      ) {
        setMessage(
          'حساب ساخته شد. ایمیلت رو برای تأیید حساب بررسی کن.'
        );
      } else {
        setMessage('عملیات با موفقیت انجام شد.');
      }
    } catch (error) {
      setMessage(error.message || 'خطایی رخ داد.');
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell">
        <div className="auth-card">
          <div className="loading-dot" />
          <p>در حال بررسی حساب...</p>
        </div>
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="app-shell">
        <section className="auth-card">
          <div className="brand-mark">CL</div>
          <h1>Courier Ledger</h1>
          <p>تنظیمات اتصال به Supabase کامل نیست.</p>
          <p className="muted">
            متغیرهای VITE_SUPABASE_URL و
            VITE_SUPABASE_ANON_KEY رو در تنظیمات محیطی
            پروژهٔ Cloudflare Pages وارد کن.
          </p>
        </section>
      </main>
    );
  }

  if (session?.user) {
    return (
      <Dashboard
        user={session.user}
        onSignOut={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) setMessage(error.message);
        }}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="auth-card">
        <div className="brand-mark">CL</div>
        <p className="eyebrow">COURIER WORKSPACE</p>
        <h1>دفتر حساب پیک</h1>
        <p className="muted">
          سفارش‌ها، تسویه‌ها و هزینه‌های موتورت رو یک‌جا مدیریت کن.
        </p>

        <form onSubmit={submit} className="auth-form">
          <label htmlFor="email">ایمیل</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />

          <label htmlFor="password">رمز عبور</label>
          <input
            id="password"
            type="password"
            autoComplete={register ? 'new-password' : 'current-password'}
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          <button className="primary-button" disabled={busy}>
            {busy
              ? 'لطفاً صبر کن...'
              : register
                ? 'ساخت حساب'
                : 'ورود به حساب'}
          </button>
        </form>

        {message && <p className="notice" role="status">{message}</p>}

        <button
          className="text-button"
          type="button"
          onClick={() => {
            setRegister(!register);
            setMessage('');
          }}
        >
          {register
            ? 'حساب داری؟ وارد شو'
            : 'حساب نداری؟ ثبت‌نام کن'}
        </button>
      </section>
    </main>
  );
}
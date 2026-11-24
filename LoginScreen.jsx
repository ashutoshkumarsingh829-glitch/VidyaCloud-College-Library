import { useState } from 'react';

const LIBRARIAN_EMAIL = 'kishu3840@gmail.com';

const modes = [
  { id: 'student', label: 'Student Login' },
  { id: 'librarian', label: 'Librarian Login' },
  { id: 'register', label: 'New Student Registration' },
];

function getAuthErrorMessage(error) {
  const messages = {
    'auth/email-already-in-use': 'An account already exists for this email. Sign in instead.',
    'auth/invalid-email': 'Enter a valid email address.',
    'auth/invalid-credential': 'The email or password is incorrect.',
    'auth/user-not-found': 'No account was found for this email.',
    'auth/wrong-password': 'The email or password is incorrect.',
    'auth/weak-password': 'Choose a password with at least 6 characters.',
    'auth/too-many-requests': 'Too many attempts. Wait a little before trying again.',
    'auth/network-request-failed': 'Network error. Check your connection and try again.',
    'auth/operation-not-allowed': 'Email and password sign-in is not enabled in Firebase.',
    'auth/configuration-not-found':
      'Firebase Authentication is not initialized for this project. In Firebase Console, open Build → Authentication → Get started, then enable Email/Password under Sign-in method.',
    'auth/invalid-api-key': 'Firebase rejected the API key. Check your web app settings in Firebase Console.',
    'auth/unauthorized-domain': 'Add this site to the authorized domains in Firebase Authentication settings.',
  };
  return messages[error.code] || error.message || 'Sign-in could not be completed.';
}

export default function LoginScreen({
  onLogin,
  onRegister,
  onPasswordReset,
  authError = '',
  firebaseConfigured = true,
  firebaseConfigIssues = [],
  firebaseInitializationError = '',
}) {
  const [mode, setMode] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [resetNotice, setResetNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setResetNotice('');
    if (!firebaseConfigured) {
      const settings = firebaseConfigIssues.length
        ? firebaseConfigIssues.join(', ')
        : 'the Firebase web app settings';
      setError(
        `Firebase is not connected. Copy ${settings} from Firebase Console → Project settings → General → Your apps → SDK setup and configuration into .env, then restart Vite before signing in or registering.`,
      );
      return;
    }

    setBusy(true);
    try {
      if (mode === 'register') {
        if (email.trim().toLowerCase() === LIBRARIAN_EMAIL) {
          throw new Error('The librarian account must be created by your Firebase administrator.');
        }
        await onRegister(email.trim(), password);
        setResetNotice('Account created. Check your inbox and verify your email before signing in.');
      } else {
        if (mode === 'librarian' && email.trim().toLowerCase() !== LIBRARIAN_EMAIL) {
          throw new Error(`Use ${LIBRARIAN_EMAIL} for librarian sign-in.`);
        }
        await onLogin(email.trim(), password);
      }
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function handlePasswordReset() {
    setError('');
    setResetNotice('');

    if (!firebaseConfigured) {
      setError('Connect Firebase before requesting a password reset.');
      return;
    }
    if (!email.trim()) {
      setError('Enter your email address before requesting a password reset.');
      return;
    }

    setBusy(true);
    try {
      await onPasswordReset(email.trim());
      setResetNotice(
        'If an account exists for this email, Firebase has sent password reset instructions.',
      );
    } catch (requestError) {
      setError(getAuthErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-shell">
      <div className="login-content">
        <section className="login-card">
          <div className="brand-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 7.25C9.9 5.7 6.7 5.1 3.5 5.65v12.2c3.2-.55 6.4.05 8.5 1.6m0-12.2c2.1-1.55 5.3-2.15 8.5-1.6v12.2c-3.2-.55-6.4.05-8.5 1.6" />
              <path d="M12 7.25v12.2" />
            </svg>
          </div>
          <p className="eyebrow">VIDYACLOUD COLLEGE LIBRARY</p>
          <h1>Library, at your fingertips.</h1>
          <p className="login-intro">Sign in to browse books and manage your borrowing.</p>

          <div className="login-tabs" role="tablist" aria-label="Account options">
            {modes.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={mode === item.id}
                className={mode === item.id ? 'login-tab active' : 'login-tab'}
                onClick={() => {
                  setMode(item.id);
                  setError('');
                  setResetNotice('');
                  if (item.id === 'librarian') {
                    setEmail(LIBRARIAN_EMAIL);
                  } else if (mode === 'librarian' && email.trim().toLowerCase() === LIBRARIAN_EMAIL) {
                    setEmail('');
                  }
                }}
              >
                {item.label}
              </button>
            ))}
          </div>

          <form className="login-form" onSubmit={handleSubmit}>
            <label htmlFor="login-email">Email</label>
            <input
              id="login-email"
              autoComplete="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="arjun.sharma@college.ac.in"
              required
            />
            <label htmlFor="login-password">Password</label>
            <div className="password-field">
              <input
                id="login-password"
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                minLength={6}
                required
              />
              <button
                className="password-toggle"
                type="button"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                onClick={() => setShowPassword((visible) => !visible)}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>
            {(error || authError) && (
              <p className="form-error" role="alert">{error || authError}</p>
            )}
            <button
              className="primary-button login-submit"
              type="submit"
              disabled={busy}
            >
              {busy
                ? 'Please wait…'
                : mode === 'register'
                  ? 'Register Student'
                  : 'Login'}
            </button>
            {mode !== 'register' && (
              <button
                className="reset-password-button"
                type="button"
                onClick={handlePasswordReset}
                disabled={busy}
              >
                {busy ? 'Please wait…' : 'Send password reset email'}
              </button>
            )}
          </form>

          {resetNotice && <p className="form-success" role="status">{resetNotice}</p>}
          <p className="demo-hint">
            Librarian Login Email: <strong>{LIBRARIAN_EMAIL}</strong>
          </p>
          <p className="student-examples">
            Student email examples: arjun.sharma@college.ac.in · priya.nair@college.ac.in
          </p>
          <p className="login-footnote">For VidyaCloud College students and library staff</p>
        </section>
        {!firebaseConfigured && (
          <aside className="configuration-warning" role="status">
            <span className="configuration-warning-icon" aria-hidden="true">i</span>
            <p>
              <strong>Firebase is not connected.</strong> Login and registration require valid
              project settings in <code>.env</code> and a Vite restart. Copy the values from
              Firebase Console → Project settings → General → Your apps → SDK setup and configuration.
              {firebaseConfigIssues.length > 0 && (
                <span className="configuration-keys">
                  {' '}Check: {firebaseConfigIssues.join(', ')}.
                </span>
              )}
              {firebaseInitializationError && (
                <span className="configuration-keys">
                  {' '}Verify these values in Firebase Console.
                </span>
              )}
              {' '}
              <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer">
                Open Firebase Console
              </a>
            </p>
          </aside>
        )}
      </div>
    </main>
  );
}

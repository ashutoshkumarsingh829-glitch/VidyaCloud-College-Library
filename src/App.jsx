import { useEffect, useMemo, useRef, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import AddBookModal from './components/AddBookModal.jsx';
import BookCatalog from './components/BookCatalog.jsx';
import IssueDesk from './components/IssueDesk.jsx';
import LoginScreen from './components/LoginScreen.jsx';
import {
  auth,
  db,
  firebaseConfigIssues,
  firebaseConfigured,
  firebaseInitializationError,
  storage,
} from './firebase.js';
import {
  borrowBook,
  deleteEbook,
  returnBook,
  saveBook,
  seedSampleBooks,
  uploadEbook,
} from './services/libraryService.js';

const ADMIN_EMAIL = 'kishu3840@gmail.com';

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState('');
  const [books, setBooks] = useState([]);
  const [loans, setLoans] = useState([]);
  const [booksLoading, setBooksLoading] = useState(true);
  const [loansLoading, setLoansLoading] = useState(true);
  const [booksError, setBooksError] = useState('');
  const [loansError, setLoansError] = useState('');
  const [actionError, setActionError] = useState('');
  const [activeView, setActiveView] = useState('catalog');
  const [showAddBook, setShowAddBook] = useState(false);
  const [returningId, setReturningId] = useState('');
  const registrationInProgress = useRef(false);
  const loginInProgress = useRef(false);
  const isLibrarian =
    user?.emailVerified === true && user?.email?.toLowerCase() === ADMIN_EMAIL;

  useEffect(() => {
    if (!auth) {
      setAuthLoading(false);
      return undefined;
    }
    return onAuthStateChanged(
      auth,
      (authenticatedUser) => {
        if (authenticatedUser && !authenticatedUser.emailVerified) {
          setUser(null);
          setAuthError('Verify your email address before accessing the library.');
          setAuthLoading(false);
          if (!registrationInProgress.current && !loginInProgress.current) {
            signOut(auth).catch((error) => {
              setAuthError(error.message || 'The unverified session could not be signed out.');
            });
          }
          return;
        }
        setUser(authenticatedUser);
        setAuthError('');
        setAuthLoading(false);
      },
      (error) => {
        setAuthError(error.message || 'Firebase Authentication could not be reached.');
        setAuthLoading(false);
      },
    );
  }, []);

  useEffect(() => {
    if (!user || !db) {
      setBooks([]);
      setLoans([]);
      setBooksLoading(false);
      setLoansLoading(false);
      return undefined;
    }

    setBooksLoading(true);
    setLoansLoading(true);
    setBooksError('');
    setLoansError('');

    const unsubscribeBooks = onSnapshot(
      collection(db, 'books'),
      (snapshot) => {
        setBooks(snapshot.docs.map((item) => ({ id: item.id, ...item.data() })));
        setBooksLoading(false);
      },
      (error) => {
        setBooksError(error.message);
        setBooksLoading(false);
      },
    );

    const loansQuery = isLibrarian
      ? query(collection(db, 'loans'), where('status', '==', 'active'))
      : query(collection(db, 'loans'), where('studentEmail', '==', user.email));
    const unsubscribeLoans = onSnapshot(
      loansQuery,
      (snapshot) => {
        setLoans(
          snapshot.docs
            .map((item) => ({ id: item.id, ...item.data() }))
            .filter((loan) => loan.status === 'active'),
        );
        setLoansLoading(false);
      },
      (error) => {
        setLoansError(error.message);
        setLoansLoading(false);
      },
    );

    return () => {
      unsubscribeBooks();
      unsubscribeLoans();
    };
  }, [user, isLibrarian]);

  const sortedLoans = useMemo(
    () => [...loans].sort((a, b) => (b.borrowedAt?.seconds ?? 0) - (a.borrowedAt?.seconds ?? 0)),
    [loans],
  );

  async function handleLogin(email, password) {
    if (!firebaseConfigured || !auth) {
      throw new Error('Firebase Authentication is not configured yet.');
    }
    loginInProgress.current = true;
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      if (!credential.user.emailVerified) {
        try {
          await sendEmailVerification(credential.user);
        } finally {
          await signOut(auth);
        }
        throw new Error(
          'This email is not verified. A fresh verification link was sent; check your inbox and spam folder, verify the address, then sign in again.',
        );
      }
    } finally {
      loginInProgress.current = false;
    }
  }

  async function handleRegister(email, password) {
    if (!firebaseConfigured || !auth) {
      throw new Error('Firebase Authentication is not configured yet.');
    }
    registrationInProgress.current = true;
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
    } catch (error) {
      if (auth.currentUser && !auth.currentUser.emailVerified) {
        await signOut(auth);
      }
      throw error;
    } finally {
      registrationInProgress.current = false;
    }
  }

  async function handlePasswordReset(email) {
    if (!firebaseConfigured || !auth) {
      throw new Error('Firebase Authentication is not configured yet.');
    }
    await sendPasswordResetEmail(auth, email);
  }

  async function handleBorrow(book) {
    setActionError('');
    try {
      await borrowBook(book.id);
      setActiveView('loans');
    } catch (error) {
      setActionError(error.message || 'The book could not be borrowed.');
    }
  }

  async function handleReturn(loan) {
    setActionError('');
    setReturningId(loan.id);
    try {
      await returnBook(loan.id);
    } catch (error) {
      setActionError(error.message || 'The book could not be returned.');
    } finally {
      setReturningId('');
    }
  }

  async function handleSaveBook(bookInput) {
    let pdfUrl = '';
    try {
      if (bookInput.pdfFile) {
        if (!storage) throw new Error('Firebase Storage is not configured.');
        pdfUrl = await uploadEbook(bookInput.pdfFile, bookInput.onUploadProgress);
        bookInput.onUploadProgress?.(null);
      }
      await saveBook({ ...bookInput, pdfUrl });
      setShowAddBook(false);
    } catch (error) {
      if (pdfUrl) {
        try {
          await deleteEbook(pdfUrl);
        } catch (cleanupError) {
          const saveError = error instanceof Error ? error.message : 'The book could not be saved.';
          const fileError =
            cleanupError instanceof Error ? cleanupError.message : 'The uploaded PDF could not be removed.';
          throw new Error(`${saveError} ${fileError}`);
        }
      }
      throw error;
    }
  }

  async function handleSeedBooks() {
    setActionError('');
    try {
      await seedSampleBooks();
    } catch (error) {
      setActionError(error.message || 'Sample books could not be added.');
    }
  }

  async function handleLogout() {
    setActionError('');
    try {
      await signOut(auth);
    } catch (error) {
      setActionError(error.message || 'You could not be signed out.');
    }
  }

  if (firebaseConfigured && authLoading) {
    return <main className="loading-screen"><span className="loader" /> Connecting to the library…</main>;
  }

  if (!user) {
    return (
      <LoginScreen
        onLogin={handleLogin}
        onRegister={handleRegister}
        onPasswordReset={handlePasswordReset}
        authError={authError}
        firebaseConfigured={firebaseConfigured}
        firebaseConfigIssues={firebaseConfigIssues}
        firebaseInitializationError={firebaseInitializationError}
      />
    );
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#catalog"
          onClick={(event) => {
            event.preventDefault();
            setActiveView('catalog');
          }}
        >
          <span className="brand-mark small" aria-hidden="true">V</span>
          <span>VidyaCloud <strong>College Library</strong></span>
        </a>
        <nav className="topbar-actions" aria-label="Main navigation">
          <button
            type="button"
            className={activeView === 'catalog' ? 'nav-button selected' : 'nav-button'}
            onClick={() => {
              setActiveView('catalog');
              setActionError('');
            }}
          >
            Catalogue
          </button>
          <button
            type="button"
            className={activeView === 'loans' ? 'nav-button selected' : 'nav-button'}
            onClick={() => {
              setActiveView('loans');
              setActionError('');
            }}
          >
            {isLibrarian ? 'Issue Desk' : 'My Books'}
          </button>
          {isLibrarian && activeView === 'catalog' && (
            <>
              {books.length === 0 && !booksLoading && !booksError && (
                <button className="secondary-button seed-button" type="button" onClick={handleSeedBooks}>
                  Seed 4 Sample Indian Books
                </button>
              )}
              <button
                className="primary-button add-book-button"
                type="button"
                onClick={() => setShowAddBook(true)}
              >
                <span aria-hidden="true">＋</span> Add New Book
              </button>
            </>
          )}
          <span className="user-email">{user.email}</span>
          <span className={isLibrarian ? 'role-badge librarian-badge' : 'role-badge'}>
            {isLibrarian ? 'Librarian' : 'Student'}
          </span>
          <button className="logout-button" type="button" onClick={handleLogout}>Logout</button>
        </nav>
      </header>

      <main className="main-content">
        {actionError && (
          <div className="global-error" role="alert">
            <span>{actionError}</span>
            <button type="button" aria-label="Dismiss error" onClick={() => setActionError('')}>×</button>
          </div>
        )}
        {activeView === 'catalog' ? (
          <>
            {booksError && <p className="inline-error" role="alert">Catalogue error: {booksError}</p>}
            <BookCatalog
              books={books}
              isLibrarian={isLibrarian}
              onBorrow={handleBorrow}
              loading={booksLoading}
            />
          </>
        ) : (
          <IssueDesk
            loans={sortedLoans}
            librarian={isLibrarian}
            loading={loansLoading}
            onReturn={handleReturn}
            returningId={returningId}
            error={loansError}
          />
        )}
      </main>
      <footer className="app-footer">
        <span>VidyaCloud College Library</span>
        <span>Learn · Explore · Grow</span>
      </footer>
      {showAddBook && (
        <AddBookModal onClose={() => setShowAddBook(false)} onSave={handleSaveBook} />
      )}
    </div>
  );
}

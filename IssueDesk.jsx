import { calculateLateFine } from '../services/libraryService.js';

function formatIndianDate(value) {
  if (!value) return '—';
  const date = value?.toDate ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
}

function Fine({ dueDate }) {
  const amount = calculateLateFine(dueDate);
  return (
    <span className={amount ? 'fine overdue' : 'fine'}>
      ₹{amount}
      {amount > 0 && <small>₹10/day</small>}
    </span>
  );
}

function LoanTable({ loans, librarian, onReturn, returningId }) {
  return (
    <div className="table-scroll">
      <table className="loan-table">
        <thead>
          <tr>
            <th>Book Title</th>
            {librarian && <th>Student Email</th>}
            <th>Borrow Date</th>
            <th>Due Date</th>
            <th>Late Fee</th>
            {librarian && <th><span className="sr-only">Actions</span></th>}
          </tr>
        </thead>
        <tbody>
          {loans.map((loan) => (
            <tr key={loan.id}>
              <td className="loan-book">{loan.bookTitle || 'Untitled book'}</td>
              {librarian && <td className="loan-email">{loan.studentEmail}</td>}
              <td>{formatIndianDate(loan.borrowedAt)}</td>
              <td>{formatIndianDate(loan.dueDate)}</td>
              <td><Fine dueDate={loan.dueDate} /></td>
              {librarian && (
                <td className="return-cell">
                  <button
                    className="return-button"
                    type="button"
                    onClick={() => onReturn(loan)}
                    disabled={returningId === loan.id}
                  >
                    {returningId === loan.id ? 'Returning…' : 'Mark Returned'}
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function IssueDesk({
  loans,
  librarian,
  loading,
  onReturn,
  returningId,
  error,
}) {
  const heading = librarian ? 'Active Issue Desk' : 'My Borrowed Books';

  return (
    <section className="content-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">{librarian ? 'LIBRARY OPERATIONS' : 'YOUR READING LIST'}</p>
          <h1>{heading}</h1>
          <p className="section-subtitle">
            {librarian
              ? 'Track current loans and record returned books.'
              : 'Keep track of your due dates and live late fees.'}
          </p>
        </div>
        <div className="catalog-count">
          <strong>{loans.length}</strong>
          <span>active {loans.length === 1 ? 'loan' : 'loans'}</span>
        </div>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}
      {loading ? (
        <div className="empty-state"><span className="loader" /> Loading active loans…</div>
      ) : loans.length ? (
        <div className="loan-panel">
          <LoanTable
            loans={loans}
            librarian={librarian}
            onReturn={onReturn}
            returningId={returningId}
          />
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">▤</div>
          <h2>No active loans</h2>
          <p>{librarian ? 'New student borrowings will appear here.' : 'Books you borrow will appear here.'}</p>
        </div>
      )}
    </section>
  );
}

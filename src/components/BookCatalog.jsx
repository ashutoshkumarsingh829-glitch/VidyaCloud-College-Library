import { useEffect, useMemo, useState } from 'react';
import { fetchEbook } from '../services/libraryService.js';

function BookCard({ book, isLibrarian, onBorrow }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [borrowing, setBorrowing] = useState(false);
  const [reading, setReading] = useState(false);
  const [ebookUrl, setEbookUrl] = useState('');
  const [ebookError, setEbookError] = useState('');
  const isAvailable = Number(book.availableCopies) > 0;

  useEffect(() => {
    if (!ebookUrl) return undefined;
    return () => URL.revokeObjectURL(ebookUrl);
  }, [ebookUrl]);

  async function handleBorrow() {
    setBorrowing(true);
    try {
      await onBorrow(book);
    } finally {
      setBorrowing(false);
    }
  }

  async function handleReadEbook() {
    setEbookError('');
    if (ebookUrl) {
      setEbookUrl('');
      return;
    }

    setReading(true);
    try {
      const file = await fetchEbook(book.pdfUrl);
      setEbookUrl(URL.createObjectURL(file));
    } catch (error) {
      setEbookError(error.message || 'The e-book could not be opened.');
    } finally {
      setReading(false);
    }
  }

  return (
    <article className="book-card">
      <div className="book-cover">
        {book.coverUrl && !imageFailed ? (
          <img
            src={book.coverUrl}
            alt={`Cover of ${book.title}`}
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="cover-placeholder" aria-label="No book cover available">
            <span className="cover-symbol">V</span>
            <span>VIDYACLOUD<br />COLLEGE LIBRARY</span>
          </div>
        )}
      </div>
      <div className="book-card-content">
        <span className={isAvailable ? 'availability available' : 'availability checked-out'}>
          {isAvailable
            ? `Available (${book.availableCopies} of ${book.totalCopies ?? book.availableCopies} copies)`
            : 'Checked Out'}
        </span>
        <h3>{book.title || 'Untitled book'}</h3>
        <p className="book-author">{book.author || 'Author not listed'}</p>
        <div className="book-actions">
          {book.pdfUrl && (
            <button
              className="secondary-button"
              type="button"
              onClick={handleReadEbook}
              disabled={reading}
              aria-expanded={Boolean(ebookUrl)}
            >
              {reading ? 'Opening…' : ebookUrl ? 'Close E-Book' : 'Read E-Book'}
            </button>
          )}
          {!isLibrarian && isAvailable && (
            <button
              className="primary-button"
              type="button"
              onClick={handleBorrow}
              disabled={borrowing}
            >
              {borrowing ? 'Borrowing…' : 'Borrow'}
            </button>
          )}
        </div>
      </div>
      {ebookError && <p className="ebook-error" role="alert">{ebookError}</p>}
      {ebookUrl && (
        <div className="ebook-reader">
          <iframe title={`E-book: ${book.title}`} src={ebookUrl} />
        </div>
      )}
    </article>
  );
}

export default function BookCatalog({ books, isLibrarian, onBorrow, loading }) {
  const [search, setSearch] = useState('');
  const filteredBooks = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('en-IN');
    if (!query) return books;
    return books.filter((book) =>
      `${book.title ?? ''} ${book.author ?? ''}`.toLocaleLowerCase('en-IN').includes(query),
    );
  }, [books, search]);

  return (
    <section className="content-section">
      <div className="page-heading">
        <div>
          <p className="eyebrow">DISCOVER YOUR NEXT READ</p>
          <h1>Book catalogue</h1>
          <p className="section-subtitle">Explore the VidyaCloud College Library collection.</p>
        </div>
        <div className="catalog-count">
          <strong>{books.length}</strong>
          <span>{books.length === 1 ? 'book' : 'books'} in collection</span>
        </div>
      </div>

      <div className="search-wrap">
        <span className="search-icon" aria-hidden="true">⌕</span>
        <input
          aria-label="Search books by title or author"
          type="search"
          placeholder="Search by title or author…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        {search && (
          <button type="button" className="clear-search" onClick={() => setSearch('')}>
            Clear
          </button>
        )}
      </div>

      {loading ? (
        <div className="empty-state"><span className="loader" /> Loading the catalogue…</div>
      ) : filteredBooks.length ? (
        <div className="book-grid">
          {filteredBooks.map((book) => (
            <BookCard
              key={book.id}
              book={book}
              isLibrarian={isLibrarian}
              onBorrow={onBorrow}
            />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <div className="empty-icon" aria-hidden="true">⌕</div>
          <h2>{books.length ? 'No matching books' : 'Your catalogue is ready to grow'}</h2>
          <p>
            {books.length
              ? 'Try another title or author.'
              : 'Books added by the librarian will appear here.'}
          </p>
        </div>
      )}
    </section>
  );
}

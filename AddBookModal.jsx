import { useRef, useState } from 'react';
import { fetchBookByIsbn } from '../services/libraryService.js';

export default function AddBookModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    isbn: '',
    title: '',
    author: '',
    coverUrl: '',
    totalCopies: '1',
  });
  const [pdfFile, setPdfFile] = useState(null);
  const [error, setError] = useState('');
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const submitLock = useRef(false);

  function updateField(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function handleAutoFill() {
    setError('');
    setLoadingDetails(true);
    try {
      const details = await fetchBookByIsbn(form.isbn);
      setForm((current) => ({ ...current, ...details }));
    } catch (requestError) {
      setError(requestError.message || 'Book details could not be fetched.');
    } finally {
      setLoadingDetails(false);
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError('');
    setSaving(true);
    setUploadProgress(null);
    try {
      await onSave({
        ...form,
        totalCopies: Number(form.totalCopies),
        pdfFile,
        onUploadProgress: setUploadProgress,
      });
    } catch (requestError) {
      setError(requestError.message || 'The book could not be saved.');
    } finally {
      submitLock.current = false;
      setSaving(false);
    }
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !saving) onClose();
      }}
    >
      <section
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-book-title"
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">LIBRARIAN TOOLS</p>
            <h2 id="add-book-title">Add a new book</h2>
          </div>
          <button
            className="icon-button"
            type="button"
            aria-label="Close dialog"
            onClick={onClose}
            disabled={saving}
          >
            ×
          </button>
        </div>

        <form className="book-form" onSubmit={handleSubmit}>
          <div className="isbn-row">
            <div className="field-grow">
              <label htmlFor="book-isbn">ISBN</label>
              <input
                id="book-isbn"
                name="isbn"
                value={form.isbn}
                onChange={updateField}
                placeholder="Enter ISBN"
                required
              />
            </div>
            <button
              className="secondary-button autofill-button"
              type="button"
              onClick={handleAutoFill}
              disabled={loadingDetails || !form.isbn.trim()}
            >
              {loadingDetails ? 'Fetching…' : 'Auto-Fill Details'}
            </button>
          </div>

          <div>
            <label htmlFor="book-title">Title</label>
            <input
              id="book-title"
              name="title"
              value={form.title}
              onChange={updateField}
              placeholder="Book title"
              required
            />
          </div>
          <div>
            <label htmlFor="book-author">Author</label>
            <input
              id="book-author"
              name="author"
              value={form.author}
              onChange={updateField}
              placeholder="Author name"
              required
            />
          </div>
          <div>
            <label htmlFor="book-cover">Cover URL <span className="optional-label">Optional</span></label>
            <input
              id="book-cover"
              name="coverUrl"
              type="url"
              value={form.coverUrl}
              onChange={updateField}
              placeholder="https://…"
            />
          </div>
          <div className="two-fields">
            <div>
              <label htmlFor="book-copies">Total copies</label>
              <input
                id="book-copies"
                name="totalCopies"
                type="number"
                min="1"
                step="1"
                value={form.totalCopies}
                onChange={updateField}
                required
              />
            </div>
            <div>
              <label htmlFor="book-pdf">E-Book PDF <span className="optional-label">Optional</span></label>
              <input
                id="book-pdf"
                type="file"
                accept=".pdf,application/pdf"
                onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              />
            </div>
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          {saving && (
            <div className="upload-progress" aria-live="polite">
              <span>
                {uploadProgress === null
                  ? 'Saving book details…'
                  : `Uploading e-book: ${uploadProgress}%`}
              </span>
              {uploadProgress !== null && (
                <progress max="100" value={uploadProgress} aria-label="E-book upload progress" />
              )}
            </div>
          )}
          <div className="modal-actions">
            <button className="secondary-button" type="button" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button className="primary-button" type="submit" disabled={saving || loadingDetails}>
              {saving ? 'Saving book…' : 'Save Book'}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

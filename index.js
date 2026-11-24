import { initializeApp } from 'firebase-admin/app';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { logger } from 'firebase-functions';

initializeApp();

const db = getFirestore();
const LIBRARIAN_EMAIL = 'kishu3840@gmail.com';
const BORROWING_PERIOD_MS = 7 * 24 * 60 * 60 * 1000;

export const borrowBook = onCall({ region: 'us-central1' }, async (request) => {
  const email = request.auth?.token.email;
  if (!request.auth || !request.auth.token.email_verified || typeof email !== 'string') {
    throw new HttpsError('unauthenticated', 'Sign in with a verified email before borrowing.');
  }
  if (email.toLowerCase() === LIBRARIAN_EMAIL) {
    throw new HttpsError('permission-denied', 'Librarian accounts cannot borrow books.');
  }

  const bookId = request.data?.bookId;
  if (typeof bookId !== 'string' || !bookId.trim() || bookId.includes('/')) {
    throw new HttpsError('invalid-argument', 'A valid book ID is required.');
  }

  const bookRef = db.collection('books').doc(bookId.trim());
  const loanRef = db.collection('loans').doc(`active_${request.auth.uid}_${bookRef.id}`);

  try {
    return await db.runTransaction(async (transaction) => {
      const bookSnapshot = await transaction.get(bookRef);
      if (!bookSnapshot.exists) {
        throw new HttpsError('not-found', 'This book is not in the catalogue.');
      }

      const activeLoanSnapshot = await transaction.get(loanRef);
      if (activeLoanSnapshot.exists) {
        const existingLoan = activeLoanSnapshot.data();
        if (existingLoan.status === 'active') {
          throw new HttpsError('failed-precondition', 'You already have an active loan for this book.');
        }
      }

      const book = bookSnapshot.data();
      if (!Number.isInteger(book.availableCopies) || book.availableCopies < 1) {
        throw new HttpsError('failed-precondition', 'No copies of this book are currently available.');
      }
      if (typeof book.title !== 'string' || !book.title.trim()) {
        throw new HttpsError('failed-precondition', 'This book record is missing a valid title.');
      }

      const borrowedAt = new Date();
      const dueDate = Timestamp.fromDate(new Date(borrowedAt.getTime() + BORROWING_PERIOD_MS));
      transaction.update(bookRef, { availableCopies: book.availableCopies - 1 });
      transaction.set(loanRef, {
        bookId: bookRef.id,
        bookTitle: book.title,
        studentEmail: email,
        status: 'active',
        borrowedAt: FieldValue.serverTimestamp(),
        dueDate,
        returnedAt: null,
      });

      return { loanId: loanRef.id };
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    logger.error('Borrow transaction failed.', { uid: request.auth.uid, error });
    throw new HttpsError('internal', 'The book could not be borrowed. Please try again.');
  }
});

import {
  collection,
  doc,
  getDocs,
  query,
  runTransaction,
  serverTimestamp,
  where,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { deleteObject, getBlob, ref, uploadBytesResumable } from 'firebase/storage';
import { db, functions, storage } from '../firebase.js';

const SAMPLE_BOOKS = [
  {
    isbn: '9789352604184',
    title: 'Data Structures and Algorithms Made Easy',
    author: 'Narasimha Karumanchi',
    totalCopies: 5,
  },
  {
    isbn: '9789389845027',
    title: 'Let Us C',
    author: 'Yashavant Kanetkar',
    totalCopies: 6,
  },
  {
    isbn: '9789352864282',
    title: 'Operating System Concepts',
    author: 'Galvin',
    totalCopies: 4,
  },
  {
    isbn: '9789389845133',
    title: 'Programming in ANSI C',
    author: 'E. Balagurusamy',
    totalCopies: 5,
  },
];

export async function fetchBookByIsbn(isbn) {
  const cleanedIsbn = isbn.trim();
  if (!cleanedIsbn) {
    throw new Error('Enter an ISBN before fetching book details.');
  }

  let response;
  try {
    response = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${encodeURIComponent(cleanedIsbn)}`,
    );
  } catch {
    throw new Error('Book details could not be reached. Check your internet connection and try again.');
  }
  if (!response.ok) {
    throw new Error('Book details could not be fetched. Please try again.');
  }

  const result = await response.json();
  const volume = result.items?.[0]?.volumeInfo;
  if (!volume) {
    throw new Error('No book details were found for that ISBN.');
  }

  return {
    title: volume.title ?? '',
    author: volume.authors?.join(', ') ?? '',
    coverUrl: volume.imageLinks?.thumbnail?.replace(/^http:/, 'https:') ?? '',
  };
}

export async function uploadEbook(file, onProgress = () => {}) {
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  if (!file || (!file.name.toLowerCase().endsWith('.pdf') && file.type !== 'application/pdf')) {
    throw new Error('Choose a PDF file to upload.');
  }

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const fileRef = ref(storage, `ebooks/${crypto.randomUUID()}-${safeName}`);
  const uploadTask = uploadBytesResumable(fileRef, file, { contentType: 'application/pdf' });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      'state_changed',
      (snapshot) => {
        onProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100));
      },
      reject,
      async () => {
        resolve(uploadTask.snapshot.ref.fullPath);
      },
    );
  });
}

export async function deleteEbook(path) {
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  await deleteObject(ref(storage, path));
}

export async function fetchEbook(path) {
  if (!storage) {
    throw new Error('Firebase Storage is not configured.');
  }
  if (typeof path !== 'string' || !path.startsWith('ebooks/')) {
    throw new Error('This e-book does not have a valid storage path.');
  }
  return getBlob(ref(storage, path));
}

export async function saveBook(book) {
  if (!db) {
    throw new Error('Cloud Firestore is not configured.');
  }

  const isbn = book.isbn.trim().replace(/[-\s]/g, '').toUpperCase();
  if (!/^[0-9X]+$/.test(isbn)) {
    throw new Error('Enter a valid ISBN using digits and, if needed, X.');
  }
  const title = book.title.trim();
  const author = book.author.trim();
  if (!title || !author) {
    throw new Error('Enter both a book title and author.');
  }

  const totalCopies = Number(book.totalCopies);
  if (!Number.isInteger(totalCopies) || totalCopies < 1) {
    throw new Error('Total copies must be a whole number of at least 1.');
  }

  const bookRef = doc(db, 'books', isbn);
  const isbnMatches = await getDocs(
    query(collection(db, 'books'), where('isbn', '==', book.isbn.trim())),
  );
  if (!isbnMatches.empty) {
    throw new Error('A book with this ISBN is already in the catalogue.');
  }

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(bookRef);
    if (existing.exists()) {
      throw new Error('A book with this ISBN is already in the catalogue.');
    }

    transaction.set(bookRef, {
      isbn: book.isbn.trim(),
      title,
      author,
      coverUrl: book.coverUrl.trim(),
      pdfUrl: book.pdfUrl ?? '',
      totalCopies,
      availableCopies: totalCopies,
      createdAt: serverTimestamp(),
    });
  });
}

export async function seedSampleBooks() {
  if (!db) {
    throw new Error('Cloud Firestore is not configured.');
  }
  const catalogue = await getDocs(collection(db, 'books'));
  if (!catalogue.empty) {
    throw new Error('Sample books can only be added when the catalogue is empty.');
  }

  const bookRefs = SAMPLE_BOOKS.map((book) => doc(db, 'books', book.isbn));
  await runTransaction(db, async (transaction) => {
    const existingBooks = await Promise.all(bookRefs.map((bookRef) => transaction.get(bookRef)));
    if (existingBooks.some((book) => book.exists())) {
      throw new Error('One or more sample books have already been added.');
    }

    SAMPLE_BOOKS.forEach((book, index) => {
      transaction.set(bookRefs[index], {
        ...book,
        coverUrl: '',
        pdfUrl: '',
        availableCopies: book.totalCopies,
        createdAt: serverTimestamp(),
      });
    });
  });
}

export async function borrowBook(bookId) {
  if (!functions) {
    throw new Error('Firebase Cloud Functions is not configured.');
  }

  const borrow = httpsCallable(functions, 'borrowBook');
  await borrow({ bookId });
}

export async function returnBook(loanId) {
  if (!db) {
    throw new Error('Cloud Firestore is not configured.');
  }
  const loanRef = doc(db, 'loans', loanId);

  await runTransaction(db, async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists()) {
      throw new Error('This loan record could not be found.');
    }

    const loan = loanSnapshot.data();
    if (loan.status !== 'active') {
      throw new Error('This book has already been returned.');
    }

    const bookRef = doc(db, 'books', loan.bookId);
    const bookSnapshot = await transaction.get(bookRef);
    if (!bookSnapshot.exists()) {
      throw new Error('The book record for this loan could not be found.');
    }

    const book = bookSnapshot.data();
    if (
      !Number.isInteger(book.availableCopies) ||
      !Number.isInteger(book.totalCopies) ||
      book.availableCopies >= book.totalCopies
    ) {
      throw new Error('Available copies cannot exceed the total copies.');
    }

    transaction.update(loanRef, {
      status: 'returned',
      returnedAt: serverTimestamp(),
    });
    transaction.update(bookRef, { availableCopies: book.availableCopies + 1 });
  });
}

function asDate(value) {
  if (value?.toDate) return value.toDate();
  if (value instanceof Date) return value;
  return new Date(value);
}

function indianDayNumber(date) {
  const parts = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type) => Number(parts.find((item) => item.type === type)?.value);
  return Date.UTC(part('year'), part('month') - 1, part('day')) / 86_400_000;
}

export function calculateLateFine(dueDate, today = new Date()) {
  if (!dueDate) return 0;
  const due = asDate(dueDate);
  const current = asDate(today);
  if (Number.isNaN(due.getTime()) || Number.isNaN(current.getTime())) return 0;

  const lateDays = Math.max(0, indianDayNumber(current) - indianDayNumber(due));
  return lateDays * 10;
}

# VidyaCloud College Library

A React and Firebase college-library catalogue with student borrowing and librarian issue management.

## Local setup

1. Install dependencies:

   ```bash
   npm install
   cd functions && npm install
   cd ..
   ```

2. Copy `.env.example` to `.env` and add your Firebase web app configuration.
3. Start the app with `npm run dev`.

## Firebase setup

Enable Email/Password Authentication, Firestore Database, Cloud Storage, and Cloud Functions. Create and verify the librarian account `kishu3840@gmail.com`.

## Deploy

```bash
npm run build
npx firebase-tools deploy --only hosting,functions,firestore:rules,storage
```

Cloud Functions may require billing to be enabled. Add the Hosting domain to Authentication's authorized domains after deploying.

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#17233b',
        muted: '#64748b',
        brand: '#2457c5',
        canvas: '#f5f7fb',
      },
      boxShadow: {
        card: '0 12px 36px rgba(23, 35, 59, 0.08)',
      },
    },
  },
  plugins: [],
};

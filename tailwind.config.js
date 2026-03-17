/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
    './src/lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        app: {
          bg: 'var(--az-bg)',
          card: 'var(--az-card)',
          border: 'var(--az-border)',
          sidebar: 'var(--az-sidebar)',
          text: 'var(--az-text)',
          muted: 'var(--az-muted)',
          blue: 'var(--az-primary)',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(16,24,40,0.05), 0 0 0 1px rgba(16,24,40,0.04)',
      },
    },
  },
  plugins: [],
};

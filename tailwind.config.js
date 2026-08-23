/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#303e67',
        navy: '#071f47',
        brand: '#0b51b7',
        'brand-hover': '#084394',
        muted: '#7081b9',
        canvas: '#f7f9fc',
        line: '#eceff5',
      },
      fontFamily: {
        sans: ['Roboto', 'Arial', 'sans-serif'],
        display: ['Roboto', 'Arial', 'sans-serif'],
      },
      transitionTimingFunction: {
        snappy: 'cubic-bezier(.22,1,.36,1)',
      },
    },
  },
  plugins: [],
}

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        forest: {
          50: '#f0f7f1',
          100: '#d9edd9',
          200: '#b3dbb5',
          300: '#7fbf85',
          400: '#4fa058',
          500: '#2d7a35',
          600: '#1e6328',
          700: '#1a5223',
          800: '#16421e',
          900: '#0f2e15',
          950: '#071a0b',
        },
        charcoal: {
          50: '#f5f5f5',
          100: '#e5e5e5',
          200: '#cccccc',
          300: '#a3a3a3',
          400: '#737373',
          500: '#525252',
          600: '#404040',
          700: '#333333',
          800: '#262626',
          900: '#1a1a1a',
          950: '#0d0d0d',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Montserrat', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}

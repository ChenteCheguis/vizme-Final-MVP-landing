/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: '#02222F',
        coral: '#F54A43',
        orange: '#F26A3D',
        greyblue: '#566970',
        lightbg: '#EBF8FE',
        // Backward-compat aliases for current landing components.
        // Sprint 3 will unify the namespace when this config replaces the inline CDN setup in index.html.
        vizme: {
          navy: '#02222F',
          red: '#F54A43',
          orange: '#F26A3D',
          greyblue: '#566970',
          grey: '#ABB5B8',
          bg: '#EBF8FE',
        },
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

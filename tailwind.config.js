/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Sprint 3 spec tokens (use these going forward)
        navy: '#02222F',
        coral: '#F54A43',
        orange: '#F26A3D',
        greyblue: '#566970',
        lightbg: '#EBF8FE',
        // Vizme nested namespace — landing components depend on these.
        // vizme.red and vizme.coral both resolve to #F54A43 so old + new code coexist.
        vizme: {
          navy: '#02222F',
          ink: '#011217',
          red: '#F54A43',
          coral: '#F54A43',
          orange: '#F26A3D',
          greyblue: '#566970',
          grey: '#ABB5B8',
          bg: '#EBF8FE',
          paper: '#F7FBFD',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Fraunces"', 'Georgia', 'serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        editorial: '-0.025em',
        wide: '0.04em',
      },
      animation: {
        'blob': 'blob 7s infinite',
        'fade-in': 'fadeIn 0.5s ease-out forwards',
        'scale-in': 'scaleIn 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-right': 'slideRight 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'slide-left': 'slideLeft 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
        'shimmer': 'shimmer 2.4s linear infinite',
        'breathe': 'breathe 3.5s ease-in-out infinite',
      },
      keyframes: {
        blob: {
          '0%': { transform: 'translate(0px, 0px) scale(1)' },
          '33%': { transform: 'translate(30px, -50px) scale(1.1)' },
          '66%': { transform: 'translate(-20px, 20px) scale(0.9)' },
          '100%': { transform: 'translate(0px, 0px) scale(1)' },
        },
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideRight: {
          '0%': { opacity: '0', transform: 'translateX(-30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        slideLeft: {
          '0%': { opacity: '0', transform: 'translateX(30px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.7', transform: 'scale(1.04)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: '0.85' },
          '50%': { transform: 'scale(1.06)', opacity: '1' },
        },
      },
      backgroundImage: {
        'mesh-vizme':
          'radial-gradient(at 18% 22%, rgba(245, 74, 67, 0.18) 0px, transparent 55%), radial-gradient(at 82% 8%, rgba(2, 34, 47, 0.20) 0px, transparent 50%), radial-gradient(at 78% 86%, rgba(242, 106, 61, 0.14) 0px, transparent 55%), radial-gradient(at 4% 78%, rgba(86, 105, 112, 0.12) 0px, transparent 55%)',
        'mesh-night':
          'radial-gradient(at 22% 18%, rgba(245, 74, 67, 0.32) 0px, transparent 50%), radial-gradient(at 78% 12%, rgba(242, 106, 61, 0.20) 0px, transparent 50%), radial-gradient(at 70% 80%, rgba(86, 105, 112, 0.30) 0px, transparent 55%)',
        'shimmer-gradient':
          'linear-gradient(110deg, transparent 0%, rgba(255, 255, 255, 0.45) 45%, transparent 100%)',
      },
      boxShadow: {
        'soft': '0 1px 3px rgba(2, 34, 47, 0.04), 0 4px 12px rgba(2, 34, 47, 0.04)',
        'card': '0 4px 20px -2px rgba(2, 34, 47, 0.08), 0 2px 6px -1px rgba(2, 34, 47, 0.04)',
        'editorial': '0 24px 64px -32px rgba(2, 34, 47, 0.35), 0 8px 20px -10px rgba(2, 34, 47, 0.18)',
        'glow-coral': '0 0 0 1px rgba(245, 74, 67, 0.10), 0 16px 40px -16px rgba(245, 74, 67, 0.40)',
        'glow-navy': '0 0 0 1px rgba(2, 34, 47, 0.08), 0 18px 44px -16px rgba(2, 34, 47, 0.30)',
      },
    },
  },
  plugins: [],
};

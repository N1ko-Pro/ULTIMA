/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./Frontend/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['IBM Plex Sans', 'Segoe UI Variable', 'Segoe UI', 'system-ui', '-apple-system', 'sans-serif'],
      },
      colors: {
        surface: {
          0: '#09090b',
          1: '#0f0f12',
          2: '#141418',
          3: '#1a1a1f',
          4: '#222228',
        },
      },
      fontSize: {
        'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.35vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.95rem + 0.25vw, 1.125rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.75vw, 1.5rem)',
        'fluid-xl': 'clamp(1.5rem, 1.2rem + 1.25vw, 2.25rem)',
      },
      screens: {
        'hd': '1280px',
        'fhd': '1920px',
        'qhd': '2560px',
        'uhd': '3840px',
      },
      animation: {
        'slide-up': 'slideUp 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-down': 'slideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) both',
        'modal-in': 'modalIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        'overlay-in': 'overlayIn 0.2s ease-out both',
        'slide-in-right': 'slideInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'shake': 'shake 0.35s ease-in-out',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s ease-in-out infinite',
        'complete-in': 'completeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) both',
        'indeterminate': 'indeterminate 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideDown: {
          from: { opacity: '0', transform: 'translateY(-8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.98)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        overlayIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        modalIn: {
          from: { opacity: '0', transform: 'translateY(16px) scale(0.97)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '20%': { transform: 'translateX(-4px)' },
          '40%': { transform: 'translateX(4px)' },
          '60%': { transform: 'translateX(-3px)' },
          '80%': { transform: 'translateX(2px)' },
        },
        slideInRight: {
          from: { opacity: '0', transform: 'translateX(20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        glowPulse: {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.8' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-150%)' },
          '100%': { transform: 'translateX(500%)' },
        },
        completeIn: {
          from: { opacity: '0', transform: 'scale(0.6)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        indeterminate: {
          '0%': { transform: 'translateX(-200%)' },
          '100%': { transform: 'translateX(550%)' },
        },
      },
    },
  },
  plugins: [],
}

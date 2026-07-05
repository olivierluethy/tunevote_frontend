/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: "class", // Enables dark mode via class
  theme: {
    extend: {
      // === Fonts ===
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },

      // === Colors (TuneVote Brand) ===
      colors: {
        purple: {
          50: '#f5f3ff',
          100: '#ede9fe',
          200: '#ddd6fe',
          300: '#c4b5fd',
          400: '#a78bfa',
          500: '#8b5cf6', // Primary
          600: '#7c3aed',
          700: '#6d28d9',
          800: '#5b21b6',
          900: '#4c1d95',
        },
        pink: {
          50: '#fdf2f8',
          100: '#fce7f3',
          200: '#fbcfe8',
          300: '#f9a8d4',
          400: '#f472b6',
          500: '#ec4899', // Accent
          600: '#db2777',
          700: '#be185d',
          800: '#9f174d',
          900: '#831843',
        },
        neon: {
          purple: '#a855f7',
          pink: '#ec4899',
          cyan: '#06b6d4',
        },
      },

      // === Background Gradients ===
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'tunevote-hero': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'tunevote-card': 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))',
      },

      // === Backdrop & Blur ===
      backdropBlur: {
        xs: '2px',
      },

      // === Border Radius ===
      borderRadius: {
        '4xl': '2rem',
        '5xl': '3rem',
      },

      // === Box Shadow ===
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.37)',
        'glass-lg': '0 25px 50px -12px rgba(139, 92, 246, 0.25)',
        'neon': '0 0 20px rgba(139, 92, 246, 0.5)',
        'neon-lg': '0 0 40px rgba(236, 72, 153, 0.6)',
      },

      // === Animations ===
      animation: {
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float 8s ease-in-out infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-slow': 'bounce 2s infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
        // Mini-player: live equalizer bars, shimmer sweep across the volume
        // fill, and a slow ambient edge-glow that breathes.
        equalize: 'equalize 1.1s ease-in-out infinite',
        shimmer: 'shimmer 2.4s linear infinite',
        'ambient-glow': 'ambient-glow 4.5s ease-in-out infinite',
      },

      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-20px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)' },
          '100%': { boxShadow: '0 0 40px rgba(236, 72, 153, 0.6)' },
        },
        equalize: {
          '0%, 100%': { transform: 'scaleY(0.3)' },
          '50%': { transform: 'scaleY(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(320%)' },
        },
        'ambient-glow': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '0.75' },
        },
      },

      // === Animation Delay Utilities ===
      animationDelay: {
        75: '75ms',
        100: '100ms',
        150: '150ms',
        200: '200ms',
        300: '300ms',
        500: '500ms',
        700: '700ms',
        1000: '1000ms',
      },

      // === Transition Timing ===
      transitionDuration: {
        0: '0ms',
        400: '400ms',
        600: '600ms',
        800: '800ms',
      },
    },
  },
  plugins: [
    // Optional: Add if you want animation delay classes
    function ({ addUtilities, theme }) {
      const animationDelays = theme('animationDelay');
      const utilities = Object.entries(animationDelays).map(([key, value]) => ({
        [`.delay-${key}`]: { animationDelay: value },
      }));
      addUtilities(utilities);
    },
  ],
};
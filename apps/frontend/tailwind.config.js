/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: ['class'],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
      colors: {
        // TEXT COLORS

        //primary
        'text-primary': {
          DEFAULT: 'var(--figma-text-primary-default)',
        },
        'text-primary-weak': {
          DEFAULT: 'var(--figma-text-primary-weak)',
        },
        'text-link': {
          DEFAULT: 'var(--figma-text-primary-link)',
        },

        //contrast
        'text-contrast': {
          DEFAULT: 'var(--figma-text-contrast-default)',
        },
        'text-contrast-weak': {
          DEFAULT: 'var(--figma-text-contrast-default)',
        },
        'text-link-weak': {
          DEFAULT: 'var(--figma-text-contrast-link)',
        },

        'text-white': {
          DEFAULT: 'var(--primitives-permanent-white-100)',
          hover: 'var(--primitives-permanent-white-70)',
        },
        'text-black': {
          DEFAULT: 'var(--primitives-permanent-black-100)',
          hover: 'var(--primitives-permanent-black-70)',
        },

        // FILL COLORS

        // background
        'background-primary': {
          // to be renamed (fill-background-primary)
          DEFAULT: 'var(--figma-fill-background-primary)',
          hover: 'var(--figma-fill-background-primary)',
        },
        'fill-background-contrast': {
          DEFAULT: 'var(--figma-fill-background-contrast)',
          hover: 'var(--figma-fill-background-contrast)',
        },

        // button
        'fill-button-primary': {
          DEFAULT: 'var(--figma-fill-button-primary-default)',
          hover: 'var(--figma-fill-button-primary-hover)',
        },
        'fill-button-secondary': {
          DEFAULT: 'var(--figma-fill-button-secondary-default)',
          hover: 'var(--figma-fill-button-secondary-hover)',
        },

        // card
        'fill-card-primary': {
          DEFAULT: 'var(--figma-fill-card-primary-default)',
          hover: 'var(--figma-fill-card-primary-hover)',
        },
        // error
        'fill-error-strong': {
          DEFAULT: 'var(--figma-fill-state-error-strong-default)',
          hover: 'var(--figma-fill-state-error-strong-hover)',
        },
        'fill-error-weak': {
          DEFAULT: 'var(--figma-fill-state-error-weak-default)',
          hover: 'var(--figma-fill-state-error-weak-hover)',
        },
        // success
        'fill-success-strong': {
          DEFAULT: 'var(--figma-fill-state-success-strong-default)',
          hover: 'var(--figma-fill-state-success-strong-hover)',
        },
        'fill-success-weak': {
          DEFAULT: 'var(--figma-fill-state-success-weak-default)',
          hover: 'var(--figma-fill-state-success-weak-hover)',
        },
        // warning
        'fill-warning-strong': {
          DEFAULT: 'var(--figma-fill-state-warning-strong-default)',
          hover: 'var(--figma-fill-state-warning-strong-hover)',
        },
        'fill-warning-weak': {
          DEFAULT: 'var(--figma-fill-state-warning-weak-default)',
          hover: 'var(--figma-fill-state-warning-weak-hover)',
        },
        // info
        'fill-info-strong': {
          DEFAULT: 'var(--figma-fill-state-info-strong-default)',
          hover: 'var(--figma-fill-state-info-strong-hover)',
        },
        'fill-info-weak': {
          DEFAULT: 'var(--figma-fill-state-info-weak-default)',
          hover: 'var(--figma-fill-state-info-weak-hover)',
        },

        // STROKE COLORS

        'stroke-active': {
          DEFAULT: 'var(--figma-stroke-active)',
          hover: 'var(--figma-stroke-active)',
        },
        'stroke-primary': {
          DEFAULT: 'var(--figma-stroke-primary)',
          hover: 'var(--figma-stroke-primary)',
        },

        //error
        'stroke-error-strong': {
          DEFAULT: 'var(--figma-stroke-error-strong)',
          hover: 'var(--figma-stroke-error-strong)',
        },
        'stroke-error-weak': {
          DEFAULT: 'var(--figma-stroke-error-weak)',
          hover: 'var(--figma-stroke-error-weak)',
        },

        //success
        'stroke-success-strong': {
          DEFAULT: 'var(--figma-stroke-success-strong)',
          hover: 'var(--figma-stroke-success-strong)',
        },
        'stroke-success-weak': {
          DEFAULT: 'var(--figma-stroke-success-weak)',
          hover: 'var(--figma-stroke-success-weak)',
        },

        //warning
        'stroke-warning-strong': {
          DEFAULT: 'var(--figma-stroke-warning-strong)',
          hover: 'var(--figma-stroke-warning-strong)',
        },
        'stroke-warning-weak': {
          DEFAULT: 'var(--figma-stroke-warning-weak)',
          hover: 'var(--figma-stroke-warning-weak)',
        },

        //info
        'stroke-info-strong': {
          DEFAULT: 'var(--figma-stroke-info-strong)',
          hover: 'var(--figma-stroke-info-strong)',
        },
        'stroke-info-weak': {
          DEFAULT: 'var(--figma-stroke-info-weak)',
          hover: 'var(--figma-stroke-info-weak)',
        },
      },

      // Figma Styling
      borderRadius: {
        sm: 'var(--border-radius-sm)',
        md: 'var(--border-radius-md)',
        lg: 'var(--border-radius-lg)',
        xl: 'var(--border-radius-xl)',
      },
      padding: {
        xs: 'var(--padding-xs)',
        sm: 'var(--padding-sm)',
        md: 'var(--padding-md)',
        lg: 'var(--padding-lg)',
        xl: 'var(--padding-xl)',
        '2xl': 'var(--padding-2xl)',
        '3xl': 'var(--padding-3xl)',
        '4xl': 'var(--padding-4xl)',
      },
      gap: {
        xs: 'var(--padding-xs)',
        sm: 'var(--padding-sm)',
        md: 'var(--padding-md)',
        lg: 'var(--padding-lg)',
        xl: 'var(--padding-xl)',
        '2xl': 'var(--padding-2xl)',
        '3xl': 'var(--padding-3xl)',
        '4xl': 'var(--padding-4xl)',
      },
      height: {
        sm: 'var(--height-sm)',
        md: 'var(--height-md)',
        lg: 'var(--height-lg)',
      },
      fontSize: {
        sm: 'var(--size-sm)',
        md: 'var(--size-md)',
        lg: 'var(--size-lg)',
        xl: 'var(--size-xl)',
        '2xl': 'var(--size-2xl)',
      },
      lineHeight: {
        '100-xs': 'var(--line-height-100-xs)',
        '100-sm': 'var(--line-height-100-sm)',
        '100-md': 'var(--line-height-100-md)',
        '100-lg': 'var(--line-height-100-lg)',
        '100-xl': 'var(--line-height-100-xl)',
        '100-2xl': 'var(--line-height-100-2xl)',
        '140-xs': 'var(--line-height-140-xs)',
        '140-sm': 'var(--line-height-140-sm)',
        '140-md': 'var(--line-height-140-md)',
        '140-lg': 'var(--line-height-140-lg)',
        '140-xl': 'var(--line-height-140-xl)',
        '140-2xl': 'var(--line-height-140-2xl)',
      },
      letterSpacing: {
        default: 'var(--letter-spacing)',
      },
      fontWeight: {
        1: 'var(--weight-1)',
        2: 'var(--weight-2)',
        3: 'var(--weight-3)',
      },
      spacing: {
        xs: 'var(--spacing-xs)',
        sm: 'var(--spacing-sm)',
        md: 'var(--spacing-md)',
        lg: 'var(--spacing-lg)',
      },
      //from ShadcnUI
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        breathe: {
          '0%, 100%': { transform: 'scale(1)', opacity: 1 },
          '50%': { transform: 'scale(1.05)', opacity: 0.5 },
        },
        shake: {
          '0%, 70%': {
            transform: 'scale(1) rotate(0deg)',
          },
          '80%': {
            transform: 'scale(1.1) rotate(3deg)',
          },
          '85%': {
            transform: 'scale(1.1) rotate(-3deg)',
          },
          '90%': {
            transform: 'scale(1.1) rotate(3deg)',
          },
          '95%': {
            transform: 'scale(1.05) rotate(-3deg)',
          },
          '100%': {
            transform: 'scale(1) rotate(0deg)',
          },
        },
        highlight: {
          '0%, 100%': { borderColor: 'red' },
          '50%': { borderColor: 'red)', transform: 'scale(1.05)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        breathe: 'breathe 1.5s ease-in-out infinite',
        shake: 'shake 3s ease-in-out infinite',
        highlight: 'highlight 2s ease-in-out',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

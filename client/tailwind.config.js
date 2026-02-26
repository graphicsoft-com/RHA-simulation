const { createGlobPatternsForDependencies } = require('@nx/react/tailwind');
const { join } = require('path');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(
      __dirname,
      '{src,pages,components,app}/**/*!(*.stories|*.spec).{ts,tsx,html}',
    ),
    ...createGlobPatternsForDependencies(__dirname),
  ],
  theme: {
    extend: {
      fontFamily: {
        mono: ['"IBM Plex Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        bg:      '#070711',
        surface: '#0e0e1a',
        border:  '#1a1a2e',
        cyan:    '#00e5ff',
        green:   '#00ff88',
        red:     '#ff4757',
        amber:   '#ffaa00',
        muted:   '#4a4a6a',
        text:    '#d0d0e8',
      },
      animation: {
        pulse2: 'pulse2 2s ease-in-out infinite',
        fadein: 'fadein 0.3s ease forwards',
      },
      keyframes: {
        pulse2: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        fadein: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to:   { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
};

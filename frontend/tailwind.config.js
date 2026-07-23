/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050508',         // near-black cyberpunk background
        panel: '#0B0A12',       // card background
        line: '#221F30',        // hairline borders
        signal: '#22D3EE',      // cyan accent - live/success
        volt: '#A855F7',        // primary accent - neon purple
        warn: '#FFB020',        // pending/amber
        danger: '#FF5C5C',      // rejected/error
        flame: '#FF7A1A'        // combat-orange accent (tournaments listing)
      },
      fontFamily: {
        display: ['"Rajdhani"', 'sans-serif'],
        body: ['"Inter"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace']
      }
    }
  },
  plugins: []
};

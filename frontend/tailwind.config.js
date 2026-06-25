/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  '#E8F5E9',
          100: '#C8E6C9',
          200: '#A5D6A7',
          300: '#81C784',
          400: '#4CAF50',
          500: '#1B8A4E',
          600: '#146B3D',
          700: '#0E4D2C',
          800: '#082E1A',
          900: '#041709',
        },
        gold: '#FFCD00',
        accent: '#CE1126',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      boxShadow: {
        'soft': '0 2px 15px rgba(0,0,0,0.06)',
        'card': '0 4px 20px rgba(0,0,0,0.08)',
        'elevated': '0 8px 30px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
}

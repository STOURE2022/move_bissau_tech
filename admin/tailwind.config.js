/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#1B8A4E', dark: '#146B3D', light: '#E8F5E9' },
        secondary: '#FFCD00',
        accent: '#CE1126',
      },
    },
  },
  plugins: [],
}

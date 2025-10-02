/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#FF8C41',
        secondary: '#F8F5F0',
        background: '#FDFDFD',
      },
    },
  },
  plugins: [],
}

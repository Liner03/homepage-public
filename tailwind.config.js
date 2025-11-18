/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./modules/**/*.{html,js}",
    "./static/**/*.js"
  ],
  darkMode: 'media', // 使用系统深色模式
  theme: {
    extend: {
      colors: {
        // 可以在这里添加自定义颜色
      },
    },
  },
  plugins: [],
}

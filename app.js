const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const routes = require('./src/routes');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup Middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(cookieParser());

// Setup View Engine (EJS)
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'src/views'));

// Static Folder
app.use(express.static(path.join(__dirname, 'public')));

// Routes Setup
app.use('/', routes);

// Export for Vercel (serverless)
module.exports = app;

// Only listen when run locally (npm start / npm run dev)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log('====================================================');
    console.log(` EarthRanger Web Generator aktif di: http://localhost:${PORT}`);
    console.log('====================================================');
  });
}
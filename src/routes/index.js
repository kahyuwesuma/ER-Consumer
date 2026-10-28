const express = require('express');
const router = express.Router();
const AuthController = require('../controllers/authController');
const ReportController = require('../controllers/reportController');

// Auth Routes
router.get('/login', AuthController.renderLogin);
router.post('/login', AuthController.login);
router.get('/logout', AuthController.logout);

// Dashboard
router.get('/', (req, res) => res.redirect('/dashboard'));
router.get('/dashboard', ReportController.renderDashboard);

// Report (async job + progress)
router.post('/report/start', ReportController.start);
router.get('/report/progress/:id', ReportController.progress);
router.get('/report/download/:id', ReportController.download);

module.exports = router;
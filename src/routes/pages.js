// src/routes/pages.js
const express = require('express');
const path = require('path');
const router = express.Router();
const { sendPageWithNavbar } = require('../utils/navbar');

// Home page
router.get('/', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'index.html'), {
    title: 'Test Kit',
    subtitle: 'Welcome. Now go and test all the things!',
    activeItem: 'home'
  });
});

// Identity tester page
router.get('/identity-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'identity-tester.html'), {
    title: 'Identity',
    subtitle: 'Test the /identity/get and /identity/match endpoints',
    activeItem: 'identity'
  });
});

// Auth tester page
router.get('/auth-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'auth-tester.html'), {
    title: 'Auth',
    subtitle: 'Test the /auth/get endpoint',
    activeItem: 'auth'
  });
});

// Balance tester page
router.get('/balance-tester.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'balance-tester.html'), {
    title: 'Balance',
    subtitle: 'Test the /accounts/balance/get endpoint',
    activeItem: 'balance'
  });
});

// Link configuration page
router.get('/link-config.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'link-config.html'), {
    title: 'Link Configuration',
    subtitle: 'Customize Link token parameters',
    activeItem: 'link-config'
  });
});

// Webhooks page
router.get('/webhooks.html', (req, res) => {
  sendPageWithNavbar(res, path.join(__dirname, '../../public', 'webhooks.html'), {
    title: 'Webhooks',
    subtitle: 'View and manage webhook events',
    activeItem: 'webhooks'
  });
});

module.exports = router;
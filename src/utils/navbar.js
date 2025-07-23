// src/utils/navbar.js
const fs = require('fs');

// Navbar generation function
function generateNavbar(config = {}) {
  const {
    title = 'Test Kit',
    subtitle = 'Welcome. Now go and test all the things!',
    activeItem = 'home',
    logoSrc = '/assets/symbol-holo.png'
  } = config;

  const navItems = [
    { href: '/', text: 'Home', id: 'home' },
    { href: '/link-config.html', text: 'Link', id: 'link-config' },
    { href: '/webhooks.html', text: 'Webhooks', id: 'webhooks' },
    { href: '/auth-tester.html', text: 'Auth', id: 'auth' },
    { href: '/balance-tester.html', text: 'Balance', id: 'balance' },
    { href: '/identity-tester.html', text: 'Identity', id: 'identity' }
  ];

  const navItemsHTML = navItems.map(item => {
    const activeClass = item.id === activeItem ? ' active' : '';
    return `<a href="${item.href}" class="nav-link${activeClass}">${item.text}</a>`;
  }).join('');

  return `
    <div class="navbar" id="appNavbar">
      <a href="/" class="navbar-brand">
        <img src="${logoSrc}" alt="Plaid logo">
        <div>
          <div class="navbar-title">${title}</div>
          <div class="navbar-subtitle">${subtitle}</div>
        </div>
      </a>
      <nav class="navbar-nav" id="navbarItems">
        ${navItemsHTML}
        <button class="nav-link nav-logout" onclick="UIUtils.logout()">
          Logout
        </button>
      </nav>
    </div>
  `;
}

// Enhanced page serving with navbar injection
function sendPageWithNavbar(res, filePath, navbarConfig = {}) {
  try {
    // Read the HTML file
    let htmlContent = fs.readFileSync(filePath, 'utf8');

    // Generate navbar HTML
    const navbarHTML = generateNavbar(navbarConfig);

    // Insert navbar after <body> tag
    htmlContent = htmlContent.replace(
      /<body[^>]*>/i,
      `$&\n    ${navbarHTML}`
    );

    res.send(htmlContent);
  } catch (error) {
    console.error('Error serving page with navbar:', error);
    res.status(500).send('Internal Server Error');
  }
}

module.exports = {
  generateNavbar,
  sendPageWithNavbar
};
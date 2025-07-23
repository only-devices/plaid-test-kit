# Plaid Test Kit

A comprehensive test kit for Plaid's Link experiences and API endpoints in sandbox mode. Features OAuth support, embedded Link, update mode, and a clean, responsive interface.

## Features

### Link Experiences
- **Standard Link**: Classic modal experience with full OAuth support
- **Embedded Link**: Modern embedded experience with seamless page integration
- **Hosted Link**: Opens Plaid-hosted Link session and then returns to app once complete with access token
- **Layer Support**: Phone-based authentication using Plaid Layer for eligible users
- **Update Mode**: Add additional accounts to existing connections using account selection

### API Testing Modules

- **Identity APIs**: Test both `/identity/get` and `/identity/match` simultaneously. View match scores, compare input vs. retrieved data, and see raw API responses.
- **Auth API**: Test the `/auth/get` endpoint to retrieve account and routing numbers for selected accounts. View ACH, routing, and wire routing numbers, as well as account type and subtype.
- **Balance API**: Test the `/accounts/balance/get` endpoint to retrieve real-time balance information for selected accounts. See available, current, and credit limit balances, currency codes, and last updated timestamps.
- **Webhooks**: Real-time webhook monitoring with filtering, search, statistics, and export capabilities. View and analyze webhook events as they arrive.
- **Account Selection**: For all modules, select specific accounts from connected institutions to test API responses on a per-account basis.
- **Real-time Results**: All modules display results instantly, including formatted and raw JSON responses for easy debugging.
- **Copy-to-Clipboard**: Easily copy raw API responses for any test with a single click.
- **OAuth Detection**: Automatic detection and display of OAuth vs credential-based connections for all API tests.

### Technical Features
- **Modular Architecture**: Clean separation of concerns with shared utilities
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Status**: Live status updates and error handling
- **Token Management**: Secure token exchange and validation

## Project Structure

```
plaid-test-kit/
├── app.js                        # Main application entry point
├── package.json
├── .env.example
├── .env
├── README.md
├── sessions/                     # Session storage directory
├── src/                          # Server-side application code
│   ├── config/                   # Configuration modules
│   │   ├── environment.js
│   │   ├── plaid.js
│   │   └── session.js
│   ├── middleware/               # Express middleware
│   │   ├── auth.js
│   │   └── rateLimiter.js
│   ├── routes/                   # API and page routes
│   │   ├── api/
│   │   │   ├── auth-v2.js
│   │   │   ├── plaid-v2.js
│   │   │   └── webhooks-v2.js
│   │   ├── health.js
│   │   └── pages.js
│   ├── services/                 # Business logic services
│   │   ├── authService.js
│   │   ├── errorService.js
│   │   ├── plaidService.js
│   │   └── webhookService.js
│   ├── storage/                  # Data storage utilities
│   │   └── itemStore.js
│   └── utils/                    # Utility modules
│       ├── crypto.js
│       ├── errors.js      
│       ├── logger.js
│       ├── navbar.js
│       ├── response.js
│       └── validation.js
└── public/                       # Client-side files
    ├── index.html
    ├── identity-tester.html
    ├── auth-tester.html
    ├── balance-tester.html
    ├── link-config.html
    ├── webhooks.html
    ├── assets/                   # Static assets
    │   ├── plaid-bw.png
    │   └── symbol-holo.png
    ├── css/
    │   └── styles.css
    └── js/
        ├── account-manager.js
        ├── api-client.js
        ├── auth-tester.js
        ├── balance-tester.js
        ├── identity-tester.js
        ├── layer-manager.js
        ├── link-config.js
        ├── plaid-link.js
        ├── start-page.js
        ├── ui-utils.js
        └── webhooks.js
```

## Features

- **Multiple Link Experiences:** Standard, Embedded, Layer, Update Mode
- **API Testing:** Identity, Auth, Balance endpoints, and Webhooks
- **OAuth Support:** Automatic detection and redirect handling
- **Layer Support:** Phone-based authentication for eligible users
- **Webhook Monitoring:** Real-time webhook capture with filtering and export
- **Session Management:** In-memory for dev, file-based for production
- **Copy-to-Clipboard:** Easily copy tokens and URLs
- **Modular Architecture:** Separate JS modules for each tester
- **Responsive UI:** Works on desktop and mobile
- **Live Status & Error Handling:** Real-time feedback in the UI

## Configuration

- Set environment variables in `.env` (see `.env.example`)

## Quick Start

I used Node v24 when building and running this as of July 2025.

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
```

Edit `.env` with the following:
```env
SESSION_SECRET=32_character_random_string_used_for_auth
ENCRYPTION_KEY=32_character_random_string_used_for_auth
PORT=3000
```

### 3. Configure OAuth (Optional)
For OAuth testing:
- Visit [dashboard.plaid.com](https://dashboard.plaid.com)
- Go to Team Settings → API
- Add `http://${HOST}:${PORT}/oauth-redirect` (where HOST and PORT are defined in the .env file for the project) to "Allowed OAuth redirect URIs" -- if these variables aren't set, the defaults of HOST=localhost and PORT=3000 are used
- Save changes

### 4. Configure Webhooks (Optional)
For webhook testing:
- Use the webhook URL displayed in the app: `http://${HOST}:${PORT}/webhooks`
- Add this URL as the webhook parameter when creating Link tokens
- **Note**: Only webhooks for items linked through this Test Kit will be displayed

### 5. Start the Server
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### 6. Open Your Browser
Navigate to `http://localhost:3000`

## Usage Guide

### Testing Link Experiences

1. **Choose Your Experience**: On the start page, select Standard Link, Embedded Link, or Update Mode
2. **Connect Your Bank**: Use any institution - OAuth will be used automatically if supported
3. **View Results**: See connection details and obtain access token

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Start page with Link options |
| `GET` | `/identity-tester.html` | Identity API testing interface |
| `GET` | `/webhooks.html` | Webhook monitoring interface |
| `POST` | `/api/create-link-token` | Create Link token (supports update mode) |
| `POST` | `/api/exchange-token` | Exchange public_token for access_token |
| `POST` | `/api/set-token` | Set access_token directly |
| `POST` | `/api/get-accounts` | Get available accounts |
| `POST` | `/api/test-identity` | Test Identity endpoints |
| `POST` | `/api/session/token/create` | Create Layer session token |
| `POST` | `/api/user_account/session/get` | Get Layer session results |
| `GET` | `/api/webhooks` | Get webhook history |
| `POST` | `/api/webhooks/clear` | Clear webhook logs |
| `POST` | `/webhooks` | Webhook endpoint for Plaid events |
| `POST` | `/api/logout` | Clears session |
| `GET` | `/oauth-redirect` | Handle OAuth redirects |
| `GET` | `/health` | Public health check and server status |
| `GET` | `/api/status` | Front-end API health status (behind login) |

## Features in Detail

### OAuth Support
- **Automatic Detection**: OAuth is used automatically when supported by the institution
- **Redirect Handling**: Proper OAuth redirect flow management
- **Event Tracking**: OAuth-specific event logging and status updates
- **Fallback Support**: Graceful fallback to credentials when OAuth isn't available

### Embedded Link
- **Native Integration**: Link embedded directly in the page
- **Fallback Support**: Automatic fallback to standard Link if embedded isn't supported
- **Real-time Status**: Live updates on Link events and status
- **Responsive Design**: Works seamlessly on all screen sizes

### Layer Support
- **Phone-based Authentication**: Users can authenticate using their phone number
- **Eligibility Detection**: Automatic detection of Layer availability for phone numbers
- **Real-time Events**: Live monitoring of Layer session events (LAYER_READY, LAYER_NOT_AVAILABLE)
- **Session Management**: Complete Layer session lifecycle management

### Webhook Monitoring
- **Real-time Capture**: Webhook events displayed instantly as they arrive
- **Filtering & Search**: Filter by event type and search webhook content
- **Statistics Dashboard**: View total webhooks, unique types, and hourly activity
- **Export Functionality**: Export webhook logs as JSON for analysis
- **Visual Interface**: Clean, terminal-style display with syntax highlighting

## Modular Architecture

### Shared Modules

- **API Client**: Centralized API communication with error handling
- **Plaid Link Manager**: Unified Link management for all modes
- **Layer Manager**: Complete Layer session management and phone number handling
- **Webhooks Manager**: Real-time webhook monitoring and filtering
- **Account Manager**: Passes account details between different testing modules
- **UI Utils**: Reusable UI utilities and status management

### Benefits

- **Code Reuse**: Shared utilities across all pages
- **Maintainability**: Clean separation of concerns
- **Extensibility**: Easy to add new features and pages
- **Consistency**: Unified UI patterns and error handling

## Development Notes

### Environment
- **Sandbox Only**: Configured for Plaid sandbox environment
- **Local Development**: Optimized for localhost development
- **Memory Storage**: Access tokens stored in memory (not persistent)

### Production Considerations
- Implement proper session management
- Use secure token storage (database/Redis)
- Add request rate limiting
- Implement proper error tracking
- Use HTTPS for OAuth redirects
- Add authentication and authorization

### Browser Support
- Modern browsers with ES6+ support
- Chrome, Firefox, Safari, Edge
- Mobile browsers supported

## Troubleshooting

### Common Issues

1. **OAuth Redirect URI Mismatch**
   - Ensure `http://${HOST}:${PORT}$/oauth-redirect` is added to your Plaid dashboard
   - Check that PORT matches your configuration

2. **Token Exchange Errors**
   - Verify your Plaid credentials in `.env`
   - Ensure you're using sandbox environment tokens

3. **Embedded Link Not Loading**
   - Check browser console for errors
   - Verify Plaid SDK is loading properly
   - Try the standard Link as fallback

4. **No Accounts Found**
   - Ensure the access token is valid
   - Check that the connected item has accounts
   - Verify API permissions in Plaid dashboard

### Debug Tips
- Check browser console for detailed error logs
- Use the `/health` endpoint to verify server status
- Monitor network tab for API request/response details
- Enable verbose logging in development mode

## Contributing

This project uses a modular architecture to make contributions easier:

1. **Adding New Features**: Create new modules in `/public/js/shared/`
2. **New Pages**: Follow the pattern of existing pages with shared resources
3. **API Endpoints**: Add new routes following existing patterns
4. **Styling**: Extend the design system in `/public/css/styles.css`

## Dependencies

- **express**: Web framework
- **plaid**: Official Plaid Node.js client library
- **dotenv**: Environment variable management
- **nodemon**: Development auto-restart (dev dependency)

## License

MIT License - see LICENSE file for details

## Support

For Plaid API questions, visit the [Plaid documentation](https://plaid.com/docs/).

For issues with this application, check the troubleshooting section above or review the console logs for detailed error information.
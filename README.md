# Plaid Test Kit

A comprehensive test kit for Plaid's Link experiences and API endpoints in sandbox mode. Features OAuth support, embedded Link, update mode, and a clean, responsive interface.

## Features

### Link Experiences
- **Standard Link**: Classic modal experience with full OAuth support
- **Embedded Link**: Modern embedded experience with seamless page integration
- **Update Mode**: Add additional accounts to existing connections using account selection

### API Testing Modules
- **Identity APIs**: Test both `/identity/get` and `/identity/match` simultaneously
- **Account Selection**: Test with specific accounts from connected institutions
- **Real-time Results**: Side-by-side comparison of match scores and retrieved data
- **OAuth Detection**: Automatic detection and display of OAuth vs credential-based connections

### Technical Features
- **Modular Architecture**: Clean separation of concerns with shared utilities
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Real-time Status**: Live status updates and error handling
- **Token Management**: Secure token exchange and validation

## Project Structure

```
plaid-test-kit/
├── app.js                          # Express server
├── package.json                    # Dependencies and scripts
├── .env.example                    # Environment variables template
├── .env                           # Your environment variables
├── README.md                      # This file
└── public/
    ├── index.html                 # Start page with Link options
    ├── identity-tester.html       # Identity API testing interface
    ├── css/
    │   └── styles.css            # Shared styles and design system
    └── js/
        ├── api-client.js         # API communication module
        ├── plaid-link.js         # Plaid Link wrapper and utilities
        ├── ui-utils.js           # UI utilities and helpers
        ├── start-page.js         # Start page functionality
        └── identity-tester.js    # Identity testing functionality
```

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up Environment
```bash
cp .env.example .env
```

Edit `.env` with your Plaid credentials:
```env
PLAID_CLIENT_ID=your_plaid_client_id_here
PLAID_SECRET=your_plaid_sandbox_secret_here
PORT=3000
```

### 3. Configure OAuth (Optional)
For OAuth testing:
- Visit [dashboard.plaid.com](https://dashboard.plaid.com)
- Go to Team Settings → API
- Add `http://localhost:3000/oauth-redirect` to "Allowed OAuth redirect URIs"
- Save changes

### 4. Start the Server
```bash
npm start
```

Or for development with auto-restart:
```bash
npm run dev
```

### 5. Open Your Browser
Navigate to `http://localhost:3000`

## Usage Guide

### Testing Link Experiences

1. **Choose Your Experience**: On the start page, select Standard Link, Embedded Link, or Update Mode
2. **Connect Your Bank**: Use any institution - OAuth will be used automatically if supported
3. **View Results**: See connection details and obtain access token

### Testing Identity APIs

1. **Access Token**: Either continue from Link or enter an existing access token
2. **Load Accounts**: Load available accounts from your connection
3. **Enter User Data**: Fill in the user information form
4. **Select Account**: Choose which account to test against
5. **Run Tests**: Submit to test both Identity endpoints simultaneously
6. **View Results**: Compare match scores with retrieved data

### Update Mode Testing

1. **Enter Access Token**: Provide an existing access token
2. **Start Update Mode**: Link will open with account selection enabled
3. **Add Accounts**: Select additional accounts to add to the connection

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` | Start page with Link options |
| `GET` | `/identity-tester.html` | Identity API testing interface |
| `POST` | `/api/create-link-token` | Create Link token (supports update mode) |
| `POST` | `/api/exchange-token` | Exchange public_token for access_token |
| `POST` | `/api/set-token` | Set access_token directly |
| `POST` | `/api/get-accounts` | Get available accounts |
| `POST` | `/api/test-identity` | Test Identity endpoints |
| `GET` | `/oauth-redirect` | Handle OAuth redirects |
| `GET` | `/health` | Health check and server status |

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

### Update Mode
- **Account Selection**: Enable users to add additional accounts
- **Token Validation**: Automatic validation of existing access tokens
- **Seamless Flow**: Integrated experience for account additions

### Identity API Testing
- **Comprehensive Testing**: Test both `/get` and `/match` endpoints
- **Account Filtering**: Test specific accounts from multi-account connections
- **Score Visualization**: Clear display of match scores and boolean flags
- **Data Comparison**: Side-by-side view of input vs retrieved data

## Modular Architecture

### Shared Modules

- **API Client**: Centralized API communication with error handling
- **Plaid Link Manager**: Unified Link management for all modes
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
   - Ensure `http://localhost:3000/oauth-redirect` is added to your Plaid dashboard
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
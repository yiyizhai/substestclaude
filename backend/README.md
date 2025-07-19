# Subscription App Backend

A complete backend server for Android subscription app with Google Play Console integration.

## Features

- **Google Play Console Integration**: Direct integration with Google Play Publisher API
- **Purchase Verification**: Server-side verification of all purchases and subscriptions
- **Subscription Management**: Create, update, and manage subscription products
- **User Authentication**: JWT-based authentication with secure password hashing
- **Webhook Support**: Handle real-time subscription updates from Google Play
- **Analytics**: Subscription analytics and churn rate calculation
- **Database Models**: MongoDB models for users, subscriptions, and purchases
- **Cron Jobs**: Automated subscription status checking and sync
- **Security**: Rate limiting, CORS, helmet, and encrypted data storage

## Prerequisites

- Node.js 18+ 
- MongoDB
- Google Play Console Developer Account
- Google Cloud Service Account with Play Developer API access

## Installation

1. **Clone and Install**
   ```bash
   cd backend
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

3. **Google Play Console Setup**
   - Create a service account in Google Cloud Console
   - Enable Google Play Developer API
   - Download service account key JSON file
   - Set `GOOGLE_APPLICATION_CREDENTIALS` path in .env

4. **Database Setup**
   ```bash
   # Make sure MongoDB is running
   mongod
   ```

## Configuration

### Environment Variables

```env
PORT=3000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/subscription-app
JWT_SECRET=your-super-secret-jwt-key-here
JWT_EXPIRES_IN=7d
GOOGLE_APPLICATION_CREDENTIALS=path/to/your/service-account-key.json
GOOGLE_PLAY_PACKAGE_NAME=com.example.subscriptionapp
WEBHOOK_SECRET=your-webhook-secret-here
```

### Google Play Console Setup

1. **Create Service Account**
   - Go to Google Cloud Console
   - Create new service account
   - Download JSON key file
   - Add service account to Google Play Console with "Finance" permissions

2. **Enable APIs**
   - Google Play Developer API
   - Google Play Console API (if needed)

3. **Configure Webhooks**
   - Go to Google Play Console → Your App → Monetization → Setup → Real-time developer notifications
   - Set webhook URL: `https://yourdomain.com/api/v1/webhooks/google-play`

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/forgot-password` - Password reset

### Purchases
- `POST /api/v1/purchases/verify` - Verify purchase with Google Play
- `GET /api/v1/purchases/history` - Get purchase history

### Subscriptions
- `GET /api/v1/subscriptions/status` - Get subscription status
- `POST /api/v1/subscriptions/create` - Create subscription product
- `GET /api/v1/subscriptions/products` - List subscription products
- `POST /api/v1/subscriptions/cancel` - Cancel subscription
- `GET /api/v1/subscriptions/history` - Get subscription history

### Webhooks
- `POST /api/v1/webhooks/google-play` - Google Play webhook endpoint

### Users
- `GET /api/v1/users/profile` - Get user profile
- `PUT /api/v1/users/profile` - Update user profile
- `DELETE /api/v1/users/account` - Delete user account

## Running the Server

### Development
```bash
npm run dev
```

### Production
```bash
npm start
```

## Google Play Console Product Setup

### Create Monthly Subscription ($10.99 with 1-week trial)

```bash
curl -X POST https://your-api-domain.com/api/v1/subscriptions/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "monthly_subscription_1099",
    "subscriptionPeriod": "P1M",
    "trialPeriod": "P1W",
    "priceMicros": 10990000,
    "currency": "USD",
    "listings": {
      "en-US": {
        "title": "Monthly Premium Subscription",
        "description": "Get access to premium features with our monthly subscription"
      }
    }
  }'
```

### Create Prepaid Plan ($20 one-time)

```bash
curl -X POST https://your-api-domain.com/api/v1/subscriptions/inapp/create \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "prepaid_plan_2000",
    "priceMicros": 20000000,
    "currency": "USD",
    "listings": {
      "en-US": {
        "title": "Prepaid Premium Plan",
        "description": "One-time purchase for premium features"
      }
    }
  }'
```

## Testing

### Health Check
```bash
curl https://your-api-domain.com/health
```

### Purchase Verification
```bash
curl -X POST https://your-api-domain.com/api/v1/purchases/verify \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "purchaseToken": "PURCHASE_TOKEN_FROM_ANDROID_APP",
    "productId": "monthly_subscription_1099",
    "packageName": "com.example.subscriptionapp",
    "subscriptionId": "monthly_subscription_1099",
    "userId": "USER_ID"
  }'
```

## Cron Jobs

The server runs automated tasks:

- **Every hour**: Check subscription statuses
- **Every 30 minutes**: Check for expired subscriptions  
- **Every 6 hours**: Sync with Google Play for active subscriptions

## Security Features

- **Rate Limiting**: 100 requests per 15 minutes per IP
- **CORS**: Configured allowed origins
- **Helmet**: Security headers
- **JWT Authentication**: Secure token-based auth
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: express-validator
- **Webhook Signature Verification**: HMAC validation

## Deployment

### Using PM2 (Production)
```bash
npm install -g pm2
pm2 start src/server.js --name "subscription-backend"
pm2 startup
pm2 save
```

### Using Docker
```bash
# Build image
docker build -t subscription-backend .

# Run container
docker run -p 3000:3000 --env-file .env subscription-backend
```

### Environment Variables for Production
```env
NODE_ENV=production
PORT=3000
MONGODB_URI=mongodb://your-production-mongodb-url
JWT_SECRET=your-production-jwt-secret
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
WEBHOOK_SECRET=your-production-webhook-secret
```

## Monitoring

- Health check endpoint: `/health`
- Subscription analytics: Available via `SubscriptionService`
- Churn rate calculation: Built-in analytics
- Webhook event logging: All webhook events are logged

## Troubleshooting

1. **Google Play API Errors**
   - Verify service account permissions
   - Check API quotas and limits
   - Ensure service account is added to Play Console

2. **Webhook Issues**
   - Verify webhook URL is accessible
   - Check webhook secret configuration
   - Validate webhook payload signature

3. **Database Issues**
   - Check MongoDB connection
   - Verify database indexes
   - Monitor connection pool

## Support

For issues with Google Play Console integration, refer to:
- [Google Play Console Developer Documentation](https://developer.android.com/google/play/console)
- [Google Play Publisher API Documentation](https://developers.google.com/android-publisher)

This backend provides a complete solution for managing Android app subscriptions with Google Play Console integration.
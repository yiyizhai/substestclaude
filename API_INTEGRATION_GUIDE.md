# API Integration Guide

## Overview
This Android app integrates with a backend API to handle user authentication, purchase verification, and subscription management. The API integration provides secure purchase verification and subscription status tracking.

## API Configuration

### Base URL
Update the `BASE_URL` in `ApiClient.kt` to point to your backend API:
```kotlin
private const val BASE_URL = "https://your-api-domain.com/api/v1/"
```

## API Endpoints

### Authentication
- `POST /auth/login` - User login
- `POST /auth/register` - User registration

### Purchase Verification
- `POST /purchases/verify` - Verify Google Play purchases

### Subscription Management
- `GET /subscription/status` - Get user subscription status
- `POST /subscription/webhook` - Handle Google Play webhooks

### User Management
- `GET /user/profile` - Get user profile
- `PUT /user/profile` - Update user profile

## Authentication Flow

1. User opens app → `AuthActivity` 
2. User logs in/registers → API call to backend
3. Backend returns JWT token → Stored securely using `EncryptedSharedPreferences`
4. Token used for all subsequent API calls

## Purchase Verification Flow

1. User initiates purchase → Google Play Billing
2. Google Play returns purchase token
3. App sends purchase token to backend API
4. Backend verifies with Google Play Developer API
5. Backend returns verification result
6. App acknowledges purchase if valid

## Data Models

### Request Models
- `LoginRequest` - Email, password
- `RegisterRequest` - Email, password, name
- `PurchaseVerificationRequest` - Purchase token, product ID, package name, user ID

### Response Models
- `AuthResponse` - Success, message, token, user data
- `PurchaseVerificationResponse` - Success, valid, subscription status
- `SubscriptionStatusResponse` - Current subscription details

## Security Features

1. **Encrypted Storage**: All sensitive data stored using `EncryptedSharedPreferences`
2. **HTTPS Only**: App configured with `usesCleartextTraffic="false"`
3. **Token-based Auth**: JWT tokens for API authentication
4. **Purchase Verification**: Server-side verification of all purchases

## Error Handling

The app handles various error scenarios:
- Network failures
- API errors
- Authentication failures
- Purchase verification failures
- Token expiration

## Backend Requirements

Your backend API should:

1. **User Authentication**
   - Store user credentials securely
   - Generate JWT tokens
   - Handle login/registration

2. **Purchase Verification**
   - Integrate with Google Play Developer API
   - Verify purchase tokens
   - Store purchase history
   - Handle subscription status updates

3. **Webhook Handling**
   - Process Google Play webhooks
   - Update subscription status
   - Handle refunds and cancellations

## Environment Configuration

### Development
- Update `BASE_URL` to development server
- Use test Google Play accounts
- Enable debug logging

### Production
- Set production API URL
- Disable debug logging
- Use production Google Play Console

## Testing

1. **Authentication Testing**
   - Test login/registration flows
   - Verify token storage and retrieval
   - Test token refresh

2. **Purchase Testing**
   - Use Google Play testing tracks
   - Test purchase verification
   - Verify subscription status updates

3. **Error Handling Testing**
   - Test network failures
   - Test API errors
   - Test malformed responses

## Integration Steps

1. **Setup Backend API**
   - Implement required endpoints
   - Setup Google Play Developer API integration
   - Configure webhook endpoints

2. **Configure App**
   - Update `BASE_URL` in `ApiClient.kt`
   - Test API connectivity
   - Verify authentication flow

3. **Test Purchase Flow**
   - Create test products in Google Play Console
   - Test purchase verification
   - Verify subscription status updates

4. **Deploy**
   - Deploy backend API
   - Upload app to Google Play Console
   - Test end-to-end flow

## Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Check API URL configuration
   - Verify network connectivity
   - Check token storage/retrieval

2. **Purchase Verification Failures**
   - Verify Google Play Developer API setup
   - Check purchase token format
   - Verify backend webhook handling

3. **Network Errors**
   - Check HTTPS configuration
   - Verify SSL certificates
   - Test API connectivity

## Code Structure

```
app/src/main/java/com/example/subscriptionapp/
├── api/
│   ├── ApiClient.kt          # Retrofit configuration
│   ├── ApiService.kt         # API endpoints
│   └── ApiModels.kt          # Request/response models
├── repository/
│   └── SubscriptionRepository.kt  # API interaction layer
├── utils/
│   └── SecureStorage.kt      # Encrypted storage
├── AuthActivity.kt           # Authentication UI
├── MainActivity.kt           # Main app UI
└── BillingManager.kt         # Google Play Billing integration
```

This structure provides a clean separation of concerns with secure API integration for your subscription-based Android app.
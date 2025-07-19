# Google Play Console Setup Guide

## Prerequisites
1. Google Play Console account
2. App uploaded to Google Play Console
3. App signed with upload key

## Step 1: Create In-App Products

### Monthly Subscription ($10.99/month with 1-week free trial)
1. Go to Google Play Console → Your App → Monetization → Products → Subscriptions
2. Click "Create subscription"
3. Fill in the details:
   - **Product ID**: `monthly_subscription_1099`
   - **Name**: Monthly Premium Subscription
   - **Description**: Get access to premium features with our monthly subscription

### Base Plan Configuration
1. After creating the subscription, configure the base plan:
   - **Base plan ID**: `monthly-base-plan`
   - **Billing period**: 1 month
   - **Price**: $10.99 USD
   - **Grace period**: 3 days (recommended)
   - **Account hold**: 30 days (recommended)

### Free Trial Offer
1. In the same subscription, create an offer:
   - **Offer ID**: `free-trial-offer`
   - **Name**: 1-Week Free Trial
   - **Eligibility**: New subscribers only
   - **Phase 1**: Free trial
     - Duration: 1 week
     - Price: $0.00
   - **Phase 2**: Subscription
     - Duration: Recurring
     - Price: $10.99 USD
     - Billing period: 1 month

## Step 2: Create Prepaid Plan ($20 one-time purchase)

1. Go to Google Play Console → Your App → Monetization → Products → In-app products
2. Click "Create product"
3. Fill in the details:
   - **Product ID**: `prepaid_plan_2000`
   - **Name**: Prepaid Premium Plan
   - **Description**: One-time purchase for premium features
   - **Price**: $20.00 USD

## Step 3: Activate Products

1. Make sure both products are **Active**
2. The subscription needs to be **Active** with at least one **Active** base plan
3. The offer should be **Active** and properly configured

## Step 4: Testing

### License Testing
1. Add your test account email to "License Testing" in Google Play Console
2. Use the test account to install and test the app
3. License testers can make purchases without being charged

### Internal Testing
1. Upload your app to Internal Testing track
2. Add testers to the Internal Testing track
3. Share the testing link with your testers

## Important Notes

1. **Product IDs must match**: The product IDs in your code must exactly match those in Google Play Console
2. **Base Plan ID**: For subscriptions, you need both a product ID and base plan ID
3. **Offer Token**: Free trial offers require proper offer token handling
4. **Testing**: Use test accounts for testing to avoid real charges
5. **Verification**: Always verify purchases on your server before granting access

## Code References

The product IDs are defined in `BillingManager.kt`:
- Monthly subscription: `monthly_subscription_1099`
- Prepaid plan: `prepaid_plan_2000`
- Base plan: `monthly-base-plan`
- Free trial offer: `free-trial-offer`

## Troubleshooting

1. **"Item not found"**: Check that product IDs match exactly
2. **"Product not active"**: Ensure products are activated in Play Console
3. **"App not published"**: App must be published to at least Internal Testing
4. **"Billing unavailable"**: Check device has Google Play Services and valid payment method
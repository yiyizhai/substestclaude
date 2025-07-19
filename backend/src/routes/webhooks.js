const express = require('express');
const crypto = require('crypto');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const GooglePlayService = require('../services/googlePlayService');

const router = express.Router();
const googlePlayService = new GooglePlayService();

// Middleware to verify webhook signature
const verifyWebhookSignature = (req, res, next) => {
  const signature = req.headers['x-goog-signature'];
  const body = JSON.stringify(req.body);
  
  if (!signature) {
    return res.status(401).json({
      success: false,
      message: 'Missing webhook signature'
    });
  }

  const expectedSignature = crypto
    .createHmac('sha256', process.env.WEBHOOK_SECRET)
    .update(body)
    .digest('base64');

  if (signature !== expectedSignature) {
    return res.status(401).json({
      success: false,
      message: 'Invalid webhook signature'
    });
  }

  next();
};

// Google Play Console webhook endpoint
router.post('/google-play', verifyWebhookSignature, async (req, res) => {
  try {
    const { message } = req.body;
    
    if (!message || !message.data) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook payload'
      });
    }

    // Decode the base64 message data
    const notificationData = JSON.parse(Buffer.from(message.data, 'base64').toString());
    
    console.log('Received webhook notification:', notificationData);

    // Handle different notification types
    if (notificationData.subscriptionNotification) {
      await handleSubscriptionNotification(notificationData.subscriptionNotification);
    } else if (notificationData.oneTimeProductNotification) {
      await handleOneTimeProductNotification(notificationData.oneTimeProductNotification);
    } else if (notificationData.testNotification) {
      console.log('Test notification received');
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
});

async function handleSubscriptionNotification(notification) {
  const { 
    version, 
    notificationType, 
    purchaseToken, 
    subscriptionId 
  } = notification;

  console.log(`Processing subscription notification: ${notificationType} for ${subscriptionId}`);

  try {
    // Find the subscription in our database
    const subscription = await Subscription.findOne({ 
      purchaseToken: purchaseToken,
      subscriptionId: subscriptionId 
    });

    if (!subscription) {
      console.log(`Subscription not found for token: ${purchaseToken}`);
      return;
    }

    // Get fresh subscription data from Google Play
    const googlePlayData = await googlePlayService.verifyPurchase(
      purchaseToken,
      subscription.productId,
      subscriptionId
    );

    // Update subscription based on notification type
    switch (notificationType) {
      case 1: // SUBSCRIPTION_RECOVERED
        subscription.status = 'ACTIVE';
        subscription.cancelReason = null;
        subscription.userCancellationTime = null;
        break;
        
      case 2: // SUBSCRIPTION_RENEWED
        subscription.status = 'ACTIVE';
        subscription.expiryTime = new Date(parseInt(googlePlayData.expiryTimeMillis));
        subscription.autoRenewing = googlePlayData.autoRenewing;
        break;
        
      case 3: // SUBSCRIPTION_CANCELED
        subscription.status = 'CANCELLED';
        subscription.cancelReason = googlePlayData.cancelReason;
        subscription.userCancellationTime = googlePlayData.userCancellationTimeMillis ? 
          new Date(parseInt(googlePlayData.userCancellationTimeMillis)) : new Date();
        subscription.autoRenewing = false;
        break;
        
      case 4: // SUBSCRIPTION_PURCHASED
        subscription.status = 'ACTIVE';
        subscription.purchaseTime = new Date(parseInt(googlePlayData.purchaseTimeMillis));
        subscription.startTime = new Date(parseInt(googlePlayData.startTimeMillis));
        break;
        
      case 5: // SUBSCRIPTION_ON_HOLD
        subscription.status = 'ACCOUNT_HOLD';
        break;
        
      case 6: // SUBSCRIPTION_IN_GRACE_PERIOD
        subscription.status = 'GRACE_PERIOD';
        subscription.gracePeriodExpiryTime = new Date(parseInt(googlePlayData.expiryTimeMillis));
        break;
        
      case 7: // SUBSCRIPTION_RESTARTED
        subscription.status = 'ACTIVE';
        subscription.cancelReason = null;
        subscription.userCancellationTime = null;
        break;
        
      case 8: // SUBSCRIPTION_PRICE_CHANGE_CONFIRMED
        subscription.priceAmountMicros = googlePlayData.priceAmountMicros;
        break;
        
      case 9: // SUBSCRIPTION_DEFERRED
        subscription.status = 'PENDING';
        break;
        
      case 10: // SUBSCRIPTION_PAUSED
        subscription.status = 'PAUSED';
        break;
        
      case 11: // SUBSCRIPTION_PAUSE_SCHEDULE_CHANGED
        // Handle pause schedule changes
        break;
        
      case 12: // SUBSCRIPTION_REVOKED
        subscription.status = 'CANCELLED';
        subscription.cancelReason = 1; // System cancelled
        break;
        
      case 13: // SUBSCRIPTION_EXPIRED
        subscription.status = 'EXPIRED';
        subscription.autoRenewing = false;
        break;
        
      default:
        console.log(`Unknown notification type: ${notificationType}`);
        return;
    }

    // Update subscription data from Google Play
    subscription.purchaseState = googlePlayData.purchaseState;
    subscription.paymentState = googlePlayData.paymentState;
    subscription.webhookEventTime = new Date();

    await subscription.save();

    // Update user subscription status
    const user = await User.findById(subscription.userId);
    if (user) {
      user.subscriptionStatus = subscription.status;
      await user.save();
    }

    console.log(`Subscription updated: ${subscription.subscriptionId} - ${subscription.status}`);
  } catch (error) {
    console.error('Error handling subscription notification:', error);
  }
}

async function handleOneTimeProductNotification(notification) {
  const { 
    version, 
    notificationType, 
    purchaseToken, 
    sku 
  } = notification;

  console.log(`Processing one-time product notification: ${notificationType} for ${sku}`);

  try {
    // Find the purchase in our database
    const Purchase = require('../models/Purchase');
    const purchase = await Purchase.findOne({ 
      purchaseToken: purchaseToken,
      productId: sku 
    });

    if (!purchase) {
      console.log(`Purchase not found for token: ${purchaseToken}`);
      return;
    }

    // Update purchase based on notification type
    switch (notificationType) {
      case 1: // ONE_TIME_PRODUCT_PURCHASED
        purchase.status = 'VERIFIED';
        purchase.verificationTime = new Date();
        break;
        
      case 2: // ONE_TIME_PRODUCT_CANCELED
        purchase.status = 'REFUNDED';
        purchase.refundTime = new Date();
        break;
        
      default:
        console.log(`Unknown one-time product notification type: ${notificationType}`);
        return;
    }

    purchase.webhookEventTime = new Date();
    await purchase.save();

    console.log(`Purchase updated: ${purchase.productId} - ${purchase.status}`);
  } catch (error) {
    console.error('Error handling one-time product notification:', error);
  }
}

// Health check endpoint for webhooks
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Webhook endpoint is healthy',
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
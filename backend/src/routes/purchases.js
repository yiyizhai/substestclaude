const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const GooglePlayService = require('../services/googlePlayService');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const Purchase = require('../models/Purchase');

const router = express.Router();
const googlePlayService = new GooglePlayService();

// Verify purchase
router.post('/verify', authenticateToken, [
  body('purchaseToken').notEmpty(),
  body('productId').notEmpty(),
  body('packageName').notEmpty(),
  body('userId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { purchaseToken, productId, packageName, subscriptionId, userId } = req.body;

    // Verify that the requesting user matches the purchase user
    if (req.user._id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Unauthorized to verify this purchase'
      });
    }

    // Check if purchase already exists
    const existingPurchase = await Purchase.findOne({ purchaseToken });
    const existingSubscription = await Subscription.findOne({ purchaseToken });

    if (existingPurchase && existingPurchase.status === 'VERIFIED') {
      return res.json({
        success: true,
        message: 'Purchase already verified',
        valid: true,
        subscription_status: existingPurchase.status,
        expires_at: null,
        auto_renewing: false
      });
    }

    if (existingSubscription && existingSubscription.status === 'ACTIVE') {
      return res.json({
        success: true,
        message: 'Subscription already verified',
        valid: true,
        subscription_status: existingSubscription.status,
        expires_at: existingSubscription.expiryTime,
        auto_renewing: existingSubscription.autoRenewing
      });
    }

    // Verify with Google Play
    const verificationResult = await googlePlayService.verifyPurchase(
      purchaseToken,
      productId,
      subscriptionId
    );

    const isValid = verificationResult.purchaseState === GooglePlayService.PURCHASE_STATE.PURCHASED;

    if (subscriptionId) {
      // Handle subscription
      const subscriptionData = {
        userId: userId,
        productId: productId,
        subscriptionId: subscriptionId,
        purchaseToken: purchaseToken,
        orderId: verificationResult.orderId,
        packageName: packageName,
        purchaseTime: new Date(parseInt(verificationResult.purchaseTimeMillis)),
        startTime: new Date(parseInt(verificationResult.startTimeMillis)),
        expiryTime: new Date(parseInt(verificationResult.expiryTimeMillis)),
        autoRenewing: verificationResult.autoRenewing,
        status: isValid ? 'ACTIVE' : 'PENDING',
        purchaseState: verificationResult.purchaseState,
        paymentState: verificationResult.paymentState,
        priceAmountMicros: verificationResult.priceAmountMicros,
        priceCurrencyCode: verificationResult.priceCurrencyCode,
        countryCode: verificationResult.countryCode,
        developerPayload: verificationResult.developerPayload,
        acknowledgementState: verificationResult.acknowledgementState,
        cancelReason: verificationResult.cancelReason,
        userCancellationTime: verificationResult.userCancellationTimeMillis ? 
          new Date(parseInt(verificationResult.userCancellationTimeMillis)) : null,
        purchaseType: 'SUBSCRIPTION'
      };

      // Check if it's a trial period
      if (verificationResult.paymentState === GooglePlayService.PAYMENT_STATE.FREE_TRIAL) {
        subscriptionData.isTrialPeriod = true;
        subscriptionData.trialExpiryTime = new Date(parseInt(verificationResult.expiryTimeMillis));
      }

      let subscription;
      if (existingSubscription) {
        // Update existing subscription
        Object.assign(existingSubscription, subscriptionData);
        subscription = await existingSubscription.save();
      } else {
        // Create new subscription
        subscription = new Subscription(subscriptionData);
        await subscription.save();
      }

      // Update user subscription status
      const user = await User.findById(userId);
      if (user) {
        user.subscriptionStatus = isValid ? 'ACTIVE' : 'PENDING';
        user.currentSubscription = subscription._id;
        await user.save();
      }

      // Acknowledge the subscription if valid
      if (isValid && verificationResult.acknowledgementState === 0) {
        try {
          await googlePlayService.acknowledgeSubscription(subscriptionId, purchaseToken);
        } catch (ackError) {
          console.error('Failed to acknowledge subscription:', ackError);
        }
      }

      return res.json({
        success: true,
        message: isValid ? 'Subscription verified successfully' : 'Subscription verification failed',
        valid: isValid,
        subscription_status: subscription.status,
        expires_at: subscription.expiryTime,
        auto_renewing: subscription.autoRenewing
      });
    } else {
      // Handle in-app purchase
      const purchaseData = {
        userId: userId,
        productId: productId,
        purchaseToken: purchaseToken,
        orderId: verificationResult.orderId,
        packageName: packageName,
        purchaseTime: new Date(parseInt(verificationResult.purchaseTimeMillis)),
        purchaseState: verificationResult.purchaseState,
        consumptionState: verificationResult.consumptionState,
        developerPayload: verificationResult.developerPayload,
        acknowledgementState: verificationResult.acknowledgementState,
        status: isValid ? 'VERIFIED' : 'INVALID',
        purchaseType: 'INAPP'
      };

      let purchase;
      if (existingPurchase) {
        // Update existing purchase
        Object.assign(existingPurchase, purchaseData);
        purchase = await existingPurchase.save();
      } else {
        // Create new purchase
        purchase = new Purchase(purchaseData);
        await purchase.save();
      }

      // Acknowledge the purchase if valid
      if (isValid && verificationResult.acknowledgementState === 0) {
        try {
          await googlePlayService.acknowledgeProduct(productId, purchaseToken);
        } catch (ackError) {
          console.error('Failed to acknowledge product:', ackError);
        }
      }

      return res.json({
        success: true,
        message: isValid ? 'Purchase verified successfully' : 'Purchase verification failed',
        valid: isValid,
        subscription_status: null,
        expires_at: null,
        auto_renewing: false
      });
    }
  } catch (error) {
    console.error('Purchase verification error:', error);
    
    // Return error but don't reveal internal details
    res.status(500).json({
      success: false,
      message: 'Purchase verification failed',
      valid: false,
      subscription_status: null,
      expires_at: null,
      auto_renewing: false
    });
  }
});

// Get purchase history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const purchases = await Purchase.find({ userId })
      .sort({ purchaseTime: -1 })
      .skip(skip)
      .limit(limit);

    const subscriptions = await Subscription.find({ userId })
      .sort({ purchaseTime: -1 })
      .skip(skip)
      .limit(limit);

    const totalPurchases = await Purchase.countDocuments({ userId });
    const totalSubscriptions = await Subscription.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        purchases: purchases.map(p => p.getPurchaseInfo()),
        subscriptions: subscriptions.map(s => s.getStatusInfo()),
        pagination: {
          page,
          limit,
          totalPurchases,
          totalSubscriptions,
          totalPages: Math.ceil((totalPurchases + totalSubscriptions) / limit)
        }
      }
    });
  } catch (error) {
    console.error('Purchase history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch purchase history'
    });
  }
});

module.exports = router;
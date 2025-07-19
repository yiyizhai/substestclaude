const express = require('express');
const { body, validationResult } = require('express-validator');
const { authenticateToken } = require('../middleware/auth');
const GooglePlayService = require('../services/googlePlayService');
const User = require('../models/User');
const Subscription = require('../models/Subscription');

const router = express.Router();
const googlePlayService = new GooglePlayService();

// Get user's current subscription status
router.get('/status', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find active subscription
    const subscription = await Subscription.findActiveForUser(userId);
    
    if (!subscription) {
      return res.json({
        success: true,
        message: 'No active subscription',
        subscription_status: 'NONE',
        product_id: null,
        expires_at: null,
        auto_renewing: false,
        in_grace_period: false,
        account_hold: false
      });
    }

    const statusInfo = subscription.getStatusInfo();
    
    res.json({
      success: true,
      message: 'Subscription status retrieved',
      subscription_status: statusInfo.status,
      product_id: statusInfo.productId,
      expires_at: statusInfo.expiryTime,
      auto_renewing: statusInfo.autoRenewing,
      in_grace_period: statusInfo.isInGracePeriod,
      account_hold: statusInfo.status === 'ACCOUNT_HOLD'
    });
  } catch (error) {
    console.error('Subscription status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription status'
    });
  }
});

// Create subscription product in Google Play Console
router.post('/create', authenticateToken, [
  body('productId').notEmpty(),
  body('subscriptionPeriod').notEmpty(),
  body('priceMicros').isInt({ min: 0 }),
  body('currency').isLength({ min: 3, max: 3 }),
  body('listings').isObject()
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

    // Only allow admin users to create subscriptions
    // TODO: Implement admin role check
    
    const subscriptionData = {
      productId: req.body.productId,
      subscriptionPeriod: req.body.subscriptionPeriod,
      trialPeriod: req.body.trialPeriod,
      gracePeriod: req.body.gracePeriod || 'P3D', // 3 days default
      priceMicros: req.body.priceMicros,
      currency: req.body.currency,
      listings: req.body.listings,
      defaultLanguage: req.body.defaultLanguage || 'en-US'
    };

    const result = await googlePlayService.createSubscription(subscriptionData);
    
    res.json({
      success: true,
      message: 'Subscription created successfully',
      data: result
    });
  } catch (error) {
    console.error('Subscription creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create subscription'
    });
  }
});

// Update subscription product
router.put('/update/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;

    // Only allow admin users to update subscriptions
    // TODO: Implement admin role check
    
    const result = await googlePlayService.updateSubscription(productId, updateData);
    
    res.json({
      success: true,
      message: 'Subscription updated successfully',
      data: result
    });
  } catch (error) {
    console.error('Subscription update error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update subscription'
    });
  }
});

// Get subscription product details
router.get('/product/:productId', authenticateToken, async (req, res) => {
  try {
    const { productId } = req.params;
    
    const subscription = await googlePlayService.getSubscription(productId);
    
    res.json({
      success: true,
      message: 'Subscription details retrieved',
      data: subscription
    });
  } catch (error) {
    console.error('Subscription details error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription details'
    });
  }
});

// List all subscription products
router.get('/products', authenticateToken, async (req, res) => {
  try {
    const subscriptions = await googlePlayService.listSubscriptions();
    
    res.json({
      success: true,
      message: 'Subscription products retrieved',
      data: subscriptions
    });
  } catch (error) {
    console.error('Subscription products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription products'
    });
  }
});

// Create in-app product
router.post('/inapp/create', authenticateToken, [
  body('sku').notEmpty(),
  body('priceMicros').isInt({ min: 0 }),
  body('currency').isLength({ min: 3, max: 3 }),
  body('listings').isObject()
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

    // Only allow admin users to create products
    // TODO: Implement admin role check
    
    const productData = {
      sku: req.body.sku,
      priceMicros: req.body.priceMicros,
      currency: req.body.currency,
      listings: req.body.listings,
      defaultLanguage: req.body.defaultLanguage || 'en-US'
    };

    const result = await googlePlayService.createInAppProduct(productData);
    
    res.json({
      success: true,
      message: 'In-app product created successfully',
      data: result
    });
  } catch (error) {
    console.error('In-app product creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create in-app product'
    });
  }
});

// List all in-app products
router.get('/inapp/products', authenticateToken, async (req, res) => {
  try {
    const products = await googlePlayService.listInAppProducts();
    
    res.json({
      success: true,
      message: 'In-app products retrieved',
      data: products
    });
  } catch (error) {
    console.error('In-app products error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve in-app products'
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    
    // Find active subscription
    const subscription = await Subscription.findActiveForUser(userId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'No active subscription found'
      });
    }

    // Update subscription status
    subscription.status = 'CANCELLED';
    subscription.userCancellationTime = new Date();
    subscription.autoRenewing = false;
    await subscription.save();

    // Update user status
    const user = await User.findById(userId);
    if (user) {
      user.subscriptionStatus = 'CANCELLED';
      await user.save();
    }

    res.json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Subscription cancellation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to cancel subscription'
    });
  }
});

// Get subscription history
router.get('/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const subscriptions = await Subscription.find({ userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Subscription.countDocuments({ userId });

    res.json({
      success: true,
      data: {
        subscriptions: subscriptions.map(s => s.getStatusInfo()),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Subscription history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve subscription history'
    });
  }
});

module.exports = router;
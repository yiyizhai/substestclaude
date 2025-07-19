const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
    type: String,
    required: true
  },
  subscriptionId: {
    type: String,
    required: true
  },
  purchaseToken: {
    type: String,
    required: true,
    unique: true
  },
  orderId: {
    type: String,
    required: true
  },
  packageName: {
    type: String,
    required: true
  },
  purchaseTime: {
    type: Date,
    required: true
  },
  startTime: {
    type: Date,
    required: true
  },
  expiryTime: {
    type: Date,
    required: true
  },
  autoRenewing: {
    type: Boolean,
    default: true
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'GRACE_PERIOD', 'ACCOUNT_HOLD', 'PAUSED'],
    default: 'ACTIVE'
  },
  purchaseState: {
    type: Number,
    enum: [0, 1, 2], // 0: Purchased, 1: Cancelled, 2: Pending
    default: 0
  },
  paymentState: {
    type: Number,
    enum: [0, 1, 2, 3], // 0: Pending, 1: Received, 2: Free trial, 3: Pending deferred upgrade
    default: 1
  },
  cancelReason: {
    type: Number,
    enum: [0, 1, 2, 3], // 0: User cancelled, 1: System cancelled, 2: Replaced, 3: Developer cancelled
    sparse: true
  },
  userCancellationTime: {
    type: Date,
    sparse: true
  },
  priceAmountMicros: {
    type: Number,
    required: true
  },
  priceCurrencyCode: {
    type: String,
    required: true,
    default: 'USD'
  },
  countryCode: {
    type: String,
    required: true
  },
  developerPayload: {
    type: String,
    sparse: true
  },
  acknowledgementState: {
    type: Number,
    enum: [0, 1], // 0: Yet to be acknowledged, 1: Acknowledged
    default: 0
  },
  isTrialPeriod: {
    type: Boolean,
    default: false
  },
  trialExpiryTime: {
    type: Date,
    sparse: true
  },
  gracePeriodExpiryTime: {
    type: Date,
    sparse: true
  },
  linkedPurchaseToken: {
    type: String,
    sparse: true
  },
  purchaseType: {
    type: String,
    enum: ['SUBSCRIPTION', 'INAPP'],
    default: 'SUBSCRIPTION'
  },
  webhookEventTime: {
    type: Date,
    sparse: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for better query performance
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ purchaseToken: 1 });
subscriptionSchema.index({ orderId: 1 });
subscriptionSchema.index({ expiryTime: 1 });
subscriptionSchema.index({ productId: 1 });

// Check if subscription is active
subscriptionSchema.methods.isActive = function() {
  const now = new Date();
  return this.status === 'ACTIVE' && 
         this.expiryTime > now && 
         this.purchaseState === 0;
};

// Check if subscription is in grace period
subscriptionSchema.methods.isInGracePeriod = function() {
  const now = new Date();
  return this.status === 'GRACE_PERIOD' && 
         this.gracePeriodExpiryTime && 
         this.gracePeriodExpiryTime > now;
};

// Check if subscription is expired
subscriptionSchema.methods.isExpired = function() {
  const now = new Date();
  return this.expiryTime <= now && !this.isInGracePeriod();
};

// Check if subscription is in trial period
subscriptionSchema.methods.isInTrialPeriod = function() {
  const now = new Date();
  return this.isTrialPeriod && 
         this.trialExpiryTime && 
         this.trialExpiryTime > now;
};

// Get subscription status for API response
subscriptionSchema.methods.getStatusInfo = function() {
  const now = new Date();
  
  return {
    subscriptionId: this.subscriptionId,
    productId: this.productId,
    status: this.status,
    isActive: this.isActive(),
    isExpired: this.isExpired(),
    isInGracePeriod: this.isInGracePeriod(),
    isInTrialPeriod: this.isInTrialPeriod(),
    autoRenewing: this.autoRenewing,
    expiryTime: this.expiryTime,
    startTime: this.startTime,
    purchaseTime: this.purchaseTime,
    priceAmountMicros: this.priceAmountMicros,
    priceCurrencyCode: this.priceCurrencyCode,
    countryCode: this.countryCode,
    cancelReason: this.cancelReason,
    userCancellationTime: this.userCancellationTime,
    trialExpiryTime: this.trialExpiryTime,
    gracePeriodExpiryTime: this.gracePeriodExpiryTime
  };
};

// Static method to find active subscription for user
subscriptionSchema.statics.findActiveForUser = function(userId) {
  return this.findOne({
    userId: userId,
    status: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
    expiryTime: { $gt: new Date() }
  }).sort({ expiryTime: -1 });
};

// Static method to find expiring subscriptions
subscriptionSchema.statics.findExpiringSoon = function(hoursAhead = 24) {
  const expiryThreshold = new Date();
  expiryThreshold.setHours(expiryThreshold.getHours() + hoursAhead);
  
  return this.find({
    status: 'ACTIVE',
    autoRenewing: true,
    expiryTime: { 
      $gt: new Date(), 
      $lt: expiryThreshold 
    }
  });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);
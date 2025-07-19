const mongoose = require('mongoose');

const purchaseSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  productId: {
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
  purchaseState: {
    type: Number,
    enum: [0, 1, 2], // 0: Purchased, 1: Cancelled, 2: Pending
    default: 0
  },
  consumptionState: {
    type: Number,
    enum: [0, 1], // 0: Yet to be consumed, 1: Consumed
    default: 0
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
  purchaseType: {
    type: String,
    enum: ['SUBSCRIPTION', 'INAPP'],
    default: 'INAPP'
  },
  priceAmountMicros: {
    type: Number,
    sparse: true
  },
  priceCurrencyCode: {
    type: String,
    sparse: true
  },
  countryCode: {
    type: String,
    sparse: true
  },
  status: {
    type: String,
    enum: ['PENDING', 'VERIFIED', 'INVALID', 'REFUNDED', 'EXPIRED'],
    default: 'PENDING'
  },
  verificationTime: {
    type: Date,
    sparse: true
  },
  refundTime: {
    type: Date,
    sparse: true
  },
  isConsumed: {
    type: Boolean,
    default: false
  },
  consumedTime: {
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
purchaseSchema.index({ userId: 1, status: 1 });
purchaseSchema.index({ purchaseToken: 1 });
purchaseSchema.index({ orderId: 1 });
purchaseSchema.index({ productId: 1 });
purchaseSchema.index({ purchaseTime: 1 });

// Check if purchase is valid
purchaseSchema.methods.isValid = function() {
  return this.status === 'VERIFIED' && 
         this.purchaseState === 0 && 
         this.acknowledgementState === 1;
};

// Check if purchase is pending
purchaseSchema.methods.isPending = function() {
  return this.status === 'PENDING' || this.purchaseState === 2;
};

// Mark purchase as consumed
purchaseSchema.methods.consume = function() {
  this.isConsumed = true;
  this.consumedTime = new Date();
  this.consumptionState = 1;
  return this.save();
};

// Mark purchase as verified
purchaseSchema.methods.verify = function() {
  this.status = 'VERIFIED';
  this.verificationTime = new Date();
  this.acknowledgementState = 1;
  return this.save();
};

// Mark purchase as refunded
purchaseSchema.methods.refund = function() {
  this.status = 'REFUNDED';
  this.refundTime = new Date();
  return this.save();
};

// Get purchase info for API response
purchaseSchema.methods.getPurchaseInfo = function() {
  return {
    id: this._id,
    productId: this.productId,
    orderId: this.orderId,
    purchaseTime: this.purchaseTime,
    status: this.status,
    isValid: this.isValid(),
    isPending: this.isPending(),
    isConsumed: this.isConsumed,
    purchaseType: this.purchaseType,
    priceAmountMicros: this.priceAmountMicros,
    priceCurrencyCode: this.priceCurrencyCode,
    countryCode: this.countryCode,
    verificationTime: this.verificationTime,
    consumedTime: this.consumedTime,
    refundTime: this.refundTime
  };
};

// Static method to find purchases by user
purchaseSchema.statics.findByUser = function(userId, status = null) {
  const query = { userId: userId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ purchaseTime: -1 });
};

// Static method to find purchases by product
purchaseSchema.statics.findByProduct = function(productId, status = null) {
  const query = { productId: productId };
  if (status) {
    query.status = status;
  }
  return this.find(query).sort({ purchaseTime: -1 });
};

// Static method to find unverified purchases
purchaseSchema.statics.findUnverified = function() {
  return this.find({
    status: 'PENDING',
    createdAt: { $gt: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Last 24 hours
  }).sort({ createdAt: -1 });
};

module.exports = mongoose.model('Purchase', purchaseSchema);
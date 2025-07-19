const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  googlePlayUserId: {
    type: String,
    sparse: true
  },
  subscriptionStatus: {
    type: String,
    enum: ['ACTIVE', 'EXPIRED', 'CANCELLED', 'PENDING', 'GRACE_PERIOD', 'ACCOUNT_HOLD', 'PAUSED', 'NONE'],
    default: 'NONE'
  },
  currentSubscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subscription'
  },
  subscriptionHistory: [{
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Subscription'
    },
    startDate: Date,
    endDate: Date,
    status: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastLoginAt: {
    type: Date
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Update last login
userSchema.methods.updateLastLogin = function() {
  this.lastLoginAt = new Date();
  return this.save();
};

// Check if user has active subscription
userSchema.methods.hasActiveSubscription = function() {
  return this.subscriptionStatus === 'ACTIVE' || this.subscriptionStatus === 'GRACE_PERIOD';
};

// Get user data for JWT token
userSchema.methods.toTokenData = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    subscriptionStatus: this.subscriptionStatus
  };
};

// Get public user data
userSchema.methods.toPublicData = function() {
  return {
    id: this._id,
    email: this.email,
    name: this.name,
    subscriptionStatus: this.subscriptionStatus,
    createdAt: this.createdAt,
    lastLoginAt: this.lastLoginAt
  };
};

module.exports = mongoose.model('User', userSchema);
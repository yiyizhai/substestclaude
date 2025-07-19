const cron = require('node-cron');
const User = require('../models/User');
const Subscription = require('../models/Subscription');
const GooglePlayService = require('./googlePlayService');

class SubscriptionService {
  constructor() {
    this.googlePlayService = new GooglePlayService();
    this.initializeCronJobs();
  }

  initializeCronJobs() {
    // Check subscription statuses every hour
    cron.schedule('0 * * * *', async () => {
      console.log('Running subscription status check...');
      await this.checkSubscriptionStatuses();
    });

    // Check for expired subscriptions every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log('Running expired subscription check...');
      await this.checkExpiredSubscriptions();
    });

    // Sync with Google Play every 6 hours for active subscriptions
    cron.schedule('0 */6 * * *', async () => {
      console.log('Running Google Play sync...');
      await this.syncWithGooglePlay();
    });

    console.log('Subscription service cron jobs initialized');
  }

  async checkSubscriptionStatuses() {
    try {
      // Find all active subscriptions
      const activeSubscriptions = await Subscription.find({
        status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'ACCOUNT_HOLD'] }
      });

      console.log(`Checking ${activeSubscriptions.length} active subscriptions`);

      for (const subscription of activeSubscriptions) {
        await this.updateSubscriptionStatus(subscription);
      }
    } catch (error) {
      console.error('Error checking subscription statuses:', error);
    }
  }

  async checkExpiredSubscriptions() {
    try {
      const now = new Date();
      
      // Find subscriptions that have expired
      const expiredSubscriptions = await Subscription.find({
        status: { $in: ['ACTIVE', 'GRACE_PERIOD'] },
        expiryTime: { $lt: now }
      });

      console.log(`Found ${expiredSubscriptions.length} expired subscriptions`);

      for (const subscription of expiredSubscriptions) {
        // Check if still in grace period
        if (subscription.gracePeriodExpiryTime && subscription.gracePeriodExpiryTime > now) {
          subscription.status = 'GRACE_PERIOD';
        } else {
          subscription.status = 'EXPIRED';
          subscription.autoRenewing = false;
        }

        await subscription.save();

        // Update user status
        const user = await User.findById(subscription.userId);
        if (user) {
          user.subscriptionStatus = subscription.status;
          await user.save();
        }

        console.log(`Subscription ${subscription.subscriptionId} marked as ${subscription.status}`);
      }
    } catch (error) {
      console.error('Error checking expired subscriptions:', error);
    }
  }

  async syncWithGooglePlay() {
    try {
      // Find all active subscriptions that haven't been synced recently
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const subscriptionsToSync = await Subscription.find({
        status: { $in: ['ACTIVE', 'GRACE_PERIOD', 'ACCOUNT_HOLD', 'PAUSED'] },
        $or: [
          { webhookEventTime: { $lt: oneHourAgo } },
          { webhookEventTime: { $exists: false } }
        ]
      }).limit(50); // Limit to avoid API rate limits

      console.log(`Syncing ${subscriptionsToSync.length} subscriptions with Google Play`);

      for (const subscription of subscriptionsToSync) {
        try {
          await this.syncSubscriptionWithGooglePlay(subscription);
          
          // Add delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
          console.error(`Error syncing subscription ${subscription.subscriptionId}:`, error);
        }
      }
    } catch (error) {
      console.error('Error syncing with Google Play:', error);
    }
  }

  async updateSubscriptionStatus(subscription) {
    try {
      const now = new Date();
      
      // Check if subscription has expired
      if (subscription.expiryTime <= now) {
        // Check if still in grace period
        if (subscription.gracePeriodExpiryTime && subscription.gracePeriodExpiryTime > now) {
          if (subscription.status !== 'GRACE_PERIOD') {
            subscription.status = 'GRACE_PERIOD';
            await subscription.save();
          }
        } else {
          // Subscription has fully expired
          subscription.status = 'EXPIRED';
          subscription.autoRenewing = false;
          await subscription.save();

          // Update user status
          await this.updateUserSubscriptionStatus(subscription.userId, 'EXPIRED');
        }
      }

      // Check if trial period has ended
      if (subscription.isTrialPeriod && subscription.trialExpiryTime && subscription.trialExpiryTime <= now) {
        subscription.isTrialPeriod = false;
        await subscription.save();
      }
    } catch (error) {
      console.error(`Error updating subscription ${subscription.subscriptionId}:`, error);
    }
  }

  async syncSubscriptionWithGooglePlay(subscription) {
    try {
      const googlePlayData = await this.googlePlayService.verifyPurchase(
        subscription.purchaseToken,
        subscription.productId,
        subscription.subscriptionId
      );

      let statusChanged = false;

      // Update subscription data from Google Play
      if (googlePlayData.expiryTimeMillis) {
        const newExpiryTime = new Date(parseInt(googlePlayData.expiryTimeMillis));
        if (newExpiryTime.getTime() !== subscription.expiryTime.getTime()) {
          subscription.expiryTime = newExpiryTime;
          statusChanged = true;
        }
      }

      if (googlePlayData.autoRenewing !== subscription.autoRenewing) {
        subscription.autoRenewing = googlePlayData.autoRenewing;
        statusChanged = true;
      }

      if (googlePlayData.purchaseState !== subscription.purchaseState) {
        subscription.purchaseState = googlePlayData.purchaseState;
        statusChanged = true;

        // Update status based on purchase state
        if (googlePlayData.purchaseState === GooglePlayService.PURCHASE_STATE.PURCHASED) {
          subscription.status = 'ACTIVE';
        } else if (googlePlayData.purchaseState === GooglePlayService.PURCHASE_STATE.CANCELLED) {
          subscription.status = 'CANCELLED';
        } else if (googlePlayData.purchaseState === GooglePlayService.PURCHASE_STATE.PENDING) {
          subscription.status = 'PENDING';
        }
      }

      if (googlePlayData.paymentState !== subscription.paymentState) {
        subscription.paymentState = googlePlayData.paymentState;
        statusChanged = true;
      }

      if (googlePlayData.cancelReason && googlePlayData.cancelReason !== subscription.cancelReason) {
        subscription.cancelReason = googlePlayData.cancelReason;
        subscription.status = 'CANCELLED';
        statusChanged = true;
      }

      if (statusChanged) {
        subscription.webhookEventTime = new Date();
        await subscription.save();

        // Update user status
        await this.updateUserSubscriptionStatus(subscription.userId, subscription.status);

        console.log(`Subscription ${subscription.subscriptionId} synced and updated to ${subscription.status}`);
      }
    } catch (error) {
      console.error(`Error syncing subscription ${subscription.subscriptionId} with Google Play:`, error);
    }
  }

  async updateUserSubscriptionStatus(userId, status) {
    try {
      const user = await User.findById(userId);
      if (user && user.subscriptionStatus !== status) {
        user.subscriptionStatus = status;
        await user.save();
      }
    } catch (error) {
      console.error(`Error updating user ${userId} subscription status:`, error);
    }
  }

  async getSubscriptionAnalytics(startDate, endDate) {
    try {
      const pipeline = [
        {
          $match: {
            createdAt: {
              $gte: new Date(startDate),
              $lte: new Date(endDate)
            }
          }
        },
        {
          $group: {
            _id: {
              status: '$status',
              productId: '$productId'
            },
            count: { $sum: 1 },
            totalRevenue: { $sum: '$priceAmountMicros' },
            avgRevenue: { $avg: '$priceAmountMicros' }
          }
        },
        {
          $sort: { count: -1 }
        }
      ];

      const analytics = await Subscription.aggregate(pipeline);
      
      return {
        subscriptions: analytics,
        totalSubscriptions: analytics.reduce((sum, item) => sum + item.count, 0),
        totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0)
      };
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  }

  async getChurnRate(periodDays = 30) {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - periodDays * 24 * 60 * 60 * 1000);

      const totalSubscriptions = await Subscription.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate }
      });

      const cancelledSubscriptions = await Subscription.countDocuments({
        createdAt: { $gte: startDate, $lte: endDate },
        status: 'CANCELLED'
      });

      const churnRate = totalSubscriptions > 0 ? (cancelledSubscriptions / totalSubscriptions) * 100 : 0;

      return {
        period: periodDays,
        totalSubscriptions,
        cancelledSubscriptions,
        churnRate: Math.round(churnRate * 100) / 100
      };
    } catch (error) {
      console.error('Error calculating churn rate:', error);
      throw error;
    }
  }
}

module.exports = SubscriptionService;
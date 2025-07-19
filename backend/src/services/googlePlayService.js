const { google } = require('googleapis');
const path = require('path');

class GooglePlayService {
  constructor() {
    this.packageName = process.env.GOOGLE_PLAY_PACKAGE_NAME;
    this.androidpublisher = null;
    this.init();
  }

  async init() {
    try {
      // Initialize Google Auth with service account
      const auth = new google.auth.GoogleAuth({
        keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
        scopes: ['https://www.googleapis.com/auth/androidpublisher']
      });

      this.androidpublisher = google.androidpublisher({
        version: 'v3',
        auth: auth
      });

      console.log('Google Play Publisher API initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Google Play Publisher API:', error);
      throw error;
    }
  }

  async verifyPurchase(purchaseToken, productId, subscriptionId = null) {
    try {
      if (!this.androidpublisher) {
        throw new Error('Google Play Publisher API not initialized');
      }

      let purchaseData;
      
      if (subscriptionId) {
        // Verify subscription purchase
        const response = await this.androidpublisher.purchases.subscriptions.get({
          packageName: this.packageName,
          subscriptionId: subscriptionId,
          token: purchaseToken
        });
        
        purchaseData = response.data;
      } else {
        // Verify in-app purchase
        const response = await this.androidpublisher.purchases.products.get({
          packageName: this.packageName,
          productId: productId,
          token: purchaseToken
        });
        
        purchaseData = response.data;
      }

      return this.formatPurchaseData(purchaseData, subscriptionId !== null);
    } catch (error) {
      console.error('Purchase verification failed:', error);
      throw error;
    }
  }

  formatPurchaseData(purchaseData, isSubscription) {
    const baseData = {
      purchaseTimeMillis: purchaseData.purchaseTimeMillis,
      purchaseState: purchaseData.purchaseState,
      consumptionState: purchaseData.consumptionState,
      developerPayload: purchaseData.developerPayload,
      orderId: purchaseData.orderId,
      acknowledgementState: purchaseData.acknowledgementState
    };

    if (isSubscription) {
      return {
        ...baseData,
        expiryTimeMillis: purchaseData.expiryTimeMillis,
        autoRenewing: purchaseData.autoRenewing,
        startTimeMillis: purchaseData.startTimeMillis,
        priceAmountMicros: purchaseData.priceAmountMicros,
        priceCurrencyCode: purchaseData.priceCurrencyCode,
        paymentState: purchaseData.paymentState,
        cancelReason: purchaseData.cancelReason,
        userCancellationTimeMillis: purchaseData.userCancellationTimeMillis,
        cancelSurveyResult: purchaseData.cancelSurveyResult,
        countryCode: purchaseData.countryCode,
        priceChange: purchaseData.priceChange,
        profileName: purchaseData.profileName,
        emailAddress: purchaseData.emailAddress,
        givenName: purchaseData.givenName,
        familyName: purchaseData.familyName,
        profileId: purchaseData.profileId
      };
    }

    return baseData;
  }

  async createSubscription(subscriptionData) {
    try {
      const response = await this.androidpublisher.monetization.subscriptions.create({
        packageName: this.packageName,
        requestBody: {
          productId: subscriptionData.productId,
          packageName: this.packageName,
          subscriptionPeriod: subscriptionData.subscriptionPeriod,
          trialPeriod: subscriptionData.trialPeriod,
          gracePeriod: subscriptionData.gracePeriod,
          purchaseType: 'subscription',
          defaultPrice: {
            priceMicros: subscriptionData.priceMicros,
            currency: subscriptionData.currency
          },
          listings: subscriptionData.listings,
          defaultLanguage: subscriptionData.defaultLanguage || 'en-US'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create subscription:', error);
      throw error;
    }
  }

  async updateSubscription(subscriptionId, updateData) {
    try {
      const response = await this.androidpublisher.monetization.subscriptions.patch({
        packageName: this.packageName,
        productId: subscriptionId,
        requestBody: updateData
      });

      return response.data;
    } catch (error) {
      console.error('Failed to update subscription:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId) {
    try {
      const response = await this.androidpublisher.monetization.subscriptions.get({
        packageName: this.packageName,
        productId: subscriptionId
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get subscription:', error);
      throw error;
    }
  }

  async listSubscriptions() {
    try {
      const response = await this.androidpublisher.monetization.subscriptions.list({
        packageName: this.packageName
      });

      return response.data.subscriptions || [];
    } catch (error) {
      console.error('Failed to list subscriptions:', error);
      throw error;
    }
  }

  async createInAppProduct(productData) {
    try {
      const response = await this.androidpublisher.inappproducts.insert({
        packageName: this.packageName,
        requestBody: {
          sku: productData.sku,
          packageName: this.packageName,
          status: 'active',
          purchaseType: 'managedUser',
          defaultPrice: {
            priceMicros: productData.priceMicros,
            currency: productData.currency
          },
          listings: productData.listings,
          defaultLanguage: productData.defaultLanguage || 'en-US'
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to create in-app product:', error);
      throw error;
    }
  }

  async updateInAppProduct(sku, updateData) {
    try {
      const response = await this.androidpublisher.inappproducts.update({
        packageName: this.packageName,
        sku: sku,
        requestBody: updateData
      });

      return response.data;
    } catch (error) {
      console.error('Failed to update in-app product:', error);
      throw error;
    }
  }

  async getInAppProduct(sku) {
    try {
      const response = await this.androidpublisher.inappproducts.get({
        packageName: this.packageName,
        sku: sku
      });

      return response.data;
    } catch (error) {
      console.error('Failed to get in-app product:', error);
      throw error;
    }
  }

  async listInAppProducts() {
    try {
      const response = await this.androidpublisher.inappproducts.list({
        packageName: this.packageName
      });

      return response.data.inappproduct || [];
    } catch (error) {
      console.error('Failed to list in-app products:', error);
      throw error;
    }
  }

  async acknowledgeSubscription(subscriptionId, purchaseToken) {
    try {
      const response = await this.androidpublisher.purchases.subscriptions.acknowledge({
        packageName: this.packageName,
        subscriptionId: subscriptionId,
        token: purchaseToken,
        requestBody: {
          developerPayload: ''
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to acknowledge subscription:', error);
      throw error;
    }
  }

  async acknowledgeProduct(productId, purchaseToken) {
    try {
      const response = await this.androidpublisher.purchases.products.acknowledge({
        packageName: this.packageName,
        productId: productId,
        token: purchaseToken,
        requestBody: {
          developerPayload: ''
        }
      });

      return response.data;
    } catch (error) {
      console.error('Failed to acknowledge product:', error);
      throw error;
    }
  }

  // Purchase states
  static PURCHASE_STATE = {
    PURCHASED: 0,
    CANCELLED: 1,
    PENDING: 2
  };

  // Subscription payment states
  static PAYMENT_STATE = {
    PAYMENT_PENDING: 0,
    PAYMENT_RECEIVED: 1,
    FREE_TRIAL: 2,
    PENDING_DEFERRED_UPGRADE: 3
  };

  // Subscription cancel reasons
  static CANCEL_REASON = {
    USER_CANCELLED: 0,
    SYSTEM_CANCELLED: 1,
    REPLACED: 2,
    DEVELOPER_CANCELLED: 3
  };
}

module.exports = GooglePlayService;
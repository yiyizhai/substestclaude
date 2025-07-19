package com.example.subscriptionapp

import android.app.Activity
import android.content.Context
import android.util.Log
import com.android.billingclient.api.*
import com.example.subscriptionapp.repository.ApiResult
import com.example.subscriptionapp.repository.SubscriptionRepository
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class BillingManager(
    private val context: Context,
    private val listener: BillingListener
) : PurchasesUpdatedListener, BillingClientStateListener {

    interface BillingListener {
        fun onBillingSetupFinished(isSuccess: Boolean)
        fun onPurchaseSuccess(purchase: Purchase)
        fun onPurchaseFailure(billingResult: BillingResult)
        fun onPurchaseVerified(purchase: Purchase, isValid: Boolean)
    }

    private var billingClient: BillingClient = BillingClient.newBuilder(context)
        .setListener(this)
        .enablePendingPurchases()
        .build()

    private var isServiceConnected = false
    private val repository = SubscriptionRepository(context)

    companion object {
        private const val TAG = "BillingManager"
        
        // Product IDs - these need to be configured in Google Play Console
        const val MONTHLY_SUBSCRIPTION_ID = "monthly_subscription_1099"
        const val PREPAID_PLAN_ID = "prepaid_plan_2000"
        
        // Base plan and offer IDs for subscription
        const val MONTHLY_BASE_PLAN_ID = "monthly-base-plan"
        const val FREE_TRIAL_OFFER_ID = "free-trial-offer"
    }

    fun startConnection() {
        if (!billingClient.isReady) {
            Log.d(TAG, "Starting billing client connection...")
            billingClient.startConnection(this)
        }
    }

    override fun onBillingSetupFinished(billingResult: BillingResult) {
        Log.d(TAG, "Billing setup finished. Response code: ${billingResult.responseCode}")
        
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
            isServiceConnected = true
            Log.d(TAG, "Billing client connected successfully")
            listener.onBillingSetupFinished(true)
        } else {
            Log.w(TAG, "Billing setup failed: ${billingResult.debugMessage}")
            listener.onBillingSetupFinished(false)
        }
    }

    override fun onBillingServiceDisconnected() {
        Log.d(TAG, "Billing service disconnected")
        isServiceConnected = false
    }

    override fun onPurchasesUpdated(billingResult: BillingResult, purchases: MutableList<Purchase>?) {
        Log.d(TAG, "Purchases updated. Response code: ${billingResult.responseCode}")
        
        if (billingResult.responseCode == BillingClient.BillingResponseCode.OK && purchases != null) {
            for (purchase in purchases) {
                Log.d(TAG, "Purchase successful: ${purchase.products}")
                handlePurchase(purchase)
            }
        } else {
            Log.w(TAG, "Purchase failed: ${billingResult.debugMessage}")
            listener.onPurchaseFailure(billingResult)
        }
    }

    private fun handlePurchase(purchase: Purchase) {
        Log.d(TAG, "Handling purchase: ${purchase.products}")
        
        if (purchase.purchaseState == Purchase.PurchaseState.PURCHASED) {
            // Verify the purchase with backend API
            verifyPurchaseWithBackend(purchase)
        } else if (purchase.purchaseState == Purchase.PurchaseState.PENDING) {
            Log.d(TAG, "Purchase is pending")
        }
    }
    
    private fun verifyPurchaseWithBackend(purchase: Purchase) {
        CoroutineScope(Dispatchers.IO).launch {
            try {
                val productId = purchase.products.firstOrNull() ?: ""
                val subscriptionId = if (productId == MONTHLY_SUBSCRIPTION_ID) productId else null
                
                val result = repository.verifyPurchase(
                    purchaseToken = purchase.purchaseToken,
                    productId = productId,
                    packageName = purchase.packageName,
                    subscriptionId = subscriptionId
                )
                
                withContext(Dispatchers.Main) {
                    when (result) {
                        is ApiResult.Success -> {
                            Log.d(TAG, "Purchase verification successful: ${result.data.valid}")
                            
                            if (result.data.valid) {
                                // Purchase is valid, acknowledge it
                                if (!purchase.isAcknowledged) {
                                    acknowledgePurchase(purchase)
                                }
                                
                                listener.onPurchaseSuccess(purchase)
                                listener.onPurchaseVerified(purchase, true)
                            } else {
                                Log.w(TAG, "Purchase verification failed: ${result.data.message}")
                                listener.onPurchaseVerified(purchase, false)
                            }
                        }
                        is ApiResult.Error -> {
                            Log.e(TAG, "Purchase verification error: ${result.message}")
                            // In case of network error, still acknowledge the purchase
                            // but notify the listener about the verification failure
                            if (!purchase.isAcknowledged) {
                                acknowledgePurchase(purchase)
                            }
                            listener.onPurchaseSuccess(purchase)
                            listener.onPurchaseVerified(purchase, false)
                        }
                    }
                }
            } catch (e: Exception) {
                Log.e(TAG, "Purchase verification exception", e)
                withContext(Dispatchers.Main) {
                    // In case of exception, still acknowledge the purchase
                    if (!purchase.isAcknowledged) {
                        acknowledgePurchase(purchase)
                    }
                    listener.onPurchaseSuccess(purchase)
                    listener.onPurchaseVerified(purchase, false)
                }
            }
        }
    }

    private fun acknowledgePurchase(purchase: Purchase) {
        val acknowledgePurchaseParams = AcknowledgePurchaseParams.newBuilder()
            .setPurchaseToken(purchase.purchaseToken)
            .build()
        
        billingClient.acknowledgePurchase(acknowledgePurchaseParams) { billingResult ->
            Log.d(TAG, "Acknowledge purchase result: ${billingResult.responseCode}")
        }
    }

    fun queryProductDetails(callback: (List<ProductDetails>) -> Unit) {
        if (!isServiceConnected) {
            Log.w(TAG, "Billing client not connected")
            return
        }

        val subscriptionProductList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(MONTHLY_SUBSCRIPTION_ID)
                .setProductType(BillingClient.ProductType.SUBS)
                .build()
        )

        val inAppProductList = listOf(
            QueryProductDetailsParams.Product.newBuilder()
                .setProductId(PREPAID_PLAN_ID)
                .setProductType(BillingClient.ProductType.INAPP)
                .build()
        )

        // Query subscription products
        val subscriptionParams = QueryProductDetailsParams.newBuilder()
            .setProductList(subscriptionProductList)
            .build()

        billingClient.queryProductDetailsAsync(subscriptionParams) { billingResult, productDetailsList ->
            if (billingResult.responseCode == BillingClient.BillingResponseCode.OK) {
                Log.d(TAG, "Subscription products queried successfully: ${productDetailsList.size}")
                
                // Query in-app products
                val inAppParams = QueryProductDetailsParams.newBuilder()
                    .setProductList(inAppProductList)
                    .build()
                
                billingClient.queryProductDetailsAsync(inAppParams) { billingResult2, inAppProductDetailsList ->
                    if (billingResult2.responseCode == BillingClient.BillingResponseCode.OK) {
                        Log.d(TAG, "In-app products queried successfully: ${inAppProductDetailsList.size}")
                        val allProducts = productDetailsList + inAppProductDetailsList
                        callback(allProducts)
                    } else {
                        Log.w(TAG, "Failed to query in-app products: ${billingResult2.debugMessage}")
                        callback(productDetailsList)
                    }
                }
            } else {
                Log.w(TAG, "Failed to query subscription products: ${billingResult.debugMessage}")
                callback(emptyList())
            }
        }
    }

    fun launchBillingFlow(activity: Activity, productDetails: ProductDetails) {
        if (!isServiceConnected) {
            Log.w(TAG, "Billing client not connected")
            return
        }

        val productDetailsParamsList = if (productDetails.productType == BillingClient.ProductType.SUBS) {
            // For subscriptions, we need to specify the base plan and offer
            val subscriptionUpdateParams = productDetails.subscriptionOfferDetails?.let { offerDetails ->
                if (offerDetails.isNotEmpty()) {
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .setOfferToken(offerDetails[0].offerToken)
                        .build()
                } else {
                    BillingFlowParams.ProductDetailsParams.newBuilder()
                        .setProductDetails(productDetails)
                        .build()
                }
            } ?: BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(productDetails)
                .build()
            
            listOf(subscriptionUpdateParams)
        } else {
            // For in-app purchases
            listOf(
                BillingFlowParams.ProductDetailsParams.newBuilder()
                    .setProductDetails(productDetails)
                    .build()
            )
        }

        val billingFlowParams = BillingFlowParams.newBuilder()
            .setProductDetailsParamsList(productDetailsParamsList)
            .build()

        val billingResult = billingClient.launchBillingFlow(activity, billingFlowParams)
        Log.d(TAG, "Billing flow launched. Response code: ${billingResult.responseCode}")
    }

    fun endConnection() {
        if (billingClient.isReady) {
            billingClient.endConnection()
        }
    }
}
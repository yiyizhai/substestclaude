package com.example.subscriptionapp

import android.content.Intent
import android.os.Bundle
import android.util.Log
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.android.billingclient.api.BillingResult
import com.android.billingclient.api.ProductDetails
import com.android.billingclient.api.Purchase
import com.example.subscriptionapp.databinding.ActivityMainBinding
import com.example.subscriptionapp.repository.ApiResult
import com.example.subscriptionapp.repository.SubscriptionRepository
import kotlinx.coroutines.launch

class MainActivity : AppCompatActivity(), BillingManager.BillingListener {

    private lateinit var binding: ActivityMainBinding
    private lateinit var billingManager: BillingManager
    private lateinit var repository: SubscriptionRepository
    private var availableProducts: List<ProductDetails> = emptyList()

    companion object {
        private const val TAG = "MainActivity"
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        repository = SubscriptionRepository(this)
        
        // Check if user is logged in
        if (!repository.isLoggedIn()) {
            navigateToAuth()
            return
        }

        setupBilling()
        setupUI()
        loadUserSubscriptionStatus()
    }

    private fun setupBilling() {
        billingManager = BillingManager(this, this)
        billingManager.startConnection()
    }

    private fun setupUI() {
        binding.subscriptionButton.setOnClickListener {
            if (availableProducts.isNotEmpty()) {
                showProductSelection()
            } else {
                updateStatus("Loading products...")
                billingManager.queryProductDetails { products ->
                    runOnUiThread {
                        availableProducts = products
                        if (products.isNotEmpty()) {
                            showProductSelection()
                        } else {
                            updateStatus("No products available")
                        }
                    }
                }
            }
        }
    }

    private fun showProductSelection() {
        val subscriptionProduct = availableProducts.find { 
            it.productId == BillingManager.MONTHLY_SUBSCRIPTION_ID 
        }
        val prepaidProduct = availableProducts.find { 
            it.productId == BillingManager.PREPAID_PLAN_ID 
        }

        val options = mutableListOf<String>()
        val products = mutableListOf<ProductDetails>()

        subscriptionProduct?.let { product ->
            val subscriptionOfferDetails = product.subscriptionOfferDetails
            if (subscriptionOfferDetails != null && subscriptionOfferDetails.isNotEmpty()) {
                val offer = subscriptionOfferDetails[0]
                val pricingPhase = offer.pricingPhases.pricingPhaseList.lastOrNull()
                val price = pricingPhase?.formattedPrice ?: "Price unavailable"
                options.add("Monthly Subscription: $price (1-week free trial)")
                products.add(product)
            }
        }

        prepaidProduct?.let { product ->
            val oneTimePurchaseOffer = product.oneTimePurchaseOfferDetails
            val price = oneTimePurchaseOffer?.formattedPrice ?: "Price unavailable"
            options.add("Prepaid Plan: $price")
            products.add(product)
        }

        if (options.isNotEmpty()) {
            showSelectionDialog(options.toTypedArray(), products)
        } else {
            updateStatus("No products configured")
        }
    }

    private fun showSelectionDialog(options: Array<String>, products: List<ProductDetails>) {
        val builder = androidx.appcompat.app.AlertDialog.Builder(this)
        builder.setTitle("Choose a subscription plan")
        builder.setItems(options) { _, which ->
            if (which < products.size) {
                val selectedProduct = products[which]
                Log.d(TAG, "Selected product: ${selectedProduct.productId}")
                billingManager.launchBillingFlow(this, selectedProduct)
            }
        }
        builder.setNegativeButton("Cancel", null)
        builder.show()
    }

    private fun updateStatus(message: String) {
        binding.statusText.text = message
        Log.d(TAG, "Status: $message")
    }

    override fun onBillingSetupFinished(isSuccess: Boolean) {
        runOnUiThread {
            if (isSuccess) {
                updateStatus("Billing setup successful")
                // Query available products
                billingManager.queryProductDetails { products ->
                    runOnUiThread {
                        availableProducts = products
                        Log.d(TAG, "Available products: ${products.size}")
                        
                        if (products.isNotEmpty()) {
                            updateStatus("Ready to subscribe")
                        } else {
                            updateStatus("No products available")
                        }
                    }
                }
            } else {
                updateStatus("Billing setup failed")
                Toast.makeText(this, "Billing setup failed. Please try again.", Toast.LENGTH_LONG).show()
            }
        }
    }

    override fun onPurchaseSuccess(purchase: Purchase) {
        runOnUiThread {
            val productName = when {
                purchase.products.contains(BillingManager.MONTHLY_SUBSCRIPTION_ID) -> "Monthly Subscription"
                purchase.products.contains(BillingManager.PREPAID_PLAN_ID) -> "Prepaid Plan"
                else -> "Unknown Product"
            }
            
            updateStatus("Purchase successful: $productName")
            Toast.makeText(this, "Purchase successful: $productName", Toast.LENGTH_LONG).show()
            
            // Here you would typically:
            // 1. Verify the purchase on your server
            // 2. Grant access to premium features
            // 3. Update the UI to reflect the subscription status
        }
    }

    override fun onPurchaseFailure(billingResult: BillingResult) {
        runOnUiThread {
            val message = when (billingResult.responseCode) {
                1 -> "Purchase canceled"
                2 -> "Service unavailable"
                3 -> "Billing unavailable"
                4 -> "Item unavailable"
                5 -> "Developer error"
                6 -> "Purchase error"
                7 -> "Item already owned"
                8 -> "Item not owned"
                else -> "Purchase failed: ${billingResult.debugMessage}"
            }
            
            updateStatus(message)
            Toast.makeText(this, message, Toast.LENGTH_LONG).show()
        }
    }
    
    override fun onPurchaseVerified(purchase: Purchase, isValid: Boolean) {
        runOnUiThread {
            if (isValid) {
                updateStatus("Purchase verified successfully")
                loadUserSubscriptionStatus()
            } else {
                updateStatus("Purchase verification failed")
                Toast.makeText(this, "Purchase verification failed. Please contact support.", Toast.LENGTH_LONG).show()
            }
        }
    }
    
    private fun loadUserSubscriptionStatus() {
        lifecycleScope.launch {
            when (val result = repository.getSubscriptionStatus()) {
                is ApiResult.Success -> {
                    val status = result.data
                    runOnUiThread {
                        val statusText = when (status.subscriptionStatus) {
                            "ACTIVE" -> "Active subscription"
                            "EXPIRED" -> "Subscription expired"
                            "CANCELLED" -> "Subscription cancelled"
                            "GRACE_PERIOD" -> "Grace period"
                            else -> "No active subscription"
                        }
                        updateStatus(statusText)
                    }
                }
                is ApiResult.Error -> {
                    runOnUiThread {
                        updateStatus("Failed to load subscription status")
                    }
                }
            }
        }
    }
    
    private fun navigateToAuth() {
        val intent = Intent(this, AuthActivity::class.java)
        startActivity(intent)
        finish()
    }

    override fun onDestroy() {
        super.onDestroy()
        billingManager.endConnection()
    }
}
package com.example.subscriptionapp.api

import com.google.gson.annotations.SerializedName

// Authentication Models
data class LoginRequest(
    val email: String,
    val password: String
)

data class RegisterRequest(
    val email: String,
    val password: String,
    val name: String
)

data class AuthResponse(
    val success: Boolean,
    val message: String,
    val token: String?,
    val user: User?
)

data class User(
    val id: String,
    val email: String,
    val name: String,
    @SerializedName("subscription_status") val subscriptionStatus: String,
    @SerializedName("subscription_expires_at") val subscriptionExpiresAt: String?,
    @SerializedName("created_at") val createdAt: String
)

// Purchase Verification Models
data class PurchaseVerificationRequest(
    @SerializedName("purchase_token") val purchaseToken: String,
    @SerializedName("product_id") val productId: String,
    @SerializedName("package_name") val packageName: String,
    @SerializedName("subscription_id") val subscriptionId: String? = null,
    @SerializedName("user_id") val userId: String
)

data class PurchaseVerificationResponse(
    val success: Boolean,
    val message: String,
    val valid: Boolean,
    @SerializedName("subscription_status") val subscriptionStatus: String?,
    @SerializedName("expires_at") val expiresAt: String?,
    @SerializedName("auto_renewing") val autoRenewing: Boolean?
)

// Subscription Status Models
data class SubscriptionStatusResponse(
    val success: Boolean,
    val message: String,
    @SerializedName("subscription_status") val subscriptionStatus: String,
    @SerializedName("product_id") val productId: String?,
    @SerializedName("expires_at") val expiresAt: String?,
    @SerializedName("auto_renewing") val autoRenewing: Boolean,
    @SerializedName("in_grace_period") val inGracePeriod: Boolean,
    @SerializedName("account_hold") val accountHold: Boolean
)

// Webhook Models
data class SubscriptionWebhookRequest(
    val message: GooglePlayWebhookMessage
)

data class GooglePlayWebhookMessage(
    val data: String,
    val messageId: String,
    val publishTime: String
)

data class WebhookResponse(
    val success: Boolean,
    val message: String
)

// User Profile Models
data class UserProfileResponse(
    val success: Boolean,
    val message: String,
    val user: User?
)

data class UpdateProfileRequest(
    val name: String?,
    val email: String?
)

// API Error Models
data class ApiError(
    val success: Boolean,
    val message: String,
    val error: String?,
    val code: Int?
)

// Subscription Status Enum
enum class SubscriptionStatus {
    ACTIVE,
    EXPIRED,
    CANCELLED,
    PENDING,
    GRACE_PERIOD,
    ACCOUNT_HOLD,
    PAUSED,
    NONE
}
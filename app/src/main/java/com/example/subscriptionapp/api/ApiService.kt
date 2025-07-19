package com.example.subscriptionapp.api

import retrofit2.Response
import retrofit2.http.*

interface ApiService {
    
    @POST("auth/login")
    suspend fun login(@Body request: LoginRequest): Response<AuthResponse>
    
    @POST("auth/register")
    suspend fun register(@Body request: RegisterRequest): Response<AuthResponse>
    
    @POST("purchases/verify")
    suspend fun verifyPurchase(@Body request: PurchaseVerificationRequest): Response<PurchaseVerificationResponse>
    
    @GET("subscription/status")
    suspend fun getSubscriptionStatus(@Header("Authorization") token: String): Response<SubscriptionStatusResponse>
    
    @POST("subscription/webhook")
    suspend fun handleSubscriptionWebhook(@Body request: SubscriptionWebhookRequest): Response<WebhookResponse>
    
    @GET("user/profile")
    suspend fun getUserProfile(@Header("Authorization") token: String): Response<UserProfileResponse>
    
    @PUT("user/profile")
    suspend fun updateUserProfile(
        @Header("Authorization") token: String,
        @Body request: UpdateProfileRequest
    ): Response<UserProfileResponse>
}
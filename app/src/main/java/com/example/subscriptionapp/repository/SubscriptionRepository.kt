package com.example.subscriptionapp.repository

import android.content.Context
import android.util.Log
import com.example.subscriptionapp.api.ApiClient
import com.example.subscriptionapp.api.ApiError
import com.example.subscriptionapp.api.AuthResponse
import com.example.subscriptionapp.api.LoginRequest
import com.example.subscriptionapp.api.PurchaseVerificationRequest
import com.example.subscriptionapp.api.PurchaseVerificationResponse
import com.example.subscriptionapp.api.RegisterRequest
import com.example.subscriptionapp.api.SubscriptionStatusResponse
import com.example.subscriptionapp.api.UserProfileResponse
import com.example.subscriptionapp.utils.SecureStorage
import com.google.gson.Gson
import retrofit2.Response

class SubscriptionRepository(private val context: Context) {
    
    private val apiService = ApiClient.apiService
    private val secureStorage = SecureStorage(context)
    private val gson = Gson()
    
    companion object {
        private const val TAG = "SubscriptionRepository"
    }
    
    suspend fun login(email: String, password: String): ApiResult<AuthResponse> {
        return try {
            val request = LoginRequest(email, password)
            val response = apiService.login(request)
            
            if (response.isSuccessful) {
                response.body()?.let { authResponse ->
                    if (authResponse.success && authResponse.token != null) {
                        secureStorage.saveAuthToken(authResponse.token)
                        secureStorage.saveUserInfo(authResponse.user)
                    }
                    ApiResult.Success(authResponse)
                } ?: ApiResult.Error("Empty response body")
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                ApiResult.Error(apiError.message)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Login error", e)
            ApiResult.Error("Network error: ${e.message}")
        }
    }
    
    suspend fun register(email: String, password: String, name: String): ApiResult<AuthResponse> {
        return try {
            val request = RegisterRequest(email, password, name)
            val response = apiService.register(request)
            
            if (response.isSuccessful) {
                response.body()?.let { authResponse ->
                    if (authResponse.success && authResponse.token != null) {
                        secureStorage.saveAuthToken(authResponse.token)
                        secureStorage.saveUserInfo(authResponse.user)
                    }
                    ApiResult.Success(authResponse)
                } ?: ApiResult.Error("Empty response body")
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                ApiResult.Error(apiError.message)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Registration error", e)
            ApiResult.Error("Network error: ${e.message}")
        }
    }
    
    suspend fun verifyPurchase(
        purchaseToken: String,
        productId: String,
        packageName: String,
        subscriptionId: String? = null
    ): ApiResult<PurchaseVerificationResponse> {
        return try {
            val token = secureStorage.getAuthToken()
            val userId = secureStorage.getUserId()
            
            if (token == null || userId == null) {
                return ApiResult.Error("User not authenticated")
            }
            
            val request = PurchaseVerificationRequest(
                purchaseToken = purchaseToken,
                productId = productId,
                packageName = packageName,
                subscriptionId = subscriptionId,
                userId = userId
            )
            
            val response = apiService.verifyPurchase(request)
            
            if (response.isSuccessful) {
                response.body()?.let { verificationResponse ->
                    ApiResult.Success(verificationResponse)
                } ?: ApiResult.Error("Empty response body")
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                ApiResult.Error(apiError.message)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Purchase verification error", e)
            ApiResult.Error("Network error: ${e.message}")
        }
    }
    
    suspend fun getSubscriptionStatus(): ApiResult<SubscriptionStatusResponse> {
        return try {
            val token = secureStorage.getAuthToken()
            
            if (token == null) {
                return ApiResult.Error("User not authenticated")
            }
            
            val response = apiService.getSubscriptionStatus("Bearer $token")
            
            if (response.isSuccessful) {
                response.body()?.let { statusResponse ->
                    ApiResult.Success(statusResponse)
                } ?: ApiResult.Error("Empty response body")
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                ApiResult.Error(apiError.message)
            }
        } catch (e: Exception) {
            Log.e(TAG, "Subscription status error", e)
            ApiResult.Error("Network error: ${e.message}")
        }
    }
    
    suspend fun getUserProfile(): ApiResult<UserProfileResponse> {
        return try {
            val token = secureStorage.getAuthToken()
            
            if (token == null) {
                return ApiResult.Error("User not authenticated")
            }
            
            val response = apiService.getUserProfile("Bearer $token")
            
            if (response.isSuccessful) {
                response.body()?.let { profileResponse ->
                    if (profileResponse.success && profileResponse.user != null) {
                        secureStorage.saveUserInfo(profileResponse.user)
                    }
                    ApiResult.Success(profileResponse)
                } ?: ApiResult.Error("Empty response body")
            } else {
                val errorBody = response.errorBody()?.string()
                val apiError = parseApiError(errorBody)
                ApiResult.Error(apiError.message)
            }
        } catch (e: Exception) {
            Log.e(TAG, "User profile error", e)
            ApiResult.Error("Network error: ${e.message}")
        }
    }
    
    fun logout() {
        secureStorage.clearAll()
    }
    
    fun isLoggedIn(): Boolean {
        return secureStorage.getAuthToken() != null
    }
    
    fun getCurrentUserId(): String? {
        return secureStorage.getUserId()
    }
    
    private fun parseApiError(errorBody: String?): ApiError {
        return try {
            if (errorBody != null) {
                gson.fromJson(errorBody, ApiError::class.java)
            } else {
                ApiError(false, "Unknown error", null, null)
            }
        } catch (e: Exception) {
            ApiError(false, "Failed to parse error response", null, null)
        }
    }
}

sealed class ApiResult<out T> {
    data class Success<T>(val data: T) : ApiResult<T>()
    data class Error(val message: String) : ApiResult<Nothing>()
}
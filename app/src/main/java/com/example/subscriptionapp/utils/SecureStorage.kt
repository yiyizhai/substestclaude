package com.example.subscriptionapp.utils

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKeys
import com.example.subscriptionapp.api.User
import com.google.gson.Gson

class SecureStorage(context: Context) {
    
    private val gson = Gson()
    
    private val masterKeyAlias = MasterKeys.getOrCreate(MasterKeys.AES256_GCM_SPEC)
    
    private val sharedPreferences = EncryptedSharedPreferences.create(
        "secure_prefs",
        masterKeyAlias,
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )
    
    companion object {
        private const val KEY_AUTH_TOKEN = "auth_token"
        private const val KEY_USER_INFO = "user_info"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_SUBSCRIPTION_STATUS = "subscription_status"
        private const val KEY_SUBSCRIPTION_EXPIRES_AT = "subscription_expires_at"
    }
    
    fun saveAuthToken(token: String) {
        sharedPreferences.edit()
            .putString(KEY_AUTH_TOKEN, token)
            .apply()
    }
    
    fun getAuthToken(): String? {
        return sharedPreferences.getString(KEY_AUTH_TOKEN, null)
    }
    
    fun saveUserInfo(user: User?) {
        if (user != null) {
            val userJson = gson.toJson(user)
            sharedPreferences.edit()
                .putString(KEY_USER_INFO, userJson)
                .putString(KEY_USER_ID, user.id)
                .putString(KEY_SUBSCRIPTION_STATUS, user.subscriptionStatus)
                .putString(KEY_SUBSCRIPTION_EXPIRES_AT, user.subscriptionExpiresAt)
                .apply()
        }
    }
    
    fun getUserInfo(): User? {
        val userJson = sharedPreferences.getString(KEY_USER_INFO, null)
        return if (userJson != null) {
            try {
                gson.fromJson(userJson, User::class.java)
            } catch (e: Exception) {
                null
            }
        } else {
            null
        }
    }
    
    fun getUserId(): String? {
        return sharedPreferences.getString(KEY_USER_ID, null)
    }
    
    fun getSubscriptionStatus(): String? {
        return sharedPreferences.getString(KEY_SUBSCRIPTION_STATUS, null)
    }
    
    fun getSubscriptionExpiresAt(): String? {
        return sharedPreferences.getString(KEY_SUBSCRIPTION_EXPIRES_AT, null)
    }
    
    fun updateSubscriptionStatus(status: String, expiresAt: String?) {
        sharedPreferences.edit()
            .putString(KEY_SUBSCRIPTION_STATUS, status)
            .putString(KEY_SUBSCRIPTION_EXPIRES_AT, expiresAt)
            .apply()
    }
    
    fun clearAll() {
        sharedPreferences.edit().clear().apply()
    }
    
    fun clearAuthData() {
        sharedPreferences.edit()
            .remove(KEY_AUTH_TOKEN)
            .remove(KEY_USER_INFO)
            .remove(KEY_USER_ID)
            .remove(KEY_SUBSCRIPTION_STATUS)
            .remove(KEY_SUBSCRIPTION_EXPIRES_AT)
            .apply()
    }
}
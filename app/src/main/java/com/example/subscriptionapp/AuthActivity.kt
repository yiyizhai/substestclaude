package com.example.subscriptionapp

import android.content.Intent
import android.os.Bundle
import android.view.View
import android.widget.Toast
import androidx.appcompat.app.AppCompatActivity
import androidx.lifecycle.lifecycleScope
import com.example.subscriptionapp.databinding.ActivityAuthBinding
import com.example.subscriptionapp.repository.ApiResult
import com.example.subscriptionapp.repository.SubscriptionRepository
import kotlinx.coroutines.launch

class AuthActivity : AppCompatActivity() {
    
    private lateinit var binding: ActivityAuthBinding
    private lateinit var repository: SubscriptionRepository
    private var isLoginMode = true
    
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityAuthBinding.inflate(layoutInflater)
        setContentView(binding.root)
        
        repository = SubscriptionRepository(this)
        
        // Check if user is already logged in
        if (repository.isLoggedIn()) {
            navigateToMain()
            return
        }
        
        setupUI()
    }
    
    private fun setupUI() {
        binding.loginButton.setOnClickListener {
            if (isLoginMode) {
                performLogin()
            } else {
                performRegister()
            }
        }
        
        binding.toggleModeButton.setOnClickListener {
            toggleMode()
        }
    }
    
    private fun performLogin() {
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString().trim()
        
        if (email.isEmpty() || password.isEmpty()) {
            showError("Please fill in all fields")
            return
        }
        
        setLoading(true)
        
        lifecycleScope.launch {
            when (val result = repository.login(email, password)) {
                is ApiResult.Success -> {
                    setLoading(false)
                    if (result.data.success) {
                        Toast.makeText(this@AuthActivity, "Login successful", Toast.LENGTH_SHORT).show()
                        navigateToMain()
                    } else {
                        showError(result.data.message)
                    }
                }
                is ApiResult.Error -> {
                    setLoading(false)
                    showError(result.message)
                }
            }
        }
    }
    
    private fun performRegister() {
        val email = binding.emailEditText.text.toString().trim()
        val password = binding.passwordEditText.text.toString().trim()
        val name = binding.nameEditText.text.toString().trim()
        
        if (email.isEmpty() || password.isEmpty() || name.isEmpty()) {
            showError("Please fill in all fields")
            return
        }
        
        setLoading(true)
        
        lifecycleScope.launch {
            when (val result = repository.register(email, password, name)) {
                is ApiResult.Success -> {
                    setLoading(false)
                    if (result.data.success) {
                        Toast.makeText(this@AuthActivity, "Registration successful", Toast.LENGTH_SHORT).show()
                        navigateToMain()
                    } else {
                        showError(result.data.message)
                    }
                }
                is ApiResult.Error -> {
                    setLoading(false)
                    showError(result.message)
                }
            }
        }
    }
    
    private fun toggleMode() {
        isLoginMode = !isLoginMode
        
        if (isLoginMode) {
            binding.titleText.text = "Welcome Back"
            binding.loginButton.text = "Login"
            binding.toggleModeButton.text = "Don't have an account? Sign up"
            binding.nameInput.visibility = View.GONE
        } else {
            binding.titleText.text = "Create Account"
            binding.loginButton.text = "Sign Up"
            binding.toggleModeButton.text = "Already have an account? Login"
            binding.nameInput.visibility = View.VISIBLE
        }
        
        clearFields()
    }
    
    private fun clearFields() {
        binding.emailEditText.text?.clear()
        binding.passwordEditText.text?.clear()
        binding.nameEditText.text?.clear()
        binding.statusText.text = ""
    }
    
    private fun setLoading(isLoading: Boolean) {
        binding.progressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
        binding.loginButton.isEnabled = !isLoading
        binding.toggleModeButton.isEnabled = !isLoading
    }
    
    private fun showError(message: String) {
        binding.statusText.text = message
        binding.statusText.setTextColor(getColor(android.R.color.holo_red_dark))
    }
    
    private fun navigateToMain() {
        val intent = Intent(this, MainActivity::class.java)
        startActivity(intent)
        finish()
    }
}
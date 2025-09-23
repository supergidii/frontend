import React, { useState, useEffect } from 'react';
import './Login.css';

// Base URL for API calls
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://netgift1aviator.pythonanywhere.com';

function Login() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    phone_number: '',
    password: '',
    confirm_password: '',
    referral_code: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Check if user is already logged in on component mount
  useEffect(() => {
    const accessToken = localStorage.getItem('access_token');
    if (accessToken) {
      // User is already logged in, redirect to home
      window.location.href = '/';
    }

    // Check for referral code in URL
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');
    if (referralCode) {
      setFormData(prev => ({
        ...prev,
        referral_code: referralCode
      }));
    }
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const endpoint = isLogin 
        ? `${API_BASE_URL}/api/auth/login/`
        : `${API_BASE_URL}/api/auth/register/`;
      const payload = isLogin 
        ? { phone_number: formData.phone_number, password: formData.password }
        : { 
            phone_number: formData.phone_number, 
            password: formData.password, 
            confirm_password: formData.confirm_password,
            referral_code: formData.referral_code
          };

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (response.ok) {
        // Store tokens and user info in localStorage
        if (data.tokens) {
          localStorage.setItem('access_token', data.tokens.access);
          localStorage.setItem('refresh_token', data.tokens.refresh);
        }
        if (data.user) {
          localStorage.setItem('user_info', JSON.stringify(data.user));
        }
        setSuccess(data.message || (isLogin ? 'Login successful!' : 'Registration successful!'));
        // Redirect to home page after successful login/registration
        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        setError(data.error || data.message || 'An error occurred');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
    // Clear error when user starts typing
    if (error) setError('');
  };

  const validatePhoneNumber = (phone) => {
    // Lenient validation: accept 9-15 digits (allows 07..., 254..., +254..., etc.)
    const digits = String(phone || '').replace(/\D/g, '');
    return digits.length >= 9 && digits.length <= 15;
  };

  const validateForm = () => {
    if (!formData.phone_number || !formData.password) {
      return false;
    }
    if (!validatePhoneNumber(formData.phone_number)) {
      return false;
    }
    if (!isLogin && formData.password !== formData.confirm_password) {
      return false;
    }
    return true;
  };

  // If user is already logged in, show loading or redirect message
  const accessToken = localStorage.getItem('access_token');
  if (accessToken) {
    return (
      <div className="login">
        <div className="login-container">
          <h1>Redirecting...</h1>
          <p>You are already logged in. Redirecting to home page...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="login">
      <div className="login-container">
        <h1>{isLogin ? 'Login' : 'Register'}</h1>
        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="phone_number">Phone Number:</label>
            <input
              type="tel"
              id="phone_number"
              name="phone_number"
              value={formData.phone_number}
              onChange={handleChange}
              placeholder="+2547XXXXXXXX"
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password:</label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              minLength="6"
              required
            />
          </div>
          {!isLogin && (
            <>
              <div className="form-group">
                <label htmlFor="confirm_password">Confirm Password:</label>
                <input
                  type="password"
                  id="confirm_password"
                  name="confirm_password"
                  value={formData.confirm_password}
                  onChange={handleChange}
                  minLength="6"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="referral_code">Referral Code (Optional):</label>
                <input
                  type="text"
                  id="referral_code"
                  name="referral_code"
                  value={formData.referral_code}
                  onChange={handleChange}
                  placeholder="Enter referral code if you have one"
                  maxLength="20"
                  className={formData.referral_code ? 'referral-code-prefilled' : ''}
                />
                {formData.referral_code && (
                  <div className="referral-code-indicator">
                    ✅ Referral code detected from link!
                  </div>
                )}
              </div>
            </>
          )}
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !validateForm()}
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </form>
        <div className="toggle-form">
          <p>
            {isLogin ? "Don't have an account? " : "Already have an account? "}
            <button 
              className="toggle-btn"
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess('');
                setFormData({
                  phone_number: '',
                  password: '',
                  confirm_password: '',
                  referral_code: ''
                });
              }}
            >
              {isLogin ? 'Register' : 'Login'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login; 
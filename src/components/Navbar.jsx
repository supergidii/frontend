import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './Navbar.css';

function Navbar() {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userInfo, setUserInfo] = useState(null);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check authentication status on component mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      const accessToken = localStorage.getItem('access_token');
      if (accessToken) {
        setIsLoggedIn(true);
        
        // Try to get user info from localStorage first
        const userData = localStorage.getItem('user_info');
        if (userData) {
          const user = JSON.parse(userData);
          setUserInfo(user);
          setIsAdmin(user.is_admin || false);
        }
        
        // Also fetch fresh user data from API to ensure admin status is current
        try {
          const response = await fetch(`${process.env.REACT_APP_API_BASE_URL || 'http://127.0.0.1:8000'}/api/auth/profile/`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (response.ok) {
            const data = await response.json();
            const user = data.user || data;
            setUserInfo(user);
            setIsAdmin(user.is_admin || false);
            
            // Debug logging
            console.log('User profile data:', user);
            console.log('Is admin:', user.is_admin);
            console.log('Admin status set to:', user.is_admin || false);
            
            // Update localStorage with fresh data
            localStorage.setItem('user_info', JSON.stringify(user));
          }
        } catch (error) {
          console.error('Failed to fetch user profile:', error);
        }
      }
    };
    
    checkAuthStatus();
  }, []);

  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const handleLogout = () => {
    // Clear all authentication data
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_info');
    setIsLoggedIn(false);
    setUserInfo(null);
    
    // Redirect to home page
    window.location.href = '/';
  };

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (isDropdownOpen && !event.target.closest('.navbar-dropdown')) {
        setIsDropdownOpen(false);
      }
      if (isMobileMenuOpen && !event.target.closest('.navbar')) {
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isDropdownOpen, isMobileMenuOpen]);

  return (
    <nav className="navbar">
      <div className="navbar-brand">
        <Link to="/" className="navbar-logo">
          Virtual Betting
        </Link>
      </div>
      
      {/* Mobile Menu Toggle */}
      <button 
        className={`mobile-menu-toggle ${isMobileMenuOpen ? 'active' : ''}`}
        onClick={toggleMobileMenu}
        aria-label="Toggle mobile menu"
      >
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
        <span className="hamburger-line"></span>
      </button>

      <div className={`navbar-menu ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
        <Link to="/home" className="navbar-item" onClick={() => setIsMobileMenuOpen(false)}>Home</Link>
        {/* Games dropdown removed per request */}
        <Link to="/aviator" className="navbar-item" onClick={() => setIsMobileMenuOpen(false)}>Aviator</Link>
        <Link to="/deposit" className="navbar-item" onClick={() => setIsMobileMenuOpen(false)}>Deposit</Link>
        
        {/* Admin Dashboard - only show for admin users */}
        {isLoggedIn && isAdmin && (
          <Link to="/admin/referrals" className="navbar-item admin-link" onClick={() => setIsMobileMenuOpen(false)}>
            Admin Dashboard
          </Link>
        )}
        
        
        {/* Show different content based on authentication status */}
        {isLoggedIn ? (
          <div className="navbar-user-section">
            <span className="user-phone">{userInfo?.phone_number || 'User'}</span>
            <button className="logout-btn" onClick={handleLogout}>Logout</button>
          </div>
        ) : (
          <Link to="/login" className="navbar-item" onClick={() => setIsMobileMenuOpen(false)}>Login</Link>
        )}
      </div>
    </nav>
  );
}

export default Navbar; 
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './AdminReferralDashboard.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://netgift1aviator.pythonanywhere.com/';

const AdminReferralDashboard = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userReferrals, setUserReferrals] = useState([]);
  const [referralStats, setReferralStats] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('search');

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          setError('Please log in to access admin features');
          return;
        }

        const response = await axios.get(`${API_BASE_URL}/api/auth/profile/`, {
          headers: { Authorization: `Bearer ${token}` }
        });

        // Get user data from response
        const user = response.data.user || response.data;
        console.log('Admin check - User data:', user);
        console.log('Admin check - is_admin:', user.is_admin);

        if (!user.is_admin) {
          setError('Access denied. Admin privileges required.');
          return;
        }

        // Load initial stats and users
        loadReferralStats();
        loadAllUsers();
      } catch (err) {
        console.error('Admin verification error:', err);
        setError('Failed to verify admin status');
      }
    };

    checkAdminStatus();
  }, []);

  const loadReferralStats = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/referral-stats/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setReferralStats(response.data);
    } catch (err) {
      console.error('Failed to load referral stats:', err);
    }
  };

  const loadAllUsers = async (page = 1) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/users/all/`, {
        params: { page, page_size: 20 },
        headers: { Authorization: `Bearer ${token}` }
      });
      setAllUsers(response.data.users);
      setPagination(response.data.pagination);
    } catch (err) {
      console.error('Failed to load all users:', err);
    }
  };

  const searchUsers = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/users/search/`, {
        params: { q: query },
        headers: { Authorization: `Bearer ${token}` }
      });
      setSearchResults(response.data.users);
    } catch (err) {
      setError('Failed to search users');
      console.error('Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUserReferrals = async (userId) => {
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_BASE_URL}/api/admin/users/${userId}/referrals/`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedUser(response.data.user);
      setUserReferrals(response.data.referrals);
      setActiveTab('referrals');
    } catch (err) {
      setError('Failed to load user referrals');
      console.error('Load referrals error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    searchUsers(searchQuery);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (error && error.includes('Access denied')) {
    return (
      <div className="admin-dashboard">
        <div className="access-denied">
          <h2>Access Denied</h2>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <h1>Admin Referral Dashboard</h1>
        <div className="admin-controls">
          <button 
            className={`tab-button ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => setActiveTab('search')}
          >
            Search Users
          </button>
          <button 
            className={`tab-button ${activeTab === 'stats' ? 'active' : ''}`}
            onClick={() => setActiveTab('stats')}
          >
            Statistics
          </button>
          <button 
            className={`tab-button ${activeTab === 'all-users' ? 'active' : ''}`}
            onClick={() => setActiveTab('all-users')}
          >
            All Users
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError('')} className="error-close">×</button>
        </div>
      )}

      {activeTab === 'search' && (
        <div className="search-section">
          <form onSubmit={handleSearch} className="search-form">
            <div className="search-input-group">
              <input
                type="text"
                placeholder="Search by phone number, username, or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
              <button type="submit" className="search-button" disabled={loading}>
                {loading ? 'Searching...' : 'Search'}
              </button>
            </div>
          </form>

          {searchResults.length > 0 && (
            <div className="search-results">
              <h3>Search Results ({searchResults.length})</h3>
              <div className="users-table">
                <table>
                  <thead>
                    <tr>
                      <th>Phone</th>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Referral Code</th>
                      <th>Referrals</th>
                      <th>Balance</th>
                      <th>Referrer</th>
                      <th>Joined</th>
                      <th>Status</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {searchResults.map((user) => (
                      <tr key={user.id}>
                        <td>{user.phone_number}</td>
                        <td>{user.username}</td>
                        <td>{user.email || '-'}</td>
                        <td className="referral-code">{user.referral_code}</td>
                        <td className="referral-count">{user.referral_count}</td>
                        <td className="balance">KSh {user.balance?.toFixed(2) || '0.00'}</td>
                        <td>{user.referrer_code || '-'}</td>
                        <td>{formatDate(user.date_joined)}</td>
                        <td>
                          <span className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                            {user.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td>
                          <button
                            onClick={() => loadUserReferrals(user.id)}
                            className="view-referrals-btn"
                            disabled={loading}
                          >
                            View Referrals
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'stats' && referralStats && (
        <div className="stats-section">
          <h3>Referral Statistics</h3>
          <div className="stats-grid">
            <div className="stat-card">
              <h4>Total Users</h4>
              <p className="stat-number">{referralStats.total_users}</p>
            </div>
            <div className="stat-card">
              <h4>Users with Referrals</h4>
              <p className="stat-number">{referralStats.users_with_referrals}</p>
            </div>
            <div className="stat-card">
              <h4>Total Referrals</h4>
              <p className="stat-number">{referralStats.total_referrals}</p>
            </div>
            <div className="stat-card">
              <h4>Referral Rate</h4>
              <p className="stat-number">{referralStats.referral_rate}%</p>
            </div>
          </div>

          {referralStats.top_referrers.length > 0 && (
            <div className="top-referrers">
              <h4>Top Referrers</h4>
              <div className="referrers-table">
                <table>
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Phone</th>
                      <th>Username</th>
                      <th>Referral Code</th>
                      <th>Referrals</th>
                      <th>Balance</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {referralStats.top_referrers.map((user, index) => (
                      <tr key={user.id}>
                        <td className="rank">#{index + 1}</td>
                        <td>{user.phone_number}</td>
                        <td>{user.username}</td>
                        <td className="referral-code">{user.referral_code}</td>
                        <td className="referral-count">{user.referral_count}</td>
                        <td className="balance">KSh {user.balance?.toFixed(2) || '0.00'}</td>
                        <td>
                          <button
                            onClick={() => loadUserReferrals(user.id)}
                            className="view-referrals-btn"
                            disabled={loading}
                          >
                            View Referrals
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'all-users' && (
        <div className="all-users-section">
          <div className="section-header">
            <h3>All Users ({pagination?.total_users || 0})</h3>
            <div className="pagination-info">
              Page {pagination?.page || 1} of {pagination?.total_pages || 1}
            </div>
          </div>

          {allUsers.length > 0 ? (
            <div className="users-table">
              <table>
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Referral Code</th>
                    <th>Referrals</th>
                    <th>Balance</th>
                    <th>Referrer</th>
                    <th>Joined</th>
                    <th>Status</th>
                    <th>Role</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map((user) => (
                    <tr key={user.id}>
                      <td>{user.phone_number}</td>
                      <td>{user.username}</td>
                      <td>{user.email || '-'}</td>
                      <td className="referral-code">{user.referral_code}</td>
                      <td className="referral-count">{user.referral_count}</td>
                      <td className="balance">KSh {user.balance?.toFixed(2) || '0.00'}</td>
                      <td>{user.referrer_code || '-'}</td>
                      <td>{formatDate(user.date_joined)}</td>
                      <td>
                        <span className={`status ${user.is_active ? 'active' : 'inactive'}`}>
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <span className={`role ${user.is_admin ? 'admin' : 'user'}`}>
                          {user.is_admin ? 'Admin' : 'User'}
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={() => loadUserReferrals(user.id)}
                          className="view-referrals-btn"
                          disabled={loading}
                        >
                          View Referrals
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-users">
              <p>No users found.</p>
            </div>
          )}

          {pagination && pagination.total_pages > 1 && (
            <div className="pagination-controls">
              <button
                onClick={() => loadAllUsers(pagination.page - 1)}
                disabled={!pagination.has_previous}
                className="pagination-btn"
              >
                Previous
              </button>
              <span className="pagination-info">
                Page {pagination.page} of {pagination.total_pages}
              </span>
              <button
                onClick={() => loadAllUsers(pagination.page + 1)}
                disabled={!pagination.has_next}
                className="pagination-btn"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {selectedUser && (
        <div className="referrals-section">
          <div className="referrals-header">
            <h3>Referrals for {selectedUser.phone_number}</h3>
            <div className="user-info">
              <p><strong>Username:</strong> {selectedUser.username}</p>
              <p><strong>Referral Code:</strong> {selectedUser.referral_code}</p>
              <p><strong>Balance:</strong> KSh {selectedUser.balance?.toFixed(2) || '0.00'}</p>
              {selectedUser.referrer_code && (
                <p><strong>Referred by:</strong> {selectedUser.referrer_code}</p>
              )}
            </div>
            <button 
              onClick={() => setSelectedUser(null)} 
              className="close-referrals-btn"
            >
              Close
            </button>
          </div>

          {userReferrals.length > 0 ? (
            <div className="referrals-table">
              <table>
                <thead>
                  <tr>
                    <th>Phone</th>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Referral Code</th>
                    <th>Balance</th>
                    <th>Joined</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {userReferrals.map((referral) => (
                    <tr key={referral.id}>
                      <td>{referral.phone_number}</td>
                      <td>{referral.username}</td>
                      <td>{referral.email || '-'}</td>
                      <td className="referral-code">{referral.referral_code}</td>
                      <td className="balance">KSh {referral.balance?.toFixed(2) || '0.00'}</td>
                      <td>{formatDate(referral.date_joined)}</td>
                      <td>
                        <span className={`status ${referral.is_active ? 'active' : 'inactive'}`}>
                          {referral.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="no-referrals">
              <p>This user has no referrals yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminReferralDashboard;

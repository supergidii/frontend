import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import Home from './components/Home';
import Matches from './components/Matches';
import BetSlip from './components/BetSlip';
import Results from './components/Results';
import Login from './components/Login';
import Aviator from './components/Aviator';
import Deposit from './components/Deposit';
import AdminReferralDashboard from './components/AdminReferralDashboard';

function App() {
  return (
    <Router>
      <div className="App">
        <Navbar />
        <Routes>
          <Route path="/" element={<Aviator />} />
          <Route path="/home" element={<div className="container"><Home /></div>} />
          <Route path="/matches" element={<div className="container"><Matches /></div>} />
          <Route path="/bet-slip" element={<div className="container"><BetSlip /></div>} />
          <Route path="/results" element={<div className="container"><Results /></div>} />
          <Route path="/login" element={<div className="container"><Login /></div>} />
          <Route path="/deposit" element={<div className="container"><Deposit /></div>} />
          <Route path="/admin/referrals" element={<AdminReferralDashboard />} />
          <Route path="/aviator" element={<Aviator />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App; 
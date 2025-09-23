import React, { useState } from 'react';
import './Deposit.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://netgift1aviator.pythonanywhere.com/';

function Deposit() {
  const [amount, setAmount] = useState('');
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [txnCode, setTxnCode] = useState('');

  const initiateStk = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'deposit', payload: { amount } }));
      window.location.href = '/login';
      return;
    }
    if (!amount) {
      setError('Enter an amount first');
      return;
    }
    try {
      await fetch(`${API_BASE_URL}/api/mpesa/stkpush/?amount=${encodeURIComponent(amount)}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setError('');
      setSuccess('STK Push sent. Enter your M-Pesa PIN to complete. Your balance will update automatically after confirmation.');
    } catch (e) {
      setError('Failed to initiate STK Push');
    }
  };

  const submitManualTxn = async () => {
    const token = localStorage.getItem('access_token');
    if (!token) {
      localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'deposit', payload: { amount, txnCode } }));
      window.location.href = '/login';
      return;
    }
    if (!amount || !txnCode) {
      setError('Enter amount and transaction code');
      return;
    }
    try {
      const resp = await fetch(`${API_BASE_URL}/api/mpesa/manual/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ amount, transaction_code: txnCode })
      });
      if (!resp.ok) throw new Error('Manual submission failed');
      setError('');
      setSuccess('Transaction submitted. Your balance will update once verified.');
    } catch (e) {
      setError('Failed to submit transaction');
    }
  };

  return (
    <div className="deposit-page">
      <div className="deposit-card">
        <h1>Deposit</h1>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        <div className="deposit-section">
          <label>Amount</label>
          <input
            type="number"
            min="1"
            placeholder="Enter amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button type="button" onClick={initiateStk}>Pay via M-Pesa (STK Push)</button>
        </div>

        <div className="divider">OR</div>

        <div className="till-section">
          <h2>Pay Manually via Till</h2>
          <ol>
            <li>Go to M-Pesa on your phone</li>
            <li>Select Lipa na M-Pesa</li>
            <li>Select Buy Goods and Services</li>
            <li>Enter Till Number: <strong>9827355</strong></li>
            <li>Enter Amount: your desired deposit</li>
            <li>Enter your M-Pesa PIN and confirm</li>
          </ol>
          <p>Once we receive the confirmation from M-Pesa, your balance will be updated automatically.</p>
          <div className="deposit-section">
            <label>Transaction Code (e.g., TIH9DTMQR7)</label>
            <input
              type="text"
              placeholder="Enter M-Pesa transaction code"
              value={txnCode}
              onChange={(e) => setTxnCode(e.target.value)}
            />
            <button type="button" onClick={submitManualTxn}>Submit Transaction Code</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Deposit;



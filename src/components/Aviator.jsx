import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import './Aviator.css';

// Set the base URL for API calls (env override, default to local backend)
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://netgift1aviator.pythonanywhere.com/api';

// Always attach Authorization header when token exists (backend ignores it for public endpoints)
axios.interceptors.request.use((config) => {
  try {
    const tok = localStorage.getItem('access_token');
    if (tok) {
      config.headers = config.headers || {};
      config.headers['Authorization'] = `Bearer ${tok}`;
    }
  } catch (e) {}
  return config;
});

// Optional: auto-redirect on auth errors
axios.interceptors.response.use(
  (resp) => resp,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      // keep any existing intent; just send user to login
      if (!localStorage.getItem('post_login_redirect')) {
        localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname }));
      }
      // Don't hard redirect here to avoid loops during background polling
    }
    return Promise.reject(error);
  }
);

// Debug logging helper - only logs in development
const debugLog = (...args) => {
  if (process.env.NODE_ENV === 'development') {
    console.log(...args);
  }
};

// Helper functions for Betika-style flow
const formatMoney = (n) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Generate unique bet ID
const generateBetId = () => {
  const a = Math.random().toString(36).slice(2, 9);
  const b = Math.random().toString(36).slice(2, 9);
  return `${Date.now()}-${a}${b}`;
};

const Aviator = () => {
  const [gameState, setGameState] = useState('waiting');
  const [multiplier, setMultiplier] = useState(1.00);
  const [betAmount, setBetAmount] = useState(10);
  const [balance, setBalance] = useState(0);
  const [isBetPlaced, setIsBetPlaced] = useState(false);
  const [gameHistory, setGameHistory] = useState([]);
  const [timeLeft, setTimeLeft] = useState(5);
  const [crashPoint, setCrashPoint] = useState(0);
  const [roundNumber, setRoundNumber] = useState(0);
  const [betHistory, setBetHistory] = useState([]);
  const [currentGame, setCurrentGame] = useState(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCashingOut, setIsCashingOut] = useState(false);
  const [hasLocalActiveBet, setHasLocalActiveBet] = useState(false);
  const [activeBets, setActiveBets] = useState([]);
  const [connectionStatus, setConnectionStatus] = useState('connected');
  const [pollingErrors, setPollingErrors] = useState(0);
  const [betSlips, setBetSlips] = useState([]); // Betika-style bet slips
  const [autoBet, setAutoBet] = useState(false);
  const [lastStake, setLastStake] = useState(10);
  const [lastCrashPoint, setLastCrashPoint] = useState(null);
  
  const gameInterval = useRef(null);
  const gameCheckInterval = useRef(null);
  const gameTimeout = useRef(null);
  const isRunningRef = useRef(false);
  const lastUpdateTime = useRef(0);
  const lastAnimTimeRef = useRef(0);
  const isBetPlacedRef = useRef(false);
  const hasLocalActiveBetRef = useRef(false);
  const gameStateRef = useRef('waiting');
  const pollingRetryCount = useRef(0);
  const maxPollingRetries = 5;
  const lastSuccessfulPoll = useRef(Date.now());
  const heartbeatInterval = useRef(null);
  const autoRefreshTimeout = useRef(null);
  const consecutiveErrors = useRef(0);
  const lastGameState = useRef('waiting');
  const lastRoundNumber = useRef(0);
  const periodicRefreshInterval = useRef(null);
  const lastCountdownUpdate = useRef(Date.now());
  const lastBetStateUpdate = useRef(Date.now());
  const countdownStartDetected = useRef(false);
  const previousTimeLeft = useRef(0);
  const countdownStartTimeout = useRef(null);
  const targetMultiplierRef = useRef(1.0);
  const animationFrameRef = useRef(null);
  const depositPollInterval = useRef(null);


  // API calls
  const fetchBalance = async () => {
    try {
      debugLog('Fetching balance from:', `${API_BASE_URL}/api/aviator/balance/`);
      const response = await axios.get(`${API_BASE_URL}/api/aviator/balance/`);
      debugLog('Balance response:', response.data);
      setBalance(response.data.balance);
    } catch (error) {
      console.error('Error fetching balance:', error);
      console.error('Error details:', error.response?.data);
      // If unauthorized or network error, default to 0 until login
      setBalance(0);
    }
  };

  const fetchCurrentGame = async (isRetry = false) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/api/aviator/realtime/`);
      const gameData = response.data;
      const backendStatus = gameData.status; // 'waiting' | 'active' | 'crashed'
      const effectivePhase = gameData.phase || (backendStatus === 'active' ? 'playing' : backendStatus);
      let didCrashThisTick = false;
      
      // Reset error counters on successful fetch
      setConnectionStatus('connected');
      setPollingErrors(0);
      pollingRetryCount.current = 0;
      lastSuccessfulPoll.current = Date.now();
      consecutiveErrors.current = 0;
      
      // Track game state changes for auto-refresh detection
      lastGameState.current = effectivePhase;
      lastRoundNumber.current = gameData.round_number;
      
      // Debug logging
      debugLog('Backend data:', {
        status: backendStatus,
        phase: gameData.phase,
        effectivePhase,
        time_remaining: gameData.time_remaining,
        round_number: gameData.round_number,
        current_multiplier: gameData.current_multiplier
      });
      
      // Check if this is a new round
      const isNewRound = gameData.round_number !== roundNumber;
      
      // Only update state if there are actual changes to prevent unnecessary re-renders
      if (gameData.round_number !== roundNumber) {
        setRoundNumber(gameData.round_number);
      }
      
      // Only update upcoming crash point when not showing a crash banner
      if (gameState !== 'crashed' && Number(gameData.crash_point) !== crashPoint) {
        setCrashPoint(Number(gameData.crash_point) || 1.5);
      }
      
      // Batch state updates to prevent multiple re-renders
      const stateUpdates = {};
      
      // Update game state only if it actually changed
      // PRIORITIZE crash event regardless of phase to ensure banner shows
      if (gameData.game_crashed && gameState !== 'crashed' && gameState !== 'loading_after_crash') {
        console.log('💥 Crash detected in fetchCurrentGame (prioritized):', gameData);
        stateUpdates.gameState = 'crashed';
        // Use the met crash value for the banner; do NOT overwrite with next round's crash point
        const crashedValue = gameData.crashed_at ?? gameData.previous_crash_point ?? gameData.crash_point;
        if (crashedValue) {
          const numericCrashedValue = Number(crashedValue);
          if (!Number.isNaN(numericCrashedValue) && numericCrashedValue > 0) {
            stateUpdates.multiplier = numericCrashedValue;
            stateUpdates.crashPoint = numericCrashedValue;
            setLastCrashPoint(numericCrashedValue);
          }
        }
        stateUpdates.isBetPlaced = false;
        stateUpdates.hasLocalActiveBet = false;
        if (gameData.round_number) {
          stateUpdates.roundNumber = gameData.round_number;
        }
        didCrashThisTick = true;
      } else if (effectivePhase === 'waiting') {
        // Transition to waiting state (backend controls the timing)
        if (gameState !== 'waiting') {
          debugLog('Transitioning to waiting state, time_remaining:', gameData.time_remaining);
          stateUpdates.gameState = 'waiting';
        }
        // Do not reset multiplier while UI is showing crashed state
        if (gameState !== 'crashed') {
        stateUpdates.multiplier = 1.00;
        }
        
        if (typeof gameData.time_remaining === 'number') {
          const newTimeLeft = Math.max(0, Math.ceil(gameData.time_remaining));
          if (newTimeLeft !== timeLeft) {
            debugLog('Updating countdown:', timeLeft, '->', newTimeLeft);
            // Avoid changing the countdown while showing crash; we'll refresh on transition
            if (gameState !== 'crashed') {
            stateUpdates.timeLeft = newTimeLeft;
              lastCountdownUpdate.current = Date.now();
            }
          }
        }
        
        if (isNewRound) {
          stateUpdates.isBetPlaced = false;
          stateUpdates.hasLocalActiveBet = false;
          // New round: clear any legacy active bets and mark previous-round active slips as lost
          setActiveBets([]);
          setBetSlips(prev => prev.map(slip => (
            slip.roundId !== gameData.round_number && slip.status === 'active'
              ? { ...slip, status: 'lost' }
              : slip
          )));
          
          // Auto-bet if enabled
          if (autoBet && lastStake >= 10 && balance >= lastStake) {
            setTimeout(() => {
              setBetAmount(lastStake);
              placeBet();
            }, 1000); // Small delay to ensure round is fully initialized
          }
        }
      } else if ((effectivePhase === 'playing' || effectivePhase === 'starting') && gameState !== 'playing') {
        stateUpdates.gameState = 'playing';
        if (typeof gameData.current_multiplier === 'number') {
          stateUpdates.multiplier = gameData.current_multiplier;
          targetMultiplierRef.current = gameData.current_multiplier;
        }
        // Do not update countdown during gameplay; countdown is only for waiting phase
        stateUpdates.timeLeft = 0;
        // Client-side safeguard: if live multiplier reaches or exceeds target crash point, show crash immediately
        const targetCrashPoint = Number(gameData.crash_point);
        if (!Number.isNaN(targetCrashPoint) && typeof gameData.current_multiplier === 'number') {
          if (gameData.current_multiplier >= targetCrashPoint) {
            stateUpdates.gameState = 'crashed';
            stateUpdates.multiplier = targetCrashPoint;
            stateUpdates.crashPoint = targetCrashPoint;
            stateUpdates.isBetPlaced = false;
            stateUpdates.hasLocalActiveBet = false;
            setLastCrashPoint(targetCrashPoint);
            didCrashThisTick = true;
          }
        }
      }
      
      // Apply all state updates at once
      Object.entries(stateUpdates).forEach(([key, value]) => {
        switch (key) {
          case 'gameState':
            setGameState(value);
            break;
          case 'multiplier':
            setMultiplier(value);
            break;
          case 'timeLeft':
            setTimeLeft(value);
            break;
          case 'isBetPlaced':
            setIsBetPlaced(value);
            break;
          case 'hasLocalActiveBet':
            setHasLocalActiveBet(value);
            break;
          case 'roundNumber':
            setRoundNumber(value);
            break;
          case 'crashPoint':
            setCrashPoint(value);
            break;
          case 'isLoading':
            setIsLoading(value);
            break;
          default:
            // No action needed for unknown keys
            break;
        }
      });
      
      // If crash just happened, refresh recent history immediately and retry shortly after
      if (didCrashThisTick) {
        try {
          await fetchGameHistory();
        } catch (e) {
          console.warn('Failed to refresh game history after crash:', e);
        }
        // Retry once after a short delay to ensure backend has persisted the crash
        setTimeout(() => {
          fetchGameHistory().catch((err) => console.warn('Retry history refresh after crash failed:', err));
        }, 800);
      }
      
      // Handle async operations after state updates
      if (effectivePhase === 'waiting' && isNewRound) {
        await checkActiveBet();
      } else if ((effectivePhase === 'playing' || effectivePhase === 'starting') && gameState !== 'playing') {
        await checkActiveBet();
      }
      
      // Update multiplier only during active gameplay to prevent flickering
      if (stateUpdates.gameState === 'playing' || effectivePhase === 'playing') {
        const now = Date.now();
        // Debounce updates to prevent rapid re-renders
        if (now - lastUpdateTime.current > 100) {
          // Only update if multiplier actually changed to prevent unnecessary re-renders
          if (typeof gameData.current_multiplier === 'number' && Math.abs(gameData.current_multiplier - multiplier) > 0.001) {
            setMultiplier(gameData.current_multiplier);
          }
          lastUpdateTime.current = now;
        }
      }
      
      return gameData;
    } catch (error) {
      console.error('Error fetching real-time game state:', error);
      
      // Handle connection errors
      setConnectionStatus('disconnected');
      setPollingErrors(prev => prev + 1);
      pollingRetryCount.current += 1;
      consecutiveErrors.current += 1;
      
      // Trigger auto-refresh after consecutive errors
      if (consecutiveErrors.current >= 3) {
        console.warn('🔄 Auto-refresh triggered due to consecutive errors');
        scheduleAutoRefresh();
      }
      
      // If we have too many errors, try to recover
      if (pollingRetryCount.current >= maxPollingRetries) {
        console.warn('Too many polling errors, attempting recovery...');
        setConnectionStatus('reconnecting');
        
        // Try to reinitialize the connection
        setTimeout(() => {
          pollingRetryCount.current = 0;
          setConnectionStatus('connected');
        }, 2000);
      }
      
      return null;
    }
  };

  const fetchGameHistory = async () => {
    try {
      debugLog('Fetching game history from:', `${API_BASE_URL}/api/aviator/game-history/`);
      const response = await axios.get(`${API_BASE_URL}/api/aviator/game-history/`);
      debugLog('Game history response:', response.data);
      debugLog('Game history response type:', typeof response.data);
      debugLog('Game history response length:', response.data?.length);
      
      // Ensure we extract numeric crash points and filter out invalid values
      const crashPoints = response.data
        .map(game => Number(game.crash_point))
        .filter(point => !isNaN(point) && point > 0);
      
      debugLog('Processed crash points:', crashPoints);
      setGameHistory(crashPoints);
    } catch (error) {
      console.error('Error fetching game history:', error);
      console.error('Error details:', error.response?.data);
      // Set empty array as fallback
      setGameHistory([]);
    }
  };

  const fetchBetHistory = async () => {
    try {
      debugLog('Fetching bet history from:', `${API_BASE_URL}/api/aviator/history/`);
      let response;
      try {
        response = await axios.get(`${API_BASE_URL}/api/aviator/history/`);
      } catch (e) {
        // Fallback for anonymous/testing
        response = await axios.get(`${API_BASE_URL}/api/aviator/history-public/?user_id=player_1`);
      }
      debugLog('Bet history response:', response.data);
      setBetHistory(response.data);
    } catch (error) {
      console.error('Error fetching bet history:', error);
      console.error('Error details:', error.response?.data);
    }
  };

  // Check if user has an active bet in the current round - simplified to prevent blinking
  const checkActiveBet = async () => {
    // Only check on new rounds or when explicitly needed
    if (gameState === 'playing' && hasLocalActiveBetRef.current) {
      // Don't check during active gameplay to prevent button blinking
      return true;
    }
    
    try {
      const response = await axios.get(`${API_BASE_URL}/api/aviator/check-active-bet/?user_id=player_1&round_number=${roundNumber}`);
      const hasActiveBet = response.data.has_active_bet;
      setIsBetPlaced(hasActiveBet);
      if (hasActiveBet) {
        setHasLocalActiveBet(true);
      } else if (gameState !== 'playing') {
        setHasLocalActiveBet(false);
      }
      lastBetStateUpdate.current = Date.now();
      return hasActiveBet;
    } catch (error) {
      console.error('Error checking active bet:', error);
      // Don't change state on errors during gameplay
      if (gameState !== 'playing') {
        setIsBetPlaced(false);
        setHasLocalActiveBet(false);
        return false;
      }
      return hasLocalActiveBetRef.current;
    }
  };

  // Place bet - Betika-style with bet slips
  const placeBet = async () => {
    // Validate bet placement conditions
    if (gameState !== 'waiting') {
      setError('Bets can only be placed before takeoff');
      return;
    }
    if (!(timeLeft > 0)) {
      setError('Bets can only be placed during the countdown');
      return;
    }
    
    if (balance < betAmount) {
      setError('Insufficient balance');
      return;
    }
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/aviator/place-bet/`, {
        amount: betAmount,
        user_id: 'player_1'  // Simple user ID for anonymous betting
      });
      
      setBalance(response.data.balance);
      setError(null);
      
      // Create bet slip for Betika-style display
      const betSlip = {
        id: response.data?.bet?.id || generateBetId(),
        roundId: roundNumber,
        stake: betAmount,
        status: 'active',
        placedAt: Date.now(),
        cashedAt: null,
        cashoutOdds: null,
        winAmount: null,
        backendBetId: response.data?.bet?.id
      };
      
      setBetSlips(prev => [betSlip, ...prev]);
      setLastStake(betAmount);
      
      // Update legacy bet state for compatibility
      setIsBetPlaced(true);
      setHasLocalActiveBet(true);
      if (response.data?.bet?.id) {
        setActiveBets((prev) => [{ id: response.data.bet.id, amount: Number(response.data.bet.amount) }, ...prev]);
      }
      
      // Verify the bet was placed successfully
      const hasActiveBet = await checkActiveBet();
      if (!hasActiveBet) {
        setIsBetPlaced(false);
      }
    } catch (error) {
      const status = error?.response?.status;
      if (status === 401 || status === 403) {
        localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'placeBet', payload: { stake: betAmount } }));
        window.location.href = '/login';
        return;
      }
      setError(error?.response?.data?.error || error?.message || 'Failed to place bet');
      console.error('Error placing bet:', error);
      // Ensure bet state is false if placement failed
      setIsBetPlaced(false);
      setHasLocalActiveBet(false);
    }
  };

  // Cashout - Betika-style with bet slips
  const cashout = async (specificBetId = null) => {
    // Prevent multiple rapid clicks
    if (isCashingOut) {
      return;
    }
    
    // Validate cashout conditions
    if (gameState !== 'playing') {
      setError('Can only cashout during active gameplay');
      return;
    }
    
    setIsCashingOut(true);
    
    try {
      const response = await axios.post(`${API_BASE_URL}/api/aviator/cashout/`, {
        round_number: roundNumber,
        multiplier: multiplier,
        user_id: 'player_1',  // Simple user ID for anonymous betting
        bet_id: specificBetId
      });
      
      setBalance(response.data.balance);
      setError(null);
      
      // Update bet slip status
      if (specificBetId) {
        setBetSlips(prev => prev.map(slip => {
          if (slip.id === specificBetId || slip.backendBetId === specificBetId) {
            return {
              ...slip,
              status: 'cashed',
              cashedAt: Date.now(),
              cashoutOdds: multiplier,
              winAmount: Math.round(slip.stake * multiplier * 100) / 100
            };
          }
          return slip;
        }));
      }
      
      // Update legacy bet state
      if (response.data?.bet?.id) {
        setActiveBets((prev) => prev.filter(b => b.id !== response.data.bet.id));
      }
      const remaining = activeBets.length - 1;
      setIsBetPlaced(remaining > 0);
      setHasLocalActiveBet(remaining > 0);
      setBetHistory(prev => [response.data.bet, ...prev.slice(0, 19)]);
      
      // Refresh balance to ensure it's up to date
      await fetchBalance();
      
      // Verify bet state was updated
      await checkActiveBet();
    } catch (error) {
      setError(error.response?.data?.error || 'Failed to cashout');
      console.error('Error cashing out:', error);
    } finally {
      setIsCashingOut(false);
    }
  };


  // Bet controls
  const doubleBet = () => {
    if (balance >= betAmount * 2) {
      setBetAmount(prev => prev * 2);
    }
  };

  const halfBet = () => {
    setBetAmount(prev => Math.max(1, Math.floor(prev / 2)));
  };

  const resetBet = () => {
    setBetAmount(10);
  };

  const addChip = (amount) => {
    setBetAmount(prev => {
      const next = Math.max(1, prev + amount);
      return Math.min(next, balance);
    });
  };
  
  const setMaxBet = () => {
    setBetAmount(Math.max(1, Math.floor(balance)));
  };
  
  const clearBet = () => {
    setBetAmount(1);
  };
  
  // Handle cashout for specific bet slip
  const handleBetSlipCashout = async (betSlipId) => {
    const betSlip = betSlips.find(slip => slip.id === betSlipId);
    if (!betSlip || betSlip.status !== 'active') return;
    
    await cashout(betSlip.backendBetId || betSlipId);
  };

  // Auto-bet functionality
  const handleAutoBetToggle = (enabled) => {
    setAutoBet(enabled);
  };

  // Manual refresh function for recovery
  const manualRefresh = async () => {
    console.log('🔄 Manual refresh triggered');
    setConnectionStatus('reconnecting');
    setIsLoading(true);
    
    try {
      // Force refresh all data
      await Promise.all([
        fetchBalance(),
        fetchCurrentGame(),
        fetchGameHistory(),
        fetchBetHistory()
      ]);
      
      // Check for active bet
      if (roundNumber > 0) {
        await checkActiveBet();
      }
      
      setConnectionStatus('connected');
      setPollingErrors(0);
      pollingRetryCount.current = 0;
      consecutiveErrors.current = 0;
      console.log('✅ Manual refresh completed successfully');
    } catch (error) {
      console.error('❌ Manual refresh failed:', error);
      setConnectionStatus('disconnected');
    } finally {
      setIsLoading(false);
    }
  };

  // Wallet actions
  const [walletAmount, setWalletAmount] = useState('');
  const handleDeposit = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'deposit', payload: { amount: walletAmount } }));
      window.location.href = '/login';
      return;
    }
    try {
      if (!walletAmount) {
        setError('Enter an amount first');
        return;
      }
      const prevBalance = balance;
      // Initiate STK Push via M-Pesa integration
      await axios.get(`${API_BASE_URL}/api/mpesa/stkpush/`, { params: { amount: walletAmount } });
      setSuccess('STK Push initiated. Enter your M-Pesa PIN to complete the payment. Your balance will update automatically once confirmed.');
      // Begin short polling for updated balance after confirmation
      if (depositPollInterval.current) clearInterval(depositPollInterval.current);
      let polls = 0;
      depositPollInterval.current = setInterval(async () => {
        try {
          await fetchBalance();
          polls += 1;
          if (balance > prevBalance || polls >= 40) { // up to ~120s at 3s interval
            clearInterval(depositPollInterval.current);
          }
        } catch (e) {
          polls += 1;
          if (polls >= 40) {
            clearInterval(depositPollInterval.current);
          }
        }
      }, 3000);
    } catch (e) {
      console.error('Deposit failed', e);
      if (e?.response?.status === 401) {
        localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'deposit', payload: { amount: walletAmount } }));
        window.location.href = '/login';
        return;
      }
      setError(e?.response?.data?.error || 'Deposit failed. Please try again.');
    }
  };
  const handleWithdraw = async () => {
    const accessToken = localStorage.getItem('access_token');
    if (!accessToken) {
      localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'withdraw', payload: { amount: walletAmount } }));
      window.location.href = '/login';
      return;
    }
    try {
      const response = await axios.post(`${API_BASE_URL}/api/aviator/withdraw/`, { amount: walletAmount });
      setBalance(response.data.balance);
      setSuccess('Your withdrawal request has been received. Please note that due to high withdrawal activity today, processing may take a little longer than usual. Rest assured, your funds will be credited immediately once processing is complete. Thank you for your patience.');
    } catch (e) {
      console.error('Withdraw failed', e);
      if (e?.response?.status === 401) {
        localStorage.setItem('post_login_redirect', JSON.stringify({ path: window.location.pathname, action: 'withdraw', payload: { amount: walletAmount } }));
        window.location.href = '/login';
        return;
      }
      setError(e?.response?.data?.error || 'Withdraw failed. Please try again.');
    }
  };

  // Automatic refresh scheduling function
  const scheduleAutoRefresh = () => {
    // Clear any existing auto-refresh timeout
    if (autoRefreshTimeout.current) {
      clearTimeout(autoRefreshTimeout.current);
    }
    
    // Schedule auto-refresh after a short delay to avoid rapid refreshes
    autoRefreshTimeout.current = setTimeout(() => {
      console.log('🔄 Auto-refresh executing...');
      manualRefresh();
    }, 2000); // 2 second delay
  };

  // Aggressive auto-refresh detection
  const checkForAutoRefresh = () => {
    const now = Date.now();
    const timeSinceLastPoll = now - lastSuccessfulPoll.current;
    const timeSinceCountdownUpdate = now - lastCountdownUpdate.current;
    const timeSinceBetStateUpdate = now - lastBetStateUpdate.current;
    
    // Auto-refresh conditions (more aggressive):
    // 1. No successful polls for 8+ seconds (reduced from 15)
    // 2. Countdown not updating for 5+ seconds during waiting state
    // 3. Bet state not updating for 10+ seconds
    // 4. Game state seems stuck
    
    if (timeSinceLastPoll > 8000) {
      console.warn('🔄 Auto-refresh: No successful polls for 8+ seconds');
      scheduleAutoRefresh();
      return;
    }
    
    // Check if countdown is stuck during waiting state
    if (gameStateRef.current === 'waiting' && timeSinceCountdownUpdate > 5000) {
      console.warn('🔄 Auto-refresh: Countdown stuck during waiting state (state:', gameStateRef.current, ')');
      scheduleAutoRefresh();
      return;
    }
    
    // Check if bet state is stuck
    if (timeSinceBetStateUpdate > 10000) {
      console.warn('🔄 Auto-refresh: Bet state not updating');
      scheduleAutoRefresh();
      return;
    }
    
    // Check if game state is stuck
    if (gameStateRef.current === 'playing' && timeSinceLastPoll > 6000) {
      console.warn('🔄 Auto-refresh: Game state stuck in playing mode');
      scheduleAutoRefresh();
      return;
    }
    
    // Check if we're in waiting state for too long (should transition to playing)
    if (gameStateRef.current === 'waiting' && timeSinceLastPoll > 8000) {
      console.warn('🔄 Auto-refresh: Stuck in waiting state too long');
      scheduleAutoRefresh();
      return;
    }
  };

  // Periodic auto-refresh to prevent any stuck states
  const startPeriodicAutoRefresh = () => {
    if (periodicRefreshInterval.current) {
      clearInterval(periodicRefreshInterval.current);
    }
    
    // Auto-refresh every 30 seconds as a safety net
    periodicRefreshInterval.current = setInterval(() => {
      console.log('🔄 Periodic auto-refresh triggered (safety net)');
      scheduleAutoRefresh();
    }, 30000); // 30 seconds
  };

  // Detect countdown start and trigger auto-refresh
  const detectCountdownStart = () => {
    // Clear any existing timeout
    if (countdownStartTimeout.current) {
      clearTimeout(countdownStartTimeout.current);
    }

    // Check if countdown just started (transitioned from 0 or undefined to a positive number)
    // OR if we're in a new round and countdown is starting
    const isNewCountdown = gameState === 'waiting' && timeLeft > 0 && previousTimeLeft.current === 0;
    const isNewRoundCountdown = gameState === 'waiting' && timeLeft > 0 && roundNumber > lastRoundNumber.current;
    
    if (isNewCountdown || isNewRoundCountdown) {
      console.log('🚀 Countdown started detected! Auto-refreshing game state...', {
        isNewCountdown,
        isNewRoundCountdown,
        timeLeft,
        previousTimeLeft: previousTimeLeft.current,
        roundNumber,
        lastRoundNumber: lastRoundNumber.current
      });
      countdownStartDetected.current = true;
      
      // Trigger auto-refresh immediately when countdown starts
      scheduleAutoRefresh();
      
      // Also set a small delay to ensure the refresh happens after countdown is fully initialized
      countdownStartTimeout.current = setTimeout(() => {
        console.log('🔄 Countdown start auto-refresh executing...');
        manualRefresh();
      }, 1000); // 1 second delay to ensure countdown is stable
    }
    
    // Update previous time left for next comparison
    previousTimeLeft.current = timeLeft;
  };
  


  // Handle game crash
  const handleGameCrash = useCallback(async () => {
    console.log('🚨 Game crashed - handling crash state');
    
    // Reset bet state when game crashes
    setIsBetPlaced(false);
    setHasLocalActiveBet(false);
    isBetPlacedRef.current = false;
    hasLocalActiveBetRef.current = false;
    // Clear legacy active bets list so nothing remains active visually
    setActiveBets([]);

    // Mark any still-active local bet slips as lost on crash
    setBetSlips(prev => prev.map(slip => (
      slip.status === 'active'
        ? { ...slip, status: 'lost' }
        : slip
    )));
    
    // Refresh bet history from backend to reflect losses
    try {
      await fetchBetHistory();
    } catch (e) {
      console.warn('Failed to refresh bet history on crash:', e);
    }
    
    // Optionally prefetch latest state so we have fresh round/crash info ready
    try {
      await fetchCurrentGame();
    } catch (error) {
      console.error('Error prefetching game after crash:', error);
    }

    console.log('✅ Crash handling complete - bets marked lost, awaiting next round');
  }, [isBetPlaced, roundNumber, crashPoint]);

  // Effects - handle crash state transition (show crash then transition)
  useEffect(() => {
    if (gameState === 'crashed') {
      console.log('🔄 Processing crash state - will transition to loading after 2 seconds');
      // Immediately mark any active bet as lost
      try {
        handleGameCrash();
      } catch (e) {
        console.error('Error while handling crash state updates:', e);
      }
      
      // Show crash for ~3s, then move to waiting and let backend drive countdown
      const crashTimeout = setTimeout(() => {
        console.log('✅ Transitioning from crashed to waiting state (backend countdown)');
    setGameState('waiting');
    setMultiplier(1.00);
        // Fetch latest state and refresh recent results to include last crash
        fetchCurrentGame().catch((error) => {
          console.error('Error fetching game state after crash transition:', error);
        });
        fetchGameHistory().catch((error) => {
          console.warn('Error refreshing game history after crash transition:', error);
        });
      }, 3000);

      return () => clearTimeout(crashTimeout);
    }
  }, [gameState]);

  // Effects - handle loading after crash transition
  useEffect(() => {
    if (gameState === 'loading_after_crash') {
      console.log('🔄 Processing crash loading state...');
      
      // Set a timeout to transition from loading to waiting state
      const transitionTimeout = setTimeout(() => {
        console.log('✅ Transitioning from loading to waiting state');
        console.log('Current gameState before transition:', gameState);
        setIsLoading(false); // Set loading to false first
        setGameState('waiting'); // Then transition to waiting
        console.log('Loading set to false, game state set to waiting');
        
        // Force a fresh fetch to get the latest game state
        setTimeout(() => {
          console.log('Fetching fresh game state after transition...');
          fetchCurrentGame().catch((error) => {
            console.error('Error fetching game state after crash transition:', error);
          });
        }, 100); // Small delay to ensure state updates
      }, 1500); // 1.5 second loading state
      
      return () => clearTimeout(transitionTimeout);
    }
  }, [gameState]);



  // Only check bet state when game becomes active, not during gameplay
  useEffect(() => {
    if (gameState === 'playing') {
      // Check bet state only once when game becomes active
      const immediateCheck = async () => {
        await checkActiveBet();
      };
      immediateCheck();
    }
  }, [gameState]);

  // Auto-refresh when countdown gets stuck
  useEffect(() => {
    if (gameState === 'waiting' && timeLeft > 0) {
      // Set a timeout to check if countdown is stuck
      const countdownCheck = setTimeout(() => {
        const now = Date.now();
        const timeSinceCountdownUpdate = now - lastCountdownUpdate.current;
        
        // If countdown hasn't updated for 3+ seconds, trigger auto-refresh
        if (timeSinceCountdownUpdate > 3000) {
          console.warn('🔄 Auto-refresh: Countdown appears stuck, triggering refresh');
          scheduleAutoRefresh();
        }
      }, 4000); // Check after 4 seconds
      
      return () => clearTimeout(countdownCheck);
    }
  }, [gameState, timeLeft]);

  // Monitor countdown changes and detect when it starts
  useEffect(() => {
    detectCountdownStart();
  }, [gameState, timeLeft]);

  // Reset countdown detection when game state changes
  useEffect(() => {
    if (gameState !== 'waiting') {
      countdownStartDetected.current = false;
      previousTimeLeft.current = 0;
      if (countdownStartTimeout.current) {
        clearTimeout(countdownStartTimeout.current);
      }
    }
  }, [gameState]);

  // Keep a ref in sync with the state to make race-free decisions during polling
  useEffect(() => {
    isBetPlacedRef.current = isBetPlaced;
  }, [isBetPlaced]);

  useEffect(() => {
    hasLocalActiveBetRef.current = hasLocalActiveBet;
  }, [hasLocalActiveBet]);

  useEffect(() => {
    gameStateRef.current = gameState;
  }, [gameState]);

  useEffect(() => {
    return () => {
      if (gameInterval.current) clearInterval(gameInterval.current);
      if (gameCheckInterval.current) clearInterval(gameCheckInterval.current);
      if (gameTimeout.current) clearTimeout(gameTimeout.current);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, []);

  // Initialize and periodic updates
  useEffect(() => {
    debugLog('Aviator component mounted - starting initialization');
    setIsLoading(true);
    
    const initializeComponent = async () => {
      try {
        debugLog('Starting API calls...');
        await Promise.all([
          fetchBalance(),
          fetchCurrentGame().catch(() => undefined),
          fetchGameHistory(),
          fetchBetHistory()
        ]);
        
        // Check for active bet after getting current game
        if (roundNumber > 0) {
          await checkActiveBet();
        }
        
        debugLog('All API calls completed - server connected');
      } catch (error) {
        console.error('Error during initialization:', error);
      } finally {
        setIsLoading(false);
        debugLog('Component initialization complete - ready for countdown');
      }
    };
    
    initializeComponent();
    
    // Poll backend for real-time updates - this will handle countdown automatically
    if (gameCheckInterval.current) clearInterval(gameCheckInterval.current);
    
    // Enhanced polling function with better error handling
    const pollForUpdates = async () => {
      try {
        // Always poll, even during crash loading state, but with reduced frequency
        const pollInterval = gameStateRef.current === 'loading_after_crash' ? 1000 : 500;
        
        debugLog('Polling backend for updates...', 'State:', gameStateRef.current);
        const gameData = await fetchCurrentGame();
        
        // If we got data, continue normal polling
        if (gameData) {
          // Reset any error states
          setConnectionStatus('connected');
          setPollingErrors(0);
        }
      } catch (error) {
        console.error('Polling error:', error);
        // Don't stop polling on errors - keep trying
      }
    };
    
    // Start polling immediately
    pollForUpdates();
    
    // Set up interval for continuous polling with exponential backoff on errors
    const setupPolling = () => {
    if (gameCheckInterval.current) clearInterval(gameCheckInterval.current);
      
      // Adjust polling frequency based on connection status
      const pollFrequency = connectionStatus === 'disconnected' ? 2000 : 500;
      
      gameCheckInterval.current = setInterval(pollForUpdates, pollFrequency);
    };
    
    setupPolling();
    
    // Re-setup polling when connection status changes
    const statusCheckInterval = setInterval(() => {
      if (gameCheckInterval.current) {
        const currentFrequency = connectionStatus === 'disconnected' ? 2000 : 500;
        // Only restart if frequency needs to change
        if (pollingErrors > 3 && currentFrequency === 500) {
          setupPolling();
        }
      }
    }, 5000);
    
    // Heartbeat monitoring - check if we haven't received updates for too long
    heartbeatInterval.current = setInterval(() => {
      // Use the aggressive auto-refresh detection
      checkForAutoRefresh();
    }, 2000); // Check every 2 seconds (more frequent)
    
    // Start periodic auto-refresh as a safety net
    startPeriodicAutoRefresh();
    
    return () => {
      debugLog('Cleaning up Aviator component');
      if (gameCheckInterval.current) clearInterval(gameCheckInterval.current);
      if (statusCheckInterval) clearInterval(statusCheckInterval);
      if (heartbeatInterval.current) clearInterval(heartbeatInterval.current);
      if (periodicRefreshInterval.current) clearInterval(periodicRefreshInterval.current);
      if (autoRefreshTimeout.current) clearTimeout(autoRefreshTimeout.current);
      if (countdownStartTimeout.current) clearTimeout(countdownStartTimeout.current);
    };
  }, []); // Removed gameState dependency

  // Smooth multiplier animation toward backend target during playing state
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      lastAnimTimeRef.current = 0;
      return;
    }

    let isCancelled = false;

    const animate = (timestamp) => {
      if (isCancelled || gameStateRef.current !== 'playing') return;
      if (!lastAnimTimeRef.current) lastAnimTimeRef.current = timestamp;
      const dtMs = timestamp - lastAnimTimeRef.current;
      lastAnimTimeRef.current = timestamp;

      const crashCap = Number(crashPoint) > 0 ? Number(crashPoint) : Infinity;
      const backendTarget = Math.min(targetMultiplierRef.current || 1.0, crashCap);

      // Increase at 0.05 per second to match backend
      const increment = 0.05 * (dtMs / 1000);
      const nextVal = Math.min(backendTarget, multiplier + increment);

      if (nextVal !== multiplier) {
        setMultiplier(nextVal);
      }

      // If we've reached the crash cap, let the normal crash handling flip state
      if (nextVal >= crashCap && Number.isFinite(crashCap)) {
        // no-op here; backend/client safeguard will set crashed
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => {
      isCancelled = true;
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [gameState, crashPoint, multiplier]);

  debugLog('Rendering Aviator component, gameState:', gameState, 'timeLeft:', timeLeft, 'isLoading:', isLoading, 'hasLocalActiveBet:', hasLocalActiveBet, 'isBetPlaced:', isBetPlaced, 'crashLoading:', gameState === 'loading_after_crash');
  
  if (isLoading) {
      const isCrashLoading = gameState === 'loading_after_crash';
    return (
      <div className="aviator-container">
        <div className="loading-state">
            <h2>{isCrashLoading ? 'Game Crashed!' : 'Loading Aviator Game...'}</h2>
            <div className="loading-spinner">{isCrashLoading ? '💥' : '⏳'}</div>
            <p>{isCrashLoading ? 'Preparing next round...' : 'Connecting to backend...'}</p>
        </div>
      </div>
    );
  }

  // Waiting duration used for countdown progress (seconds)
  const WAIT_DURATION = 10;
  const countdownPercent = Math.max(0, Math.min(100, Math.round((timeLeft / WAIT_DURATION) * 100)));
  const cylShouldExplode = gameState === 'crashed';

  return (
    <div className="aviator-container">
      <div className="aviator-header">
        <h1>Aviator</h1>
        <div className="header-info">
        <div className="balance-display">
            Balance: Ksh {balance.toFixed(2)}
          </div>
          <div className="header-controls">
            <div className={`connection-indicator ${connectionStatus}`}>
              <span className="connection-dot"></span>
              {connectionStatus === 'connected' ? 'Live' : 
               connectionStatus === 'disconnected' ? 'Reconnecting...' : 
               connectionStatus === 'reconnecting' ? 'Reconnecting...' : 'Unknown'}
            </div>
            <button 
              onClick={manualRefresh} 
              className="refresh-btn"
              disabled={isLoading}
              title="Refresh game state"
              type="button"
            >
              🔄
            </button>
          </div>
          <div className="wallet-controls">
            <button type="button" onClick={(e) => { e.preventDefault(); handleWithdraw(); }} className="wallet-btn outline" disabled={!walletAmount}>Withdraw</button>
            <input
              type="number"
              min="1"
              placeholder="Enter amount"
              value={walletAmount}
              onChange={(e) => {
                const v = e.target.value;
                if (v === '' || Number(v) >= 1) {
                  setWalletAmount(v);
                }
              }}
              className="wallet-input"
            />
          </div>
        </div>
      </div>

      {error && (
        <div className="error-message">
          <strong>Error:</strong> {error}
          <button onClick={() => setError(null)} className="error-close">×</button>
        </div>
      )}
      {success && (
        <div className="success-message">
          {success}
          <button onClick={() => setSuccess(null)} className="error-close">×</button>
        </div>
      )}


      {/* debug-info removed per request */}

      <div className="game-area">
        <div className="multiplier-display">
          <AnimatePresence mode="wait">
            {gameState === 'waiting' && (
              <motion.div
                key="waiting"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="waiting-state"
              >
                <div className="game-display">
                  <div className="aviator-plane-container">
                    {/* Cylindrical countdown bar within lane */}
                    <div className="cyl-progress-wrap" aria-label="Round countdown">
                      <div className={`cyl-progress ${cylShouldExplode ? 'explode' : ''}`}>
                        <div className="cyl-core"></div>
                        <div className="cyl-fill" style={{ width: `${countdownPercent}%` }}></div>
                        <div className="cyl-gloss"></div>
                        <div className="cyl-ends cyl-left"></div>
                        <div className="cyl-ends cyl-right"></div>
                      </div>
                      <div className="cyl-timer-label">{timeLeft}s</div>
                    </div>
                    <div className={`aviator-plane waiting`}>
                      ✈️
                    </div>
                  </div>
                  <h2>Next game in {timeLeft}s</h2>
                  <div className="countdown-circle">
                    <span className="countdown-number">{timeLeft}</span>
                  </div>
                  <div className="round-info">Round #{roundNumber}</div>
                </div>
              </motion.div>
            )}
            
            {gameState === 'playing' && (
              <motion.div
                key="playing"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="playing-state"
              >
                <div className="game-display">
                  <div className="aviator-plane-container">
                    <div className={`aviator-plane flying`}>
                      ✈️
                    </div>
                  </div>
                  <div className="multiplier-value">
                    {multiplier.toFixed(2)}x
                  </div>
                  <div className="game-status">Flying!</div>
                  <div className="round-info">Round #{roundNumber}</div>
                </div>
              </motion.div>
            )}
            
            {gameState === 'crashed' && (
              <motion.div
                key="crashed"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="crashed-state"
              >
                <div className="game-display crashed-anim">
                  <div className="aviator-plane-container">
                    <div className={`aviator-plane crashed`}>
                      💥
                    </div>
                  </div>
                  <h2 className="crash-text animated">CRASHED AT {Number((lastCrashPoint ?? crashPoint) || multiplier).toFixed(2)}x</h2>
                  <div className="crash-burst" aria-hidden="true">
                    <span></span><span></span><span></span><span></span><span></span>
                  </div>
                  <div className="game-status">Game Over!</div>
                  <div className="round-info">Round #{roundNumber}</div>
                  <div className="backend-info">
                    <small>Predetermined crash point from backend</small>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Betika-style Betting Panel */}
        <div className="betting-panel">
          <div className="betting-controls-section">
            <div className="balance-section">
              <div className="balance-label">Balance</div>
              <div className="balance-amount">Ksh {formatMoney(balance)}</div>
          </div>
          
            <div className="stake-section">
              <div className="stake-label">Stake</div>
              <div className="stake-input-group">
            <input
              type="number"
              value={betAmount}
                  min="10"
              max={balance}
                  disabled={!(gameState === 'waiting' && timeLeft > 0)}
                  onChange={(e) => setBetAmount(Math.max(10, parseInt(e.target.value) || 10))}
                  className="stake-input"
            />
                <button onClick={setMaxBet} disabled={!(gameState === 'waiting' && timeLeft > 0)} className="max-btn">MAX</button>
          </div>
              <div className="stake-limits">
                <span>Min: Ksh 10</span>
                <span>Max: Ksh {formatMoney(balance)}</span>
          </div>
              </div>
            
              <button 
              type="button"
              onClick={(e) => { e.preventDefault(); placeBet(); }}
              disabled={gameState !== 'waiting' || timeLeft <= 0 || betAmount < 10 || betAmount > balance}
              className={`place-bet-main-btn ${gameState === 'waiting' && timeLeft > 0 ? 'active' : 'disabled'}`}
            >
              {gameState === 'waiting' && timeLeft > 0 ? 'Bet' : 'Bet (locked)'}
              </button>

            <div className="auto-bet-section">
              <label className="auto-bet-label">
                <input 
                  type="checkbox" 
                  checked={autoBet} 
                  onChange={(e) => handleAutoBetToggle(e.target.checked)}
                />
                Auto-Bet (next round)
              </label>
              {!autoBet && (
                <div className="auto-bet-note">Will NOT auto-place on next round</div>
              )}
            </div>
          </div>

          {/* Bet Slips Section */}
          <div className="bet-slips-section">
            <div className="bet-slips-header">
              <h3>Your Bets</h3>
              <div className="active-count">Active: {betSlips.filter(slip => slip.status === 'active').length}</div>
              </div>

            {betSlips.length === 0 ? (
              <div className="no-bets-message">Place a bet before takeoff to see it here.</div>
            ) : (
              <div className="bet-slips-list">
                {betSlips.map((slip) => (
                  <div key={slip.id} className={`bet-slip ${slip.status}`}>
                    <div className="bet-slip-info">
                      <div className="bet-stake">Stake: <span className="stake-amount">Ksh {formatMoney(slip.stake)}</span></div>
                      <div className="bet-details">Bet #{String(slip.id).slice(0, 8)} • Round #{slip.roundId}</div>
                    </div>

                    <div className="bet-slip-actions">
                      {slip.status === 'active' && (
                        <>
                          <div className="potential-win">Potential: Ksh {formatMoney(slip.stake * multiplier)}</div>
                    <button
                            type="button"
                            onClick={() => handleBetSlipCashout(slip.id)}
                      disabled={gameState !== 'playing' || isCashingOut}
                            className={`cashout-btn ${gameState === 'playing' ? 'active' : 'disabled'}`}
                    >
                            Cashout @ {multiplier.toFixed(2)}x
                    </button>
                        </>
                      )}
                      {slip.status === 'cashed' && (
                        <div className="cashed-info">
                          <div className="cashout-odds">Cashed @ {slip.cashoutOdds?.toFixed(2)}x</div>
                          <div className="win-amount">+ Ksh {formatMoney(slip.winAmount)}</div>
              </div>
            )}
                      {slip.status === 'lost' && (
                        <div className="lost-info">
                          <div className="lost-label">Lost</div>
                          <div className="lost-amount">- Ksh {formatMoney(slip.stake)}</div>
          </div>
              )}
            </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          </div>
        </div>

      {/* Recent Results */}
      <div className="game-history">
        <h3>Recent Results</h3>
        {gameHistory.length === 0 ? (
          <div className="history-empty">
            <p>No game history yet</p>
            <small>Games will appear here after they crash</small>
          </div>
        ) : (
          <div className="history-grid">
            {gameHistory.map((result, index) => {
              const numericResult = Number(result) || 1.0;
              return (
                <div
                  key={index}
                  className={`history-item ${numericResult >= 2 ? 'green' : numericResult >= 1.5 ? 'orange' : 'red'}`}
                >
                  {numericResult.toFixed(2)}x
                </div>
              );
            })}
          </div>
        )}
      </div>

    </div>
  );
};

export default Aviator;
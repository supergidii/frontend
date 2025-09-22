import React, { useState } from 'react';
import axios from 'axios';
import './BetSlip.css';

function BetSlip() {
  const [bets, setBets] = useState([
    {
      id: 1,
      match: {
        home_team: { name: 'Manchester United' },
        away_team: { name: 'Liverpool FC' }
      },
      bet_type: 'home_win',
      odds: 2.0,
      amount: 0
    }
  ]);
  const [totalStake, setTotalStake] = useState(0);
  const [potentialWinnings, setPotentialWinnings] = useState(0);

  const updateBetAmount = (betId, amount) => {
    const updatedBets = bets.map(bet => 
      bet.id === betId ? { ...bet, amount: parseFloat(amount) || 0 } : bet
    );
    setBets(updatedBets);
    
    // Calculate totals
    const total = updatedBets.reduce((sum, bet) => sum + bet.amount, 0);
    const winnings = updatedBets.reduce((sum, bet) => sum + (bet.amount * bet.odds), 0);
    
    setTotalStake(total);
    setPotentialWinnings(winnings);
  };

  const removeBet = (betId) => {
    setBets(bets.filter(bet => bet.id !== betId));
  };

  const placeBets = async () => {
    try {
      // Place each bet
      for (const bet of bets) {
        if (bet.amount > 0) {
          await axios.post('/api/place-bet/', {
            match_id: bet.match.id,
            bet_type: bet.bet_type,
            amount: bet.amount
          });
        }
      }
      
      alert('Bets placed successfully!');
      setBets([]);
      setTotalStake(0);
      setPotentialWinnings(0);
    } catch (error) {
      console.error('Error placing bets:', error);
      alert('Error placing bets. Please try again.');
    }
  };

  const getBetTypeLabel = (betType) => {
    switch (betType) {
      case 'home_win': return 'Home Win';
      case 'draw': return 'Draw';
      case 'away_win': return 'Away Win';
      default: return betType;
    }
  };

  return (
    <div className="bet-slip">
      <h1>Bet Slip</h1>
      
      {bets.length === 0 ? (
        <div className="empty-bet-slip">
          <p>No bets selected</p>
          <p>Go to Matches to select your bets</p>
        </div>
      ) : (
        <>
          <div className="bets-list">
            {bets.map(bet => (
              <div key={bet.id} className="bet-item">
                <div className="bet-header">
                  <div className="match-info">
                    <span className="team">{bet.match.home_team.name}</span>
                    <span className="vs">vs</span>
                    <span className="team">{bet.match.away_team.name}</span>
                  </div>
                  <button 
                    className="remove-btn"
                    onClick={() => removeBet(bet.id)}
                  >
                    ×
                  </button>
                </div>
                
                <div className="bet-details">
                  <span className="bet-type">{getBetTypeLabel(bet.bet_type)}</span>
                  <span className="odds">Odds: {bet.odds}</span>
                </div>
                
                <div className="bet-amount">
                  <label>Stake:</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={bet.amount}
                    onChange={(e) => updateBetAmount(bet.id, e.target.value)}
                    placeholder="Enter amount"
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="bet-summary">
            <div className="summary-item">
              <span>Total Stake:</span>
              <span>${totalStake.toFixed(2)}</span>
            </div>
            <div className="summary-item">
              <span>Potential Winnings:</span>
              <span>${potentialWinnings.toFixed(2)}</span>
            </div>
          </div>
          
          <button 
            className="place-bet-btn"
            onClick={placeBets}
            disabled={totalStake === 0}
          >
            Place Bets
          </button>
        </>
      )}
    </div>
  );
}

export default BetSlip; 
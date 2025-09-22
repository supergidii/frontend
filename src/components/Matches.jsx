import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Matches.css';

function Matches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBets, setSelectedBets] = useState([]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const response = await axios.get('/api/matches/');
        setMatches(response.data);
      } catch (error) {
        console.error('Error fetching matches:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchMatches();
  }, []);

  const addToBetSlip = (match, betType, odds) => {
    const newBet = {
      match_id: match.id,
      match: match,
      bet_type: betType,
      odds: odds,
      amount: 0
    };
    
    setSelectedBets([...selectedBets, newBet]);
  };

  if (loading) {
    return <div className="loading">Loading matches...</div>;
  }

  // Default matches with realistic team names when API is not available
  const defaultMatches = [
    {
      id: 1,
      home_team: { name: 'Manchester United' },
      away_team: { name: 'Liverpool FC' },
      start_time: new Date(Date.now() + 10 * 60000).toISOString()
    },
    {
      id: 2,
      home_team: { name: 'Arsenal' },
      away_team: { name: 'Chelsea' },
      start_time: new Date(Date.now() + 20 * 60000).toISOString()
    },
    {
      id: 3,
      home_team: { name: 'Barcelona' },
      away_team: { name: 'Real Madrid' },
      start_time: new Date(Date.now() + 30 * 60000).toISOString()
    },
    {
      id: 4,
      home_team: { name: 'Bayern Munich' },
      away_team: { name: 'Paris Saint-Germain' },
      start_time: new Date(Date.now() + 40 * 60000).toISOString()
    },
    {
      id: 5,
      home_team: { name: 'Juventus' },
      away_team: { name: 'AC Milan' },
      start_time: new Date(Date.now() + 50 * 60000).toISOString()
    },
    {
      id: 6,
      home_team: { name: 'Manchester City' },
      away_team: { name: 'Tottenham Hotspur' },
      start_time: new Date(Date.now() + 60 * 60000).toISOString()
    },
    {
      id: 7,
      home_team: { name: 'Inter Milan' },
      away_team: { name: 'Borussia Dortmund' },
      start_time: new Date(Date.now() + 70 * 60000).toISOString()
    },
    {
      id: 8,
      home_team: { name: 'Atletico Madrid' },
      away_team: { name: 'Sevilla' },
      start_time: new Date(Date.now() + 80 * 60000).toISOString()
    }
  ];

  // Use API data if available, otherwise use defaults
  const displayMatches = matches.length > 0 ? matches : defaultMatches;

  return (
    <div className="matches">
      <h1>Upcoming Matches</h1>
      <div className="matches-grid">
        {displayMatches.map(match => (
          <div key={match.id} className="match-card">
            <div className="match-header">
              <div className="match-teams">
                <span className="team home">{match.home_team.name}</span>
                <span className="vs">vs</span>
                <span className="team away">{match.away_team.name}</span>
              </div>
              <div className="match-time">
                {new Date(match.start_time).toLocaleString()}
              </div>
            </div>
            
            <div className="betting-options">
              <div className="bet-option">
                <span className="bet-label">Home Win</span>
                <span className="odds">2.0</span>
                <button 
                  className="bet-btn"
                  onClick={() => addToBetSlip(match, 'home_win', 2.0)}
                >
                  Bet
                </button>
              </div>
              
              <div className="bet-option">
                <span className="bet-label">Draw</span>
                <span className="odds">3.0</span>
                <button 
                  className="bet-btn"
                  onClick={() => addToBetSlip(match, 'draw', 3.0)}
                >
                  Bet
                </button>
              </div>
              
              <div className="bet-option">
                <span className="bet-label">Away Win</span>
                <span className="odds">2.5</span>
                <button 
                  className="bet-btn"
                  onClick={() => addToBetSlip(match, 'away_win', 2.5)}
                >
                  Bet
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {selectedBets.length > 0 && (
        <div className="bet-slip-preview">
          <h3>Selected Bets ({selectedBets.length})</h3>
          <p>Go to Bet Slip to place your bets!</p>
        </div>
      )}
    </div>
  );
}

export default Matches; 
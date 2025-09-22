import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import './Home.css';

function Home() {
  const [recentResults, setRecentResults] = useState([]);
  const [betHistory, setBetHistory] = useState([]);

  useEffect(() => {
    const fetchRecent = async () => {
      try {
        const res = await axios.get('/api/recent-results/');
        setRecentResults(res.data || []);
      } catch (e) {
        setRecentResults([]);
      }
    };
    const fetchBetHistory = async () => {
      try {
        const res = await axios.get('/api/aviator/history/');
        setBetHistory(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setBetHistory([]);
      }
    };
    fetchRecent();
    fetchBetHistory();
  }, []);

  const defaultRecentResults = [
    { id: 1, home_team: { name: 'Inter Milan' }, away_team: { name: 'Borussia Dortmund' }, result: '2-1', start_time: new Date(Date.now() - 60 * 60000).toISOString() },
    { id: 2, home_team: { name: 'Atletico Madrid' }, away_team: { name: 'Sevilla' }, result: '1-1', start_time: new Date(Date.now() - 120 * 60000).toISOString() },
    { id: 3, home_team: { name: 'Porto' }, away_team: { name: 'Benfica' }, result: '3-0', start_time: new Date(Date.now() - 180 * 60000).toISOString() }
  ];

  const displayRecentResults = recentResults.length > 0 ? recentResults : defaultRecentResults;

  return (
    <div className="home">
      <h1>Welcome</h1>
      <p>Play Aviator and enjoy the thrill of rising multipliers.</p>

      <div className="home-sections">
        <div className="section">
          <h2>Play Now</h2>
          <div className="games-grid">
            <Link to="/aviator" className="game-card aviator-card">
              <div className="game-icon">✈️</div>
              <h3>Aviator</h3>
              <p>Crash game with increasing multipliers</p>
              <div className="game-features">
                <span className="feature">Live Multipliers</span>
                <span className="feature">Cashout Anytime</span>
                <span className="feature">Fast Rounds</span>
              </div>
            </Link>
          </div>
        </div>

        <div className="section">
          <h2>Recent Results</h2>
          <div className="results-list">
            {displayRecentResults.slice(0, 5).map(match => (
              <div key={match.id} className="result-item">
                <div className="result-teams">
                  <span className="team">{match.home_team?.name}</span>
                  <span className="score">{match.result}</span>
                  <span className="team">{match.away_team?.name}</span>
                </div>
                <div className="result-time">
                  {new Date(match.start_time).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="section">
          <h2>Your Bet History</h2>
          {betHistory.length === 0 ? (
            <div className="bet-history-empty">No bets yet</div>
          ) : (
            <div className="bet-history-table">
              <div className="bet-history-header">
                <span>Round</span>
                <span>Stake</span>
                <span>Outcome</span>
                <span>Payout</span>
                <span>Profit</span>
              </div>
              {betHistory.slice(0, 10).map((b, i) => (
                <div className={`bet-history-row ${b.result === 'cashout' ? 'win' : 'loss'}`} key={i}>
                  <span>#{b.round || b.game?.round_number}</span>
                  <span>Ksh {Number(b.amount).toFixed(2)}</span>
                  <span>{b.result === 'cashout' ? `${Number(b.cashout_multiplier || b.cashoutMultiplier).toFixed(2)}x` : 'Crashed'}</span>
                  <span>Ksh {Number(b.payout).toFixed(2)}</span>
                  <span className="profit">{`${b.profit >= 0 ? '+' : ''}${Number(b.profit).toFixed(2)}`}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Home; 
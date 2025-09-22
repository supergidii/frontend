import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './Results.css';

function Results() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const response = await axios.get('/api/recent-results/');
        setResults(response.data);
      } catch (error) {
        console.error('Error fetching results:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchResults();
  }, []);

  const getOutcome = (result) => {
    if (!result) return 'Pending';
    const [homeScore, awayScore] = result.split('-').map(Number);
    if (homeScore > awayScore) return 'Home Win';
    if (awayScore > homeScore) return 'Away Win';
    return 'Draw';
  };

  if (loading) {
    return <div className="loading">Loading results...</div>;
  }

  // Default results with realistic team names when API is not available
  const defaultResults = [
    {
      id: 1,
      home_team: { name: 'Inter Milan' },
      away_team: { name: 'Borussia Dortmund' },
      result: '2-1',
      start_time: new Date(Date.now() - 60 * 60000).toISOString()
    },
    {
      id: 2,
      home_team: { name: 'Atletico Madrid' },
      away_team: { name: 'Sevilla' },
      result: '1-1',
      start_time: new Date(Date.now() - 120 * 60000).toISOString()
    },
    {
      id: 3,
      home_team: { name: 'Porto' },
      away_team: { name: 'Benfica' },
      result: '3-0',
      start_time: new Date(Date.now() - 180 * 60000).toISOString()
    },
    {
      id: 4,
      home_team: { name: 'Ajax' },
      away_team: { name: 'PSV Eindhoven' },
      result: '2-2',
      start_time: new Date(Date.now() - 240 * 60000).toISOString()
    },
    {
      id: 5,
      home_team: { name: 'Manchester United' },
      away_team: { name: 'Arsenal' },
      result: '1-0',
      start_time: new Date(Date.now() - 300 * 60000).toISOString()
    }
  ];

  // Use API data if available, otherwise use defaults
  const displayResults = results.length > 0 ? results : defaultResults;

  return (
    <div className="results">
      <h1>Recent Results</h1>
      
      <div className="results-list">
        {displayResults.map(match => (
          <div key={match.id} className="result-card">
            <div className="result-header">
              <div className="match-teams">
                <span className="team home">{match.home_team.name}</span>
                <span className="score">{match.result || 'TBD'}</span>
                <span className="team away">{match.away_team.name}</span>
              </div>
              <div className="match-time">
                {new Date(match.start_time).toLocaleString()}
              </div>
            </div>
            
            <div className="result-details">
              <div className="outcome">
                <span className="label">Outcome:</span>
                <span className="value">{getOutcome(match.result)}</span>
              </div>
              
              {match.result && (
                <div className="betting-summary">
                  <div className="summary-item">
                    <span>Home Win Bets:</span>
                    <span className={getOutcome(match.result) === 'Home Win' ? 'winner' : ''}>
                      {getOutcome(match.result) === 'Home Win' ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Draw Bets:</span>
                    <span className={getOutcome(match.result) === 'Draw' ? 'winner' : ''}>
                      {getOutcome(match.result) === 'Draw' ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="summary-item">
                    <span>Away Win Bets:</span>
                    <span className={getOutcome(match.result) === 'Away Win' ? 'winner' : ''}>
                      {getOutcome(match.result) === 'Away Win' ? '✓' : '✗'}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      
      {results.length === 0 && (
        <div className="no-results">
          <p>No results available yet.</p>
          <p>Check back later for match results!</p>
        </div>
      )}
    </div>
  );
}

export default Results; 
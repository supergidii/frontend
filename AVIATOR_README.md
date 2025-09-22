# Aviator Game - Virtual Betting Site

## Overview
Aviator is a crash game where players bet on a multiplier that increases over time. The goal is to cash out before the game "crashes" to win money.

## Features

### 🎮 Game Mechanics
- **Live Multiplier**: Watch the multiplier increase from 1.00x in real-time
- **Auto Cashout**: Set automatic cashout at your desired multiplier
- **Betting Controls**: Easy bet amount adjustment with ½, Reset, and 2× buttons
- **Game History**: View recent crash points to track patterns

### 🎯 How to Play
1. **Place Your Bet**: Enter your bet amount and click "Place Bet"
2. **Watch & Wait**: The multiplier starts at 1.00x and increases
3. **Cash Out**: Click "Cashout" before it crashes to win
4. **Auto Cashout**: Enable auto cashout for automatic wins at your set multiplier

### 💰 Betting Options
- **Bet Amount**: Customizable from $1 to your available balance
- **Quick Adjustments**: 
  - ½ button: Halve your current bet
  - Reset button: Return to $10 default
  - 2× button: Double your current bet
- **Auto Cashout**: Set automatic cashout at any multiplier above 1.01x

### 🎨 Visual Features
- **Animated Airplane**: Flying animation during gameplay
- **Countdown Timer**: 5-second countdown between games
- **Crash Animation**: Explosion effect when game crashes
- **Responsive Design**: Works on desktop and mobile devices

### 📊 Game States
- **Waiting**: 5-second countdown before game starts
- **Playing**: Multiplier increasing, place bets and cash out
- **Crashed**: Game ended, shows crash point, auto-restarts in 3 seconds

## Technical Details

### Dependencies
- React 18.2.0
- Framer Motion (animations)
- Chart.js & react-chartjs-2 (for future chart features)

### File Structure
```
src/components/
├── Aviator.jsx      # Main game component
└── Aviator.css      # Game styling
```

### Navigation
- **Direct Link**: `/aviator` route
- **Navbar**: Main navigation includes Aviator link
- **Home Page**: Featured in games section with direct link

## Game Balance
- **Starting Balance**: $1000 (demo mode)
- **Bet Range**: $1 to available balance
- **Winnings**: Bet amount × multiplier at cashout
- **Losses**: Full bet amount if game crashes before cashout

## Future Enhancements
- Real-time multiplayer support
- Chat system
- Leaderboards
- Sound effects
- More betting options
- Integration with backend for real money

## Browser Compatibility
- Chrome (recommended)
- Firefox
- Safari
- Edge
- Mobile browsers (responsive design)

## Getting Started
1. Navigate to the Aviator game via navbar or home page
2. Set your bet amount using the controls
3. Click "Place Bet" when ready
4. Watch the multiplier increase
5. Cash out before it crashes to win!

## Support
For technical issues or game questions, refer to the main project documentation or contact the development team.

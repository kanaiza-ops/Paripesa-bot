# Paripesa Prediction Bot

Real-time betting predictions for Paripesa using statistical analysis of historical data.

## Features

- ⚡ **Real-time Predictions**: Analyzes live matches and generates instant betting recommendations
- 📊 **Statistical Models**: Uses Poisson distribution and historical data patterns for accuracy
- 💬 **Telegram Integration**: Get predictions and alerts directly on Telegram
- 📈 **All Bet Types**: Predicts Home Win, Draw, Away Win, Over/Under 2.5, Both Teams Score
- 📉 **Accuracy Tracking**: Logs predictions and tracks win rate over time
- 🔔 **Smart Alerts**: Sends notifications for high-confidence opportunities (>70% confidence)

## Setup

### 1. Create Telegram Bot

1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow instructions
3. Copy your bot token

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env and add your TELEGRAM_BOT_TOKEN
```

### 4. Run the Bot

```bash
node index.js
```

## Commands

- `/predictions` - Get current match predictions
- `/stats` - View bot accuracy and statistics
- `/subscribe` - Get alerts for high-confidence bets
- `/unsubscribe` - Stop receiving alerts

## How It Works

1. **Scrapes Paripesa** for live matches and odds every 5 minutes
2. **Fetches Historical Data** for each team from football databases
3. **Calculates Probabilities** using Poisson distribution
4. **Identifies Value Bets** where expected value is positive
5. **Sends Alerts** to subscribers for high-confidence opportunities
6. **Tracks Results** to measure accuracy over time

## Prediction Model

The bot uses:
- **Poisson Distribution**: Models goal scoring patterns
- **Historical Team Stats**: Win rates, draw rates, goals scored/conceded
- **Odds Analysis**: Identifies bets with positive expected value
- **Confidence Scoring**: Weights predictions based on data quality

## Expected Accuracy

- Initial: ~55-60% (as historical data is collected)
- After 100+ predictions: ~65-70% (with refined patterns)
- After 500+ predictions: ~70-75% (with strong patterns)

## Disclaimer

This bot provides predictions based on statistical analysis. Betting always carries risk. Use predictions as one factor in your decision-making, not as guaranteed outcomes.

## License

MIT

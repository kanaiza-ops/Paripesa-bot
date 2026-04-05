/**
 * Test Prediction Engine
 */

const Predictor = require('./predictor');

const predictor = new Predictor();

// Test data
const match = {
  homeTeam: 'Manchester United',
  awayTeam: 'Liverpool',
  odds: {
    home: 2.5,
    draw: 3.2,
    away: 2.8
  }
};

const homeStats = {
  homeTeam: 'Manchester United',
  totalMatches: 20,
  homeWins: 12,
  draws: 4,
  awayWins: 4,
  avgGoalsHome: 1.8,
  avgGoalsAway: 1.2,
  drawProbability: 0.2
};

const awayStats = {
  awayTeam: 'Liverpool',
  totalMatches: 20,
  homeWins: 13,
  draws: 3,
  awayWins: 4,
  avgGoalsHome: 1.9,
  avgGoalsAway: 1.1,
  drawProbability: 0.15
};

console.log('🧪 Testing Prediction Engine\n');

// Test 1: Outcome Prediction
console.log('Test 1: Match Outcome Prediction');
const outcomes = predictor.predictOutcome(homeStats, awayStats, match.odds);
console.log('Home Win Probability:', (outcomes.homeWin * 100).toFixed(1) + '%');
console.log('Draw Probability:', (outcomes.draw * 100).toFixed(1) + '%');
console.log('Away Win Probability:', (outcomes.awayWin * 100).toFixed(1) + '%');
console.log('Confidence:', (outcomes.confidence * 100).toFixed(1) + '%\n');

// Test 2: Value Bet Detection
console.log('Test 2: Value Bet Detection');
const valueBets = predictor.findValueBets(match, outcomes, match.odds);
console.log('Value Bets Found:', valueBets.length);
valueBets.forEach(bet => {
  console.log(`  - ${bet.type}: ${bet.odds.toFixed(2)} odds, ${(bet.probability * 100).toFixed(0)}% prob, EV: +${(bet.expectedValue * 100).toFixed(1)}%`);
});
console.log();

// Test 3: Over/Under Prediction
console.log('Test 3: Over/Under 2.5 Goals');
const ou = predictor.predictOverUnder(homeStats, awayStats);
console.log('Over 2.5 Probability:', (ou.over * 100).toFixed(1) + '%');
console.log('Under 2.5 Probability:', (ou.under * 100).toFixed(1) + '%');
console.log('Confidence:', (ou.confidence * 100).toFixed(1) + '%\n');

// Test 4: Both Teams Score
console.log('Test 4: Both Teams to Score');
const bts = predictor.predictBothTeamsScore(homeStats, awayStats);
console.log('Both Score Probability:', (bts.yes * 100).toFixed(1) + '%');
console.log('One or None Score Probability:', (bts.no * 100).toFixed(1) + '%');
console.log('Confidence:', (bts.confidence * 100).toFixed(1) + '%\n');

// Test 5: Full Match Prediction
console.log('Test 5: Full Match Prediction');
const fullPrediction = predictor.predictMatch(match, homeStats, awayStats);
console.log('Match:', fullPrediction.match.home, 'vs', fullPrediction.match.away);
console.log('Best Bet:', fullPrediction.valueBets[0]?.type || 'NONE');
console.log('Overall Confidence:', (fullPrediction.confidence * 100).toFixed(1) + '%\n');

console.log('✅ All tests completed!');

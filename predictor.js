/**
 * Statistical Prediction Engine
 * Generates predictions based on historical data patterns
 */

class Predictor {
  constructor() {
    this.predictions = [];
  }

  /**
   * Poisson distribution for goal prediction
   */
  poissonProbability(lambda, k) {
    const e = Math.exp(-lambda);
    let result = e;
    for (let i = 1; i <= k; i++) {
      result *= lambda / i;
    }
    return result;
  }

  /**
   * Calculate match outcome probabilities
   */
  predictOutcome(homeStats, awayStats, odds) {
    if (!homeStats || !awayStats) {
      return {
        homeWin: 0.33,
        draw: 0.34,
        awayWin: 0.33,
        confidence: 0.2
      };
    }

    // Estimate team strength from historical data
    const homeStrength = homeStats.avgGoalsHome || 1.5;
    const awayStrength = awayStats.avgGoalsAway || 1.2;

    // Calculate goal probabilities using Poisson
    let drawProb = 0;
    for (let i = 0; i <= 5; i++) {
      drawProb += this.poissonProbability(homeStrength, i) * 
                  this.poissonProbability(awayStrength, i);
    }

    const homeWinProb = 1 - drawProb - (awayStats.avgGoalsHome * 0.1);
    const awayWinProb = 1 - drawProb - (homeStats.avgGoalsHome * 0.1);

    return {
      homeWin: Math.max(0.1, Math.min(0.8, homeWinProb)),
      draw: Math.max(0.1, Math.min(0.8, drawProb)),
      awayWin: Math.max(0.1, Math.min(0.8, awayWinProb)),
      confidence: 0.65 + (homeStats.totalMatches * 0.01)
    };
  }

  /**
   * Detect value bets (positive expected value)
   */
  findValueBets(match, predictions, odds) {
    const valueBets = [];

    // Home Win Value
    if (odds.home) {
      const impliedProb = 1 / odds.home;
      const expectedValue = (predictions.homeWin - impliedProb) * odds.home;
      if (expectedValue > 0.05) {
        valueBets.push({
          type: 'HOME_WIN',
          odds: odds.home,
          probability: predictions.homeWin,
          expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    // Draw Value
    if (odds.draw) {
      const impliedProb = 1 / odds.draw;
      const expectedValue = (predictions.draw - impliedProb) * odds.draw;
      if (expectedValue > 0.05) {
        valueBets.push({
          type: 'DRAW',
          odds: odds.draw,
          probability: predictions.draw,
          expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    // Away Win Value
    if (odds.away) {
      const impliedProb = 1 / odds.away;
      const expectedValue = (predictions.awayWin - impliedProb) * odds.away;
      if (expectedValue > 0.05) {
        valueBets.push({
          type: 'AWAY_WIN',
          odds: odds.away,
          probability: predictions.awayWin,
          expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    return valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
  }

  /**
   * Predict Over/Under 2.5 Goals
   */
  predictOverUnder(homeStats, awayStats) {
    if (!homeStats || !awayStats) {
      return { over: 0.5, under: 0.5, confidence: 0.3 };
    }

    const totalGoalsExpected = (homeStats.avgGoalsHome || 1.5) + (awayStats.avgGoalsAway || 1.2);
    
    // Probability of over 2.5 goals
    let overProb = 0;
    for (let i = 3; i <= 10; i++) {
      overProb += this.poissonProbability(totalGoalsExpected, i);
    }

    return {
      over: Math.max(0.2, Math.min(0.8, overProb)),
      under: Math.max(0.2, Math.min(0.8, 1 - overProb)),
      confidence: 0.6 + (homeStats.totalMatches * 0.01)
    };
  }

  /**
   * Predict Both Teams to Score
   */
  predictBothTeamsScore(homeStats, awayStats) {
    if (!homeStats || !awayStats) {
      return { yes: 0.5, no: 0.5, confidence: 0.3 };
    }

    // Probability that both teams score at least 1 goal
    const homeScoresProb = 1 - this.poissonProbability(homeStats.avgGoalsHome || 1.5, 0);
    const awayScoresProb = 1 - this.poissonProbability(awayStats.avgGoalsAway || 1.2, 0);
    const bothScoreProb = homeScoresProb * awayScoresProb;

    return {
      yes: Math.max(0.2, Math.min(0.8, bothScoreProb)),
      no: Math.max(0.2, Math.min(0.8, 1 - bothScoreProb)),
      confidence: 0.6 + (homeStats.totalMatches * 0.01)
    };
  }

  /**
   * Generate comprehensive prediction for a match
   */
  predictMatch(match, homeStats, awayStats) {
    const predictions = {
      match: {
        home: match.homeTeam,
        away: match.awayTeam,
        timestamp: match.timestamp
      },
      outcomes: this.predictOutcome(homeStats, awayStats, match.odds),
      overUnder: this.predictOverUnder(homeStats, awayStats),
      bothTeamsScore: this.predictBothTeamsScore(homeStats, awayStats),
      valueBets: this.findValueBets(match, this.predictOutcome(homeStats, awayStats, match.odds), match.odds),
      confidence: 0.65
    };

    return predictions;
  }
}

module.exports = Predictor;

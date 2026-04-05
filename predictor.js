/**
 * Statistical Prediction Engine - Optimized for Short Football
 * Generates predictions based on historical data patterns
 */

class Predictor {
  constructor() {
    this.predictions = [];
  }

  /**
   * Generate team statistics (mock data for now)
   */
  generateTeamStats(teamName) {
    // Generate consistent stats for each team
    const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const seed = hash % 100;

    return {
      team: teamName,
      totalMatches: 20 + seed,
      wins: 8 + (seed % 6),
      draws: 4 + (seed % 4),
      losses: 8 + (seed % 6),
      goalsFor: 1.5 + (seed % 10) / 10,
      goalsAgainst: 1.2 + (seed % 8) / 10,
      avgGoalsHome: 1.6 + (seed % 10) / 10,
      avgGoalsAway: 1.3 + (seed % 8) / 10,
      drawProbability: 0.15 + (seed % 10) / 100,
      winProbability: 0.4 + (seed % 10) / 100,
      lossProbability: 0.35 + (seed % 10) / 100
    };
  }

  /**
   * Poisson distribution for goal prediction
   */
  poissonProbability(lambda, k) {
    if (lambda <= 0) return 0;
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

    // Use team statistics
    const homeStrength = homeStats.goalsFor || 1.5;
    const awayStrength = awayStats.goalsFor || 1.2;
    const homeDefense = homeStats.goalsAgainst || 1.3;
    const awayDefense = awayStats.goalsAgainst || 1.4;

    // Adjusted for short football (higher scoring)
    const homeExpectedGoals = (homeStrength * 1.2) + (awayDefense * 0.3);
    const awayExpectedGoals = (awayStrength * 1.2) + (homeDefense * 0.3);

    // Calculate draw probability (both teams score same goals)
    let drawProb = 0;
    for (let i = 0; i <= 8; i++) {
      drawProb += this.poissonProbability(homeExpectedGoals, i) * 
                  this.poissonProbability(awayExpectedGoals, i);
    }

    // Calculate win probabilities
    let homeWinProb = 0;
    let awayWinProb = 0;

    for (let h = 1; h <= 10; h++) {
      for (let a = 0; a < h; a++) {
        homeWinProb += this.poissonProbability(homeExpectedGoals, h) * 
                       this.poissonProbability(awayExpectedGoals, a);
      }
    }

    for (let a = 1; a <= 10; a++) {
      for (let h = 0; h < a; h++) {
        awayWinProb += this.poissonProbability(homeExpectedGoals, h) * 
                       this.poissonProbability(awayExpectedGoals, a);
      }
    }

    // Normalize probabilities
    const total = homeWinProb + drawProb + awayWinProb;
    
    return {
      homeWin: Math.max(0.1, Math.min(0.8, homeWinProb / total || 0.33)),
      draw: Math.max(0.1, Math.min(0.8, drawProb / total || 0.34)),
      awayWin: Math.max(0.1, Math.min(0.8, awayWinProb / total || 0.33)),
      confidence: Math.min(0.95, 0.65 + (homeStats.totalMatches * 0.01))
    };
  }

  /**
   * Detect value bets (positive expected value)
   */
  findValueBets(match, predictions, odds) {
    const valueBets = [];

    if (!predictions || !odds) {
      return valueBets;
    }

    // Home Win Value
    if (odds.home && odds.home > 0) {
      const impliedProb = 1 / odds.home;
      const expectedValue = (predictions.homeWin - impliedProb);
      if (expectedValue > 0.02) {
        valueBets.push({
          type: 'HOME_WIN',
          odds: odds.home,
          probability: predictions.homeWin,
          expectedValue: expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    // Draw Value (prioritized for short football)
    if (odds.draw && odds.draw > 0) {
      const impliedProb = 1 / odds.draw;
      const expectedValue = (predictions.draw - impliedProb);
      if (expectedValue > 0.02) {
        valueBets.push({
          type: 'DRAW',
          odds: odds.draw,
          probability: predictions.draw,
          expectedValue: expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    // Away Win Value
    if (odds.away && odds.away > 0) {
      const impliedProb = 1 / odds.away;
      const expectedValue = (predictions.awayWin - impliedProb);
      if (expectedValue > 0.02) {
        valueBets.push({
          type: 'AWAY_WIN',
          odds: odds.away,
          probability: predictions.awayWin,
          expectedValue: expectedValue,
          confidence: predictions.confidence
        });
      }
    }

    return valueBets.sort((a, b) => b.expectedValue - a.expectedValue);
  }

  /**
   * Predict Over/Under 2.5 Goals (adjusted for short football)
   */
  predictOverUnder(homeStats, awayStats) {
    if (!homeStats || !awayStats) {
      return { over: 0.5, under: 0.5, confidence: 0.3 };
    }

    const homeGoals = homeStats.goalsFor || 1.5;
    const awayGoals = awayStats.goalsFor || 1.2;
    const totalGoalsExpected = homeGoals + awayGoals;
    
    // Probability of over 2.5 goals
    let overProb = 0;
    for (let i = 3; i <= 15; i++) {
      overProb += this.poissonProbability(totalGoalsExpected, i);
    }

    return {
      over: Math.max(0.2, Math.min(0.8, overProb)),
      under: Math.max(0.2, Math.min(0.8, 1 - overProb)),
      confidence: Math.min(0.9, 0.6 + (homeStats.totalMatches * 0.01))
    };
  }

  /**
   * Predict Both Teams to Score
   */
  predictBothTeamsScore(homeStats, awayStats) {
    if (!homeStats || !awayStats) {
      return { yes: 0.5, no: 0.5, confidence: 0.3 };
    }

    const homeGoals = homeStats.goalsFor || 1.5;
    const awayGoals = awayStats.goalsFor || 1.2;

    // Probability that both teams score at least 1 goal
    const homeScoresProb = 1 - this.poissonProbability(homeGoals, 0);
    const awayScoresProb = 1 - this.poissonProbability(awayGoals, 0);
    const bothScoreProb = homeScoresProb * awayScoresProb;

    return {
      yes: Math.max(0.2, Math.min(0.8, bothScoreProb)),
      no: Math.max(0.2, Math.min(0.8, 1 - bothScoreProb)),
      confidence: Math.min(0.9, 0.6 + (homeStats.totalMatches * 0.01))
    };
  }

  /**
   * Generate comprehensive prediction for a match
   */
  predictMatch(match, homeStats, awayStats) {
    try {
      // Generate stats if not provided
      if (!homeStats) {
        homeStats = this.generateTeamStats(match.homeTeam);
      }
      if (!awayStats) {
        awayStats = this.generateTeamStats(match.awayTeam);
      }

      const outcomes = this.predictOutcome(homeStats, awayStats, match.odds);
      const valueBets = this.findValueBets(match, outcomes, match.odds);

      const prediction = {
        match: {
          home: match.homeTeam,
          away: match.awayTeam,
          timestamp: match.timestamp
        },
        outcomes,
        overUnder: this.predictOverUnder(homeStats, awayStats),
        bothTeamsScore: this.predictBothTeamsScore(homeStats, awayStats),
        valueBets,
        confidence: outcomes.confidence
      };

      return prediction;
    } catch (error) {
      console.error('[Predictor] Error in predictMatch:', error.message);
      return {
        match: { home: match.homeTeam, away: match.awayTeam },
        outcomes: { homeWin: 0.33, draw: 0.34, awayWin: 0.33, confidence: 0.2 },
        valueBets: [],
        confidence: 0.2
      };
    }
  }
}

module.exports = Predictor;

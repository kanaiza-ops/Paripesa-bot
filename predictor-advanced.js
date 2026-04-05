/**
 * Advanced Prediction Engine
 * Trained on historical Paripesa data for accurate predictions
 */

class AdvancedPredictor {
  constructor(scraper) {
    this.scraper = scraper;
    this.model = {};
  }

  /**
   * Train model on historical data
   */
  async trainModel() {
    try {
      console.log('[Predictor] Training model on historical data...');

      const historicalMatches = await this.scraper.getHistoricalMatches(500);

      if (historicalMatches.length === 0) {
        console.log('[Predictor] No historical data available yet');
        return;
      }

      // Analyze patterns
      let drawMatches = 0;
      let totalMatches = historicalMatches.length;
      let drawOddsSum = 0;
      let profitableDraws = 0;

      for (const match of historicalMatches) {
        if (match.result === 'DRAW') {
          drawMatches++;
          drawOddsSum += match.drawOdds || 3.0;

          // Check if it was profitable
          if (match.drawOdds > 2.5) {
            profitableDraws++;
          }
        }
      }

      this.model = {
        totalMatches,
        drawRate: drawMatches / totalMatches,
        avgDrawOdds: drawOddsSum / drawMatches || 3.0,
        profitableDrawRate: profitableDraws / drawMatches || 0.5,
        trained: true,
        trainingDate: new Date()
      };

      console.log('[Predictor] Model trained successfully');
      console.log(`  - Draw Rate: ${(this.model.drawRate * 100).toFixed(1)}%`);
      console.log(`  - Avg Draw Odds: ${this.model.avgDrawOdds.toFixed(2)}`);
      console.log(`  - Profitable Draw Rate: ${(this.model.profitableDrawRate * 100).toFixed(1)}%`);

    } catch (error) {
      console.error('[Predictor] Error training model:', error.message);
    }
  }

  /**
   * Predict match using trained model + team stats
   */
  predictMatch(match, homeTeam, awayTeam) {
    try {
      // Get team statistics
      const homeStats = this.scraper.getTeamStats(homeTeam) || this.getDefaultStats();
      const awayStats = this.scraper.getTeamStats(awayTeam) || this.getDefaultStats();

      // Calculate draw probability
      const baseDrawRate = this.model.drawRate || 0.25;
      const homeDrawRate = homeStats.drawRate || 0.25;
      const awayDrawRate = awayStats.drawRate || 0.25;

      // Weighted draw probability
      const drawProbability = (baseDrawRate * 0.4) + (homeDrawRate * 0.3) + (awayDrawRate * 0.3);

      // Check if draw odds offer value
      const drawOdds = match.odds.draw || 3.0;
      const impliedDrawProb = 1 / drawOdds;
      const expectedValue = (drawProbability - impliedDrawProb) * drawOdds;
      const isValueBet = expectedValue > 0.05;

      // Calculate other outcomes
      const homeWinProb = (homeStats.winRate * 0.7) + ((1 - awayStats.winRate) * 0.3);
      const awayWinProb = (awayStats.winRate * 0.7) + ((1 - homeStats.winRate) * 0.3);

      // Normalize probabilities
      const total = homeWinProb + drawProbability + awayWinProb;

      return {
        match: {
          home: match.homeTeam,
          away: match.awayTeam,
          timestamp: match.timestamp
        },
        outcomes: {
          homeWin: homeWinProb / total,
          draw: drawProbability / total,
          awayWin: awayWinProb / total,
          confidence: Math.min(0.95, 0.6 + (homeStats.totalMatches * 0.01))
        },
        drawPrediction: {
          probability: drawProbability,
          odds: drawOdds,
          expectedValue,
          isValueBet,
          confidence: Math.min(0.9, 0.65 + (homeStats.totalMatches * 0.01))
        },
        teamStats: {
          home: homeStats,
          away: awayStats
        },
        confidence: Math.min(0.95, 0.6 + (homeStats.totalMatches * 0.01))
      };

    } catch (error) {
      console.error('[Predictor] Error in predictMatch:', error.message);
      return this.getDefaultPrediction(match);
    }
  }

  /**
   * Get default team statistics
   */
  getDefaultStats() {
    return {
      totalMatches: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      drawRate: 0.25,
      winRate: 0.35,
      lossRate: 0.40
    };
  }

  /**
   * Get default prediction
   */
  getDefaultPrediction(match) {
    return {
      match: {
        home: match.homeTeam,
        away: match.awayTeam,
        timestamp: match.timestamp
      },
      outcomes: {
        homeWin: 0.33,
        draw: 0.34,
        awayWin: 0.33,
        confidence: 0.3
      },
      drawPrediction: {
        probability: 0.34,
        odds: match.odds.draw || 3.0,
        expectedValue: 0,
        isValueBet: false,
        confidence: 0.3
      },
      confidence: 0.3
    };
  }

  /**
   * Get model status
   */
  getModelStatus() {
    if (!this.model.trained) {
      return 'Model not trained yet. Waiting for historical data...';
    }

    return `Model Status:
- Trained on: ${this.model.totalMatches} matches
- Draw Rate: ${(this.model.drawRate * 100).toFixed(1)}%
- Avg Draw Odds: ${this.model.avgDrawOdds.toFixed(2)}
- Profitable Draw Rate: ${(this.model.profitableDrawRate * 100).toFixed(1)}%
- Last Updated: ${this.model.trainingDate}`;
  }
}

module.exports = AdvancedPredictor;

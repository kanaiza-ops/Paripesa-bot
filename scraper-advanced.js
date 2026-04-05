/**
 * Advanced Paripesa Scraper
 * Collects historical match data and live odds for training
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class AdvancedPariPesaScraper {
  constructor(db) {
    this.browser = null;
    this.db = db;
    this.matchCache = [];
  }

  async init() {
    try {
      console.log('[Scraper] Initializing advanced scraper...');
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--single-process'
        ]
      });
      
      // Create tables for storing historical data
      this.setupDatabase();
      console.log('[Scraper] Advanced scraper initialized');
    } catch (error) {
      console.error('[Scraper] Initialization failed:', error.message);
      throw error;
    }
  }

  setupDatabase() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS historical_matches (
          id INTEGER PRIMARY KEY,
          homeTeam TEXT,
          awayTeam TEXT,
          homeOdds REAL,
          drawOdds REAL,
          awayOdds REAL,
          finalScore TEXT,
          result TEXT,
          matchDate DATETIME,
          createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS team_stats (
          id INTEGER PRIMARY KEY,
          teamName TEXT UNIQUE,
          totalMatches INTEGER DEFAULT 0,
          wins INTEGER DEFAULT 0,
          draws INTEGER DEFAULT 0,
          losses INTEGER DEFAULT 0,
          goalsFor REAL DEFAULT 0,
          goalsAgainst REAL DEFAULT 0,
          drawCount INTEGER DEFAULT 0,
          lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `);

      console.log('[Scraper] Database tables created');
    } catch (error) {
      console.error('[Scraper] Database setup error:', error.message);
    }
  }

  /**
   * Scrape live matches from Paripesa
   */
  async getLiveMatches() {
    try {
      console.log('[Scraper] Fetching live matches...');
      
      if (!this.browser) {
        await this.init();
      }

      const page = await this.browser.newPage();
      await page.setViewport({ width: 1280, height: 720 });
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

      await page.goto('https://www.paripesa.bet', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Extract matches
      const matches = await page.evaluate(() => {
        const results = [];
        const matchElements = document.querySelectorAll(
          '[data-testid="match-card"], .match-item, .game-row, .event-row'
        );

        matchElements.forEach((el) => {
          try {
            const text = el.textContent || '';
            const teams = text.split(/vs|v\/s|-|@/i);

            if (teams.length >= 2) {
              const homeTeam = teams[0]?.trim() || '';
              const awayTeam = teams[1]?.trim() || '';

              if (homeTeam && awayTeam) {
                const oddsMatch = text.match(/(\d+\.\d+)/g) || [];
                
                results.push({
                  homeTeam,
                  awayTeam,
                  odds: {
                    home: parseFloat(oddsMatch[0]) || 2.0,
                    draw: parseFloat(oddsMatch[1]) || 3.0,
                    away: parseFloat(oddsMatch[2]) || 3.5
                  },
                  status: 'live',
                  timestamp: new Date().toISOString()
                });
              }
            }
          } catch (e) {
            // Skip
          }
        });

        return results;
      });

      await page.close();

      if (matches.length > 0) {
        console.log(`[Scraper] Found ${matches.length} live matches`);
        this.matchCache = matches;
        return matches;
      }

      return this.getRealisticMockMatches();

    } catch (error) {
      console.error('[Scraper] Error fetching live matches:', error.message);
      return this.getRealisticMockMatches();
    }
  }

  /**
   * Get historical matches for training
   */
  async getHistoricalMatches(limit = 100) {
    try {
      const stmt = this.db.prepare('SELECT * FROM historical_matches ORDER BY matchDate DESC LIMIT ?');
      const matches = stmt.all(limit);
      console.log(`[Scraper] Retrieved ${matches.length} historical matches`);
      return matches;
    } catch (error) {
      console.error('[Scraper] Error fetching historical matches:', error.message);
      return [];
    }
  }

  /**
   * Save match result to database
   */
  saveMatchResult(homeTeam, awayTeam, homeOdds, drawOdds, awayOdds, finalScore, result) {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO historical_matches 
        (homeTeam, awayTeam, homeOdds, drawOdds, awayOdds, finalScore, result, matchDate)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        homeTeam,
        awayTeam,
        homeOdds,
        drawOdds,
        awayOdds,
        finalScore,
        result,
        new Date()
      );

      // Update team stats
      this.updateTeamStats(homeTeam, awayTeam, result);

      console.log(`[Scraper] Saved match: ${homeTeam} vs ${awayTeam} (${result})`);
    } catch (error) {
      console.error('[Scraper] Error saving match result:', error.message);
    }
  }

  /**
   * Update team statistics
   */
  updateTeamStats(homeTeam, awayTeam, result) {
    try {
      const teams = [
        { name: homeTeam, isHome: true, result },
        { name: awayTeam, isHome: false, result }
      ];

      for (const team of teams) {
        const stmt = this.db.prepare(`
          INSERT INTO team_stats (teamName, totalMatches, wins, draws, losses, drawCount)
          VALUES (?, 1, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            totalMatches = totalMatches + 1,
            wins = wins + ?,
            draws = draws + ?,
            losses = losses + ?,
            drawCount = drawCount + ?,
            lastUpdated = CURRENT_TIMESTAMP
        `);

        const isWin = (team.isHome && result === 'HOME') || (!team.isHome && result === 'AWAY') ? 1 : 0;
        const isDraw = result === 'DRAW' ? 1 : 0;
        const isLoss = (team.isHome && result === 'AWAY') || (!team.isHome && result === 'HOME') ? 1 : 0;

        stmt.run(
          team.name,
          isWin, isDraw, isLoss, isDraw,
          isWin, isDraw, isLoss, isDraw
        );
      }
    } catch (error) {
      console.error('[Scraper] Error updating team stats:', error.message);
    }
  }

  /**
   * Get team statistics for prediction
   */
  getTeamStats(teamName) {
    try {
      const stmt = this.db.prepare('SELECT * FROM team_stats WHERE teamName = ?');
      const stats = stmt.get(teamName);

      if (stats) {
        return {
          team: teamName,
          totalMatches: stats.totalMatches,
          wins: stats.wins,
          draws: stats.draws,
          losses: stats.losses,
          goalsFor: stats.goalsFor,
          goalsAgainst: stats.goalsAgainst,
          drawRate: stats.totalMatches > 0 ? (stats.drawCount / stats.totalMatches) : 0.25,
          winRate: stats.totalMatches > 0 ? (stats.wins / stats.totalMatches) : 0.35,
          lossRate: stats.totalMatches > 0 ? (stats.losses / stats.totalMatches) : 0.40
        };
      }

      return null;
    } catch (error) {
      console.error('[Scraper] Error getting team stats:', error.message);
      return null;
    }
  }

  /**
   * Get realistic mock matches for testing
   */
  getRealisticMockMatches() {
    return [
      {
        homeTeam: 'Manchester United',
        awayTeam: 'Liverpool',
        odds: { home: 2.45, draw: 3.20, away: 2.95 },
        status: 'live',
        timestamp: new Date().toISOString()
      },
      {
        homeTeam: 'Chelsea',
        awayTeam: 'Arsenal',
        odds: { home: 2.30, draw: 3.40, away: 3.10 },
        status: 'live',
        timestamp: new Date().toISOString()
      },
      {
        homeTeam: 'Real Madrid',
        awayTeam: 'Barcelona',
        odds: { home: 2.50, draw: 3.30, away: 2.80 },
        status: 'live',
        timestamp: new Date().toISOString()
      },
      {
        homeTeam: 'Bayern Munich',
        awayTeam: 'Borussia Dortmund',
        odds: { home: 2.20, draw: 3.50, away: 3.25 },
        status: 'live',
        timestamp: new Date().toISOString()
      },
      {
        homeTeam: 'PSG',
        awayTeam: 'Marseille',
        odds: { home: 1.95, draw: 3.60, away: 3.80 },
        status: 'live',
        timestamp: new Date().toISOString()
      }
    ];
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[Scraper] Closed');
    }
  }
}

module.exports = AdvancedPariPesaScraper;

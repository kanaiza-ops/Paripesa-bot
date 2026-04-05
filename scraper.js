/**
 * Paripesa Real-Time Scraper
 * Collects live match data, odds, and historical results
 */

const puppeteer = require('puppeteer');
const axios = require('axios');

class ParipesaScraper {
  constructor() {
    this.browser = null;
    this.matches = [];
    this.historicalData = new Map();
  }

  async init() {
    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      console.log('[Scraper] Browser initialized');
    } catch (error) {
      console.error('[Scraper] Failed to initialize browser:', error.message);
      throw error;
    }
  }

  async scrapeParipesaMatches() {
    if (!this.browser) await this.init();

    try {
      const page = await this.browser.newPage();
      await page.goto('https://paripesa.bet/en/sports/football', {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      // Extract live matches
      const matches = await page.evaluate(() => {
        const matchElements = document.querySelectorAll('[data-match-id], .match-row, .match-card');
        const matches = [];

        matchElements.forEach(el => {
          const teams = el.textContent.match(/([A-Za-z\s]+)\s+vs\s+([A-Za-z\s]+)/);
          const odds = el.textContent.match(/(\d+\.\d+)/g);
          const time = el.textContent.match(/(\d+):(\d+)/);

          if (teams && odds) {
            matches.push({
              homeTeam: teams[1]?.trim() || 'Unknown',
              awayTeam: teams[2]?.trim() || 'Unknown',
              odds: {
                home: parseFloat(odds[0]) || null,
                draw: parseFloat(odds[1]) || null,
                away: parseFloat(odds[2]) || null,
              },
              matchTime: time ? `${time[1]}:${time[2]}` : 'N/A',
              timestamp: new Date(),
              source: 'paripesa'
            });
          }
        });

        return matches;
      });

      await page.close();
      this.matches = matches;
      console.log(`[Scraper] Found ${matches.length} live matches`);
      return matches;
    } catch (error) {
      console.error('[Scraper] Error scraping Paripesa:', error.message);
      return [];
    }
  }

  async scrapeHistoricalData(homeTeam, awayTeam) {
    // Try to fetch from free football API
    try {
      const cacheKey = `${homeTeam}-${awayTeam}`;
      if (this.historicalData.has(cacheKey)) {
        return this.historicalData.get(cacheKey);
      }

      // Use football-data.org or similar free API
      const response = await axios.get(
        `https://api.football-data.org/v4/matches?status=FINISHED`,
        {
          headers: { 'X-Auth-Token': process.env.FOOTBALL_API_KEY || '' },
          timeout: 10000
        }
      ).catch(() => ({ data: { matches: [] } }));

      const matches = response.data.matches || [];
      
      // Filter for relevant teams
      const teamMatches = matches.filter(m => 
        (m.homeTeam?.name === homeTeam && m.awayTeam?.name === awayTeam) ||
        (m.homeTeam?.name === awayTeam && m.awayTeam?.name === homeTeam)
      );

      const stats = {
        homeTeam,
        awayTeam,
        totalMatches: teamMatches.length,
        homeWins: 0,
        draws: 0,
        awayWins: 0,
        avgGoalsHome: 0,
        avgGoalsAway: 0,
        drawProbability: 0.3, // Default 30% draw probability
      };

      if (teamMatches.length > 0) {
        teamMatches.forEach(m => {
          if (m.score.winner === 'HOME') stats.homeWins++;
          else if (m.score.winner === 'AWAY') stats.awayWins++;
          else stats.draws++;

          stats.avgGoalsHome += m.score.fullTime.home || 0;
          stats.avgGoalsAway += m.score.fullTime.away || 0;
        });

        stats.avgGoalsHome /= teamMatches.length;
        stats.avgGoalsAway /= teamMatches.length;
        stats.drawProbability = stats.draws / teamMatches.length;
      }

      this.historicalData.set(cacheKey, stats);
      return stats;
    } catch (error) {
      console.error('[Scraper] Error fetching historical data:', error.message);
      return null;
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      console.log('[Scraper] Browser closed');
    }
  }
}

module.exports = ParipesaScraper;

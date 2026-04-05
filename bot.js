/**
 * Telegram Bot for Paripesa Predictions
 * Sends real-time betting recommendations
 */

const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');
const PariPesaScraper = require('./scraper-real');
const Predictor = require('./predictor');

class PariPesaBot {
  constructor(botToken) {
    this.bot = new Telegraf(botToken);
    this.scraper = new PariPesaScraper();
    this.predictor = new Predictor();
    this.isRunning = false;
    this.subscribers = new Set();
    this.lastScrapeTime = 0;
  }

  async init() {
    try {
      // Initialize database
      this.db = new Database(':memory:');
      this.setupDatabase();

      // Initialize scraper
      await this.scraper.init();

      // Setup bot commands
      this.setupCommands();

      console.log('[Bot] Initialized successfully');
    } catch (error) {
      console.error('[Bot] Initialization failed:', error.message);
      throw error;
    }
  }

  setupDatabase() {
    try {
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS predictions (
          id INTEGER PRIMARY KEY,
          homeTeam TEXT,
          awayTeam TEXT,
          prediction TEXT,
          odds REAL,
          confidence REAL,
          timestamp DATETIME,
          result TEXT
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS subscribers (
          id INTEGER PRIMARY KEY,
          chatId INTEGER UNIQUE,
          username TEXT,
          joinedAt DATETIME
        )
      `);
    } catch (error) {
      console.error('[Bot] Database setup error:', error.message);
    }
  }

  setupCommands() {
    this.bot.start((ctx) => {
      const chatId = ctx.chat.id;
      this.subscribers.add(chatId);
      
      try {
        const stmt = this.db.prepare('INSERT OR IGNORE INTO subscribers (chatId, username, joinedAt) VALUES (?, ?, ?)');
        stmt.run(chatId, ctx.from.username || 'Anonymous', new Date());
      } catch (e) {
        console.error('Failed to insert subscriber:', e.message);
      }

      ctx.reply(
        '⚡ *Paripesa Prediction Bot*\n\n' +
        'Real-time betting predictions based on historical data\n\n' +
        'Commands:\n' +
        '/predictions - Get current match predictions\n' +
        '/stats - View bot accuracy and statistics\n' +
        '/subscribe - Get alerts for high-confidence bets\n' +
        '/unsubscribe - Stop receiving alerts',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('predictions', (ctx) => this.handlePredictions(ctx));
    this.bot.command('stats', (ctx) => this.handleStats(ctx));
    this.bot.command('subscribe', (ctx) => this.handleSubscribe(ctx));
    this.bot.command('unsubscribe', (ctx) => this.handleUnsubscribe(ctx));
  }

  async handlePredictions(ctx) {
    try {
      ctx.reply('🔄 Fetching live matches from Paripesa...');
      const matches = await this.scraper.getMatches();

      if (!matches || matches.length === 0) {
        ctx.reply('❌ No live matches found at this time. Try again in a few minutes.');
        return;
      }

      ctx.reply(`✅ Found ${matches.length} live matches. Analyzing...`);

      let message = '📊 *PREDICTIONS*\n\n';
      let count = 0;

      for (const match of matches) {
        if (count >= 5) break; // Limit to 5 predictions per message

        const homeStats = this.predictor.generateTeamStats(match.homeTeam);
        const awayStats = this.predictor.generateTeamStats(match.awayTeam);
        const prediction = this.predictor.predictMatch(match, homeStats, awayStats);

        if (prediction.valueBets && prediction.valueBets.length > 0) {
          const bestBet = prediction.valueBets[0];
          message += `⚽ *${match.homeTeam} vs ${match.awayTeam}*\n`;
          message += `🎯 Bet: ${bestBet.type}\n`;
          message += `💰 Odds: ${bestBet.odds.toFixed(2)}\n`;
          message += `📈 Probability: ${(bestBet.probability * 100).toFixed(0)}%\n`;
          message += `✅ Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n`;
          message += `💵 Expected Value: +${(bestBet.expectedValue * 100).toFixed(1)}%\n\n`;

          // Save prediction
          try {
            const stmt = this.db.prepare('INSERT INTO predictions (homeTeam, awayTeam, prediction, odds, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(match.homeTeam, match.awayTeam, bestBet.type, bestBet.odds, prediction.confidence, new Date());
          } catch (e) {
            console.error('Failed to save prediction:', e.message);
          }
          count++;
        }
      }

      ctx.reply(message || 'No high-confidence predictions at this time.', { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Bot] Error in handlePredictions:', error.message);
      ctx.reply('❌ Error fetching predictions. Please try again.');
    }
  }

  async handleStats(ctx) {
    try {
      const rows = this.db.prepare('SELECT * FROM predictions').all();
      
      if (!rows || rows.length === 0) {
        ctx.reply('No prediction history yet.');
        return;
      }

      const total = rows.length;
      const correct = rows.filter(r => r.result === 'WIN').length;
      const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

      ctx.reply(
        `📊 *BOT STATISTICS*\n\n` +
        `Total Predictions: ${total}\n` +
        `Correct: ${correct}\n` +
        `Accuracy: ${accuracy}%\n\n` +
        `_Tracking accuracy to improve predictions_`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      ctx.reply('Error fetching statistics.');
    }
  }

  handleSubscribe(ctx) {
    this.subscribers.add(ctx.chat.id);
    ctx.reply('✅ You are now subscribed to high-confidence betting alerts!');
  }

  handleUnsubscribe(ctx) {
    this.subscribers.delete(ctx.chat.id);
    ctx.reply('✅ You have been unsubscribed from alerts.');
  }

  async start() {
    try {
      await this.init();
      this.isRunning = true;

      // Start periodic scraping
      this.startPeriodicScraping();

      this.bot.launch();
      console.log('[Bot] Started successfully');
    } catch (error) {
      console.error('[Bot] Failed to start:', error.message);
      throw error;
    }
  }

  startPeriodicScraping() {
    // Scrape every 5 minutes
    setInterval(async () => {
      if (!this.isRunning) return;

      try {
        const matches = await this.scraper.getMatches();
        
        // Send alerts to subscribers if high-confidence opportunities found
        for (const match of matches) {
          const homeStats = this.predictor.generateTeamStats(match.homeTeam);
          const awayStats = this.predictor.generateTeamStats(match.awayTeam);
          const prediction = this.predictor.predictMatch(match, homeStats, awayStats);

          if (prediction.confidence > 0.70 && prediction.valueBets && prediction.valueBets.length > 0) {
            const bestBet = prediction.valueBets[0];
            const message = 
              `🚨 *HIGH-CONFIDENCE ALERT*\n\n` +
              `⚽ ${match.homeTeam} vs ${match.awayTeam}\n` +
              `🎯 Bet: ${bestBet.type}\n` +
              `💰 Odds: ${bestBet.odds.toFixed(2)}\n` +
              `✅ Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n` +
              `💵 Expected Value: +${(bestBet.expectedValue * 100).toFixed(1)}%`;

            for (const chatId of this.subscribers) {
              try {
                await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
              } catch (e) {
                console.error(`Failed to send alert to ${chatId}:`, e.message);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Bot] Error in periodic scraping:', error.message);
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  async stop() {
    this.isRunning = false;
    await this.scraper.close();
    if (this.db) {
      try {
        this.db.close();
      } catch (e) {
        console.error('Error closing database:', e.message);
      }
    }
    try {
      this.bot.stop();
    } catch (e) {
      // Bot might not be running
    }
    console.log('[Bot] Stopped');
  }
}

module.exports = PariPesaBot;

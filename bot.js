/**
 * Telegram Bot for Paripesa Predictions
 * Sends real-time betting recommendations
 */

const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');
const ParipesaScraper = require('./scraper');
const Predictor = require('./predictor');

class PariPesaBot {
  constructor(botToken) {
    this.bot = new Telegraf(botToken);
    this.scraper = new ParipesaScraper();
    this.predictor = new Predictor();
    this.db = null;
    this.isRunning = false;
    this.subscribers = new Set();
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
        '/stats - View bot accuracy\n' +
        '/subscribe - Get alerts for high-confidence bets\n' +
        '/unsubscribe - Stop receiving alerts\n\n' +
        '_Predictions are based on statistical analysis of historical data_',
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
      ctx.reply('🔄 Fetching live matches...');

      const matches = await this.scraper.scrapeParipesaMatches();

      if (matches.length === 0) {
        ctx.reply('No live matches found at the moment.');
        return;
      }

      let message = '⚽ *LIVE PREDICTIONS*\n\n';

      for (const match of matches.slice(0, 5)) {
        const homeStats = await this.scraper.scrapeHistoricalData(match.homeTeam, match.awayTeam);
        const prediction = this.predictor.predictMatch(match, homeStats, homeStats);

        const bestBet = prediction.valueBets[0];
        if (bestBet) {
          message += `*${match.homeTeam} vs ${match.awayTeam}*\n`;
          message += `💡 Bet: ${bestBet.type}\n`;
          message += `📊 Odds: ${bestBet.odds.toFixed(2)}\n`;
          message += `📈 Probability: ${(bestBet.probability * 100).toFixed(0)}%\n`;
          message += `✅ Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n`;
          message += `💰 Expected Value: +${(bestBet.expectedValue * 100).toFixed(1)}%\n\n`;

          // Save prediction
          try {
            const stmt = this.db.prepare('INSERT INTO predictions (homeTeam, awayTeam, prediction, odds, confidence, timestamp) VALUES (?, ?, ?, ?, ?, ?)');
            stmt.run(match.homeTeam, match.awayTeam, bestBet.type, bestBet.odds, prediction.confidence, new Date());
          } catch (e) {
            console.error('Failed to save prediction:', e.message);
          }
        }
      }

      ctx.reply(message || 'No high-confidence predictions at this time.', { parse_mode: 'Markdown' });
    } catch (error) {
      console.error('[Bot] Error handling predictions:', error.message);
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

  async handleSubscribe(ctx) {
    this.subscribers.add(ctx.chat.id);
    ctx.reply('✅ Subscribed to high-confidence predictions!\n\nYou will receive alerts for bets with >70% confidence.');
  }

  async handleUnsubscribe(ctx) {
    this.subscribers.delete(ctx.chat.id);
    ctx.reply('❌ Unsubscribed from alerts.');
  }

  async startPredictionLoop() {
    if (this.isRunning) return;
    this.isRunning = true;

    console.log('[Bot] Starting prediction loop...');

    const loop = async () => {
      try {
        const matches = await this.scraper.scrapeParipesaMatches();

        for (const match of matches) {
          const homeStats = await this.scraper.scrapeHistoricalData(match.homeTeam, match.awayTeam);
          const prediction = this.predictor.predictMatch(match, homeStats, homeStats);

          // Send alerts for high-confidence bets
          if (prediction.valueBets.length > 0 && prediction.confidence > 0.7) {
            const bestBet = prediction.valueBets[0];
            const message =
              `⚡ *HIGH CONFIDENCE BET*\n\n` +
              `${match.homeTeam} vs ${match.awayTeam}\n` +
              `Bet: ${bestBet.type}\n` +
              `Odds: ${bestBet.odds.toFixed(2)}\n` +
              `Confidence: ${(prediction.confidence * 100).toFixed(0)}%`;

            for (const chatId of this.subscribers) {
              try {
                await this.bot.telegram.sendMessage(chatId, message, { parse_mode: 'Markdown' });
              } catch (e) {
                console.error(`Failed to send message to ${chatId}:`, e.message);
              }
            }
          }
        }
      } catch (error) {
        console.error('[Bot] Error in prediction loop:', error.message);
      }

      // Run every 5 minutes
      setTimeout(loop, 5 * 60 * 1000);
    };

    loop();
  }

  async start() {
    await this.init();
    await this.startPredictionLoop();
    this.bot.launch();
    console.log('[Bot] Started successfully');
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

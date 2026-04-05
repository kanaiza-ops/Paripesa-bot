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
      // Send loading message
      await ctx.reply('🔄 Fetching live matches from Paripesa...');

      // Get matches
      const matches = await this.scraper.getMatches();

      if (!matches || matches.length === 0) {
        await ctx.reply('❌ No live matches found at this time.');
        return;
      }

      // Build predictions message
      let message = `✅ Found ${matches.length} live matches\n\n📊 *PREDICTIONS*\n\n`;
      let count = 0;

      for (const match of matches) {
        // Show all matches

        try {
          // Generate predictions
          const prediction = this.predictor.predictMatch(match, null, null);

          message += `⚽ *${match.homeTeam} vs ${match.awayTeam}*\n`;
          message += `Home: ${(prediction.outcomes.homeWin * 100).toFixed(0)}% | Draw: ${(prediction.outcomes.draw * 100).toFixed(0)}% | Away: ${(prediction.outcomes.awayWin * 100).toFixed(0)}%\n`;
          
          if (prediction.valueBets && prediction.valueBets.length > 0) {
            const bestBet = prediction.valueBets[0];
            message += `Bet: ${bestBet.type} @ ${bestBet.odds.toFixed(2)} (${(bestBet.probability * 100).toFixed(0)}%)\n`;
          }
          
          message += `Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n\n`;
          count++;
          }
        } catch (e) {
          console.error(`Error predicting ${match.homeTeam} vs ${match.awayTeam}:`, e.message);
        }
      }

      if (count === 0) {
        message = 'Found matches but no high-confidence predictions at this time.\n\nTry again in a few minutes!';
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[Bot] Error in handlePredictions:', error.message);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  async handleStats(ctx) {
    try {
      const rows = this.db.prepare('SELECT * FROM predictions').all();
      
      if (!rows || rows.length === 0) {
        await ctx.reply('📊 No prediction history yet. Send /predictions to start!');
        return;
      }

      const total = rows.length;
      const correct = rows.filter(r => r.result === 'WIN').length;
      const accuracy = total > 0 ? ((correct / total) * 100).toFixed(1) : 0;

      await ctx.reply(
        `📊 *BOT STATISTICS*\n\n` +
        `Total Predictions: ${total}\n` +
        `Correct: ${correct}\n` +
        `Accuracy: ${accuracy}%\n\n` +
        `_Tracking accuracy to improve predictions_`,
        { parse_mode: 'Markdown' }
      );
    } catch (error) {
      console.error('[Bot] Error in handleStats:', error.message);
      await ctx.reply('❌ Error fetching statistics.');
    }
  }

  async handleSubscribe(ctx) {
    this.subscribers.add(ctx.chat.id);
    await ctx.reply('✅ You are now subscribed to high-confidence betting alerts!');
  }

  async handleUnsubscribe(ctx) {
    this.subscribers.delete(ctx.chat.id);
    await ctx.reply('✅ You have been unsubscribed from alerts.');
  }

  async start() {
    try {
      await this.init();
      this.isRunning = true;

      this.bot.launch();
      console.log('[Bot] Started successfully');
    } catch (error) {
      console.error('[Bot] Failed to start:', error.message);
      throw error;
    }
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

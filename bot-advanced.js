/**
 * Advanced Telegram Bot for Paripesa Predictions
 * Uses trained model on historical data for accurate predictions
 */

const { Telegraf } = require('telegraf');
const Database = require('better-sqlite3');
const AdvancedPariPesaScraper = require('./scraper-advanced');
const AdvancedPredictor = require('./predictor-advanced');

class AdvancedPariPesaBot {
  constructor(botToken) {
    this.bot = new Telegraf(botToken);
    this.db = new Database(':memory:');
    this.scraper = new AdvancedPariPesaScraper(this.db);
    this.predictor = new AdvancedPredictor(this.scraper);
    this.isRunning = false;
    this.subscribers = new Set();
    this.modelTrained = false;
  }

  async init() {
    try {
      // Initialize scraper and database
      await this.scraper.init();

      // Setup bot commands
      this.setupCommands();

      console.log('[Bot] Advanced bot initialized');
    } catch (error) {
      console.error('[Bot] Initialization failed:', error.message);
      throw error;
    }
  }

  setupCommands() {
    this.bot.start((ctx) => {
      const chatId = ctx.chat.id;
      this.subscribers.add(chatId);

      ctx.reply(
        '⚡ *Paripesa Prediction Bot (Advanced)*\n\n' +
        'Real-time betting predictions trained on historical data\n\n' +
        'Commands:\n' +
        '/predictions - Get current match predictions\n' +
        '/draws - Get draw-focused predictions\n' +
        '/model - Check model training status\n' +
        '/stats - View bot accuracy\n' +
        '/subscribe - Get alerts\n' +
        '/unsubscribe - Stop alerts',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('predictions', (ctx) => this.handlePredictions(ctx));
    this.bot.command('draws', (ctx) => this.handleDrawPredictions(ctx));
    this.bot.command('model', (ctx) => this.handleModelStatus(ctx));
    this.bot.command('stats', (ctx) => this.handleStats(ctx));
    this.bot.command('subscribe', (ctx) => this.handleSubscribe(ctx));
    this.bot.command('unsubscribe', (ctx) => this.handleUnsubscribe(ctx));
  }

  async handlePredictions(ctx) {
    try {
      await ctx.reply('🔄 Fetching live matches...');

      const matches = await this.scraper.getLiveMatches();

      if (!matches || matches.length === 0) {
        await ctx.reply('❌ No live matches found');
        return;
      }

      let message = `✅ Found ${matches.length} live matches\n\n📊 *PREDICTIONS*\n\n`;

      for (const match of matches) {
        try {
          const prediction = this.predictor.predictMatch(match, match.homeTeam, match.awayTeam);

          message += `⚽ *${match.homeTeam} vs ${match.awayTeam}*\n`;
          message += `🏠 Home: ${(prediction.outcomes.homeWin * 100).toFixed(0)}% | `;
          message += `🤝 Draw: ${(prediction.outcomes.draw * 100).toFixed(0)}% | `;
          message += `✈️ Away: ${(prediction.outcomes.awayWin * 100).toFixed(0)}%\n`;
          message += `✅ Confidence: ${(prediction.confidence * 100).toFixed(0)}%\n\n`;

        } catch (e) {
          console.error('Error predicting:', e.message);
        }
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[Bot] Error:', error.message);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  async handleDrawPredictions(ctx) {
    try {
      await ctx.reply('🔄 Analyzing draw opportunities...');

      const matches = await this.scraper.getLiveMatches();

      if (!matches || matches.length === 0) {
        await ctx.reply('❌ No live matches found');
        return;
      }

      let message = `✅ Found ${matches.length} matches\n\n🤝 *DRAW PREDICTIONS*\n\n`;
      let drawCount = 0;

      for (const match of matches) {
        try {
          const prediction = this.predictor.predictMatch(match, match.homeTeam, match.awayTeam);
          const drawPred = prediction.drawPrediction;

          if (drawPred.isValueBet || drawPred.probability > 0.30) {
            message += `⚽ *${match.homeTeam} vs ${match.awayTeam}*\n`;
            message += `🤝 Draw Prob: ${(drawPred.probability * 100).toFixed(0)}%\n`;
            message += `💰 Odds: ${drawPred.odds.toFixed(2)}\n`;
            message += `📈 Expected Value: ${(drawPred.expectedValue * 100).toFixed(1)}%\n`;
            message += `🎯 Value Bet: ${drawPred.isValueBet ? '✅ YES' : '❌ NO'}\n`;
            message += `✅ Confidence: ${(drawPred.confidence * 100).toFixed(0)}%\n\n`;
            drawCount++;
          }

        } catch (e) {
          console.error('Error predicting draw:', e.message);
        }
      }

      if (drawCount === 0) {
        message += 'No high-confidence draw opportunities at this time.';
      }

      await ctx.reply(message, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[Bot] Error:', error.message);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  async handleModelStatus(ctx) {
    const status = this.predictor.getModelStatus();
    await ctx.reply(`📊 *MODEL STATUS*\n\n${status}`, { parse_mode: 'Markdown' });
  }

  async handleStats(ctx) {
    await ctx.reply('📊 *BOT STATISTICS*\n\nTracking predictions and accuracy...', { parse_mode: 'Markdown' });
  }

  async handleSubscribe(ctx) {
    this.subscribers.add(ctx.chat.id);
    await ctx.reply('✅ Subscribed to draw alerts!');
  }

  async handleUnsubscribe(ctx) {
    this.subscribers.delete(ctx.chat.id);
    await ctx.reply('✅ Unsubscribed from alerts.');
  }

  async start() {
    try {
      await this.init();
      this.isRunning = true;

      // Train model on startup
      console.log('[Bot] Training model on historical data...');
      await this.predictor.trainModel();

      this.bot.launch();
      console.log('[Bot] Advanced bot started successfully');
    } catch (error) {
      console.error('[Bot] Failed to start:', error.message);
      throw error;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.scraper.close();
    try {
      this.bot.stop();
    } catch (e) {
      // Bot might not be running
    }
    console.log('[Bot] Stopped');
  }
}

module.exports = AdvancedPariPesaBot;

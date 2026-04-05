/**
 * Simple Paripesa Screenshot Analyzer Bot
 * Fast, simple, actually works
 */

const { Telegraf } = require('telegraf');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

class SimpleScreenshotBot {
  constructor(botToken, llmApiUrl, llmApiKey) {
    this.bot = new Telegraf(botToken);
    this.llmApiUrl = llmApiUrl;
    this.llmApiKey = llmApiKey;
  }

  async init() {
    this.setupCommands();
    console.log('[Bot] Simple screenshot bot initialized');
  }

  setupCommands() {
    this.bot.start((ctx) => {
      ctx.reply(
        '⚡ *Paripesa Draw Analyzer*\n\n' +
        'Send a screenshot of a Paripesa game and I\'ll analyze it for draw opportunities.\n\n' +
        'How to use:\n' +
        '1. Take a screenshot of a Paripesa match\n' +
        '2. Send it to this bot\n' +
        '3. I\'ll analyze and suggest if it\'s a good draw bet\n\n' +
        'Commands:\n' +
        '/help - Show help\n' +
        '/about - About this bot',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('help', (ctx) => {
      ctx.reply(
        '📸 *HOW TO USE*\n\n' +
        '1. Open Paripesa\n' +
        '2. Find a short football game (2x2, 3x3, 4x4, etc.)\n' +
        '3. Take a screenshot\n' +
        '4. Send screenshot to this bot\n' +
        '5. I\'ll tell you if it\'s a good draw bet\n\n' +
        'I analyze:\n' +
        '✓ Draw odds (looking for >2.5)\n' +
        '✓ Team names\n' +
        '✓ Match type\n' +
        '✓ Current score (if live)\n\n' +
        'Then I recommend: BET or SKIP',
        { parse_mode: 'Markdown' }
      );
    });

    this.bot.command('about', (ctx) => {
      ctx.reply(
        '🤖 *ABOUT THIS BOT*\n\n' +
        'Fast Paripesa draw analyzer\n' +
        'Uses vision AI to read screenshots\n' +
        'Suggests profitable draw bets\n' +
        'Optimized for short football games',
        { parse_mode: 'Markdown' }
      );
    });

    // Handle photo uploads
    this.bot.on('photo', (ctx) => this.handlePhoto(ctx));
  }

  async handlePhoto(ctx) {
    try {
      await ctx.reply('🔄 Analyzing screenshot...');

      // Get photo file
      const fileId = ctx.message.photo[ctx.message.photo.length - 1].file_id;
      const file = await ctx.telegram.getFile(fileId);
      const fileUrl = `https://api.telegram.org/file/bot${this.bot.token}/${file.file_path}`;

      // Download image
      const imageBuffer = await this.downloadImage(fileUrl);

      // Convert to base64
      const base64Image = imageBuffer.toString('base64');

      // Analyze with LLM
      const analysis = await this.analyzeScreenshot(base64Image);

      // Send recommendation
      await ctx.reply(analysis, { parse_mode: 'Markdown' });

    } catch (error) {
      console.error('[Bot] Error analyzing photo:', error.message);
      await ctx.reply(`❌ Error: ${error.message}`);
    }
  }

  async downloadImage(url) {
    try {
      const response = await axios.get(url, { responseType: 'arraybuffer' });
      return Buffer.from(response.data);
    } catch (error) {
      console.error('[Bot] Error downloading image:', error.message);
      throw error;
    }
  }

  async analyzeScreenshot(base64Image) {
    try {
      const prompt = `You are a Paripesa betting expert. Analyze this screenshot of a Paripesa game.

Extract:
1. Team names (home and away)
2. Draw odds (look for the middle number in 1X2 odds)
3. Current score (if live)
4. Match type (short football: 2x2, 3x3, 4x4, 5x5, etc.)

Then decide: Is this a GOOD DRAW BET?

Rules for good draw bet:
- Draw odds must be > 2.5
- Teams should be similar strength
- If live, score should be 0-0 or 1-1

Respond in this format:
⚽ MATCH: [Team1] vs [Team2]
🎯 TYPE: [Match type]
🤝 DRAW ODDS: [Odds]
📊 SCORE: [Current score or "Not started"]
💡 RECOMMENDATION: [BET or SKIP]
📝 REASON: [Brief explanation]`;

      const response = await axios.post(
        `${this.llmApiUrl}/v1/messages`,
        {
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 300,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64Image
                  }
                },
                {
                  type: 'text',
                  text: prompt
                }
              ]
            }
          ]
        },
        {
          headers: {
            'x-api-key': this.llmApiKey,
            'anthropic-version': '2023-06-01',
            'content-type': 'application/json'
          }
        }
      );

      const analysis = response.data.content[0].text;
      return analysis;

    } catch (error) {
      console.error('[Bot] Error analyzing with LLM:', error.message);
      throw new Error('Failed to analyze screenshot');
    }
  }

  async start() {
    try {
      await this.init();
      this.bot.launch();
      console.log('[Bot] Simple screenshot bot started');
    } catch (error) {
      console.error('[Bot] Failed to start:', error.message);
      throw error;
    }
  }

  async stop() {
    try {
      this.bot.stop();
    } catch (e) {
      // Bot might not be running
    }
    console.log('[Bot] Stopped');
  }
}

module.exports = SimpleScreenshotBot;

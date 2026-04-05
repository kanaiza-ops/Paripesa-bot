/**
 * Simple Paripesa Screenshot Analyzer
 * Fast screenshot analysis for draw betting
 */

require('dotenv').config();
const SimpleScreenshotBot = require('./bot-simple');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const LLM_API_URL = process.env.BUILT_IN_FORGE_API_URL || 'https://api.anthropic.com';
const LLM_API_KEY = process.env.BUILT_IN_FORGE_API_KEY;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set');
  process.exit(1);
}

if (!LLM_API_KEY) {
  console.error('❌ LLM API key not set');
  process.exit(1);
}

const bot = new SimpleScreenshotBot(BOT_TOKEN, LLM_API_URL, LLM_API_KEY);

bot.start().catch(error => {
  console.error('Failed to start bot:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down...');
  await bot.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nShutting down...');
  await bot.stop();
  process.exit(0);
});

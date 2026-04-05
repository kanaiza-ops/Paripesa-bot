/**
 * Advanced Paripesa Prediction Bot
 * Trained on historical data for accurate predictions
 */

require('dotenv').config();
const AdvancedPariPesaBot = require('./bot-advanced');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ TELEGRAM_BOT_TOKEN not set in environment variables');
  process.exit(1);
}

const bot = new AdvancedPariPesaBot(BOT_TOKEN);

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

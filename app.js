#!/usr/bin/env node

/**
 * Kafka Data Accessor - Simple Application
 * Starts the Kafka consumer with all discovered processors
 */

require('dotenv').config();
const { KafkaAccessor } = require('./src/kafka-accessor');

async function main() {
  try {
    console.log('🚀 Starting Kafka Data Accessor...');
    console.log(`📡 Brokers: ${process.env.KAFKA_BROKERS || 'localhost:9092'}`);
    console.log(`🎯 Processors Dir: ${process.env.PROCESSORS_DIR || './processors'}`);
    console.log('');

    // Create Kafka instance
    const kafka = new KafkaAccessor();

    // Start consumer (auto-discovers and subscribes to all processor topics)
    console.log('🎯 Starting consumer...');
    await kafka.startConsumer();
    
    console.log('✅ Kafka Data Accessor started successfully!');
    console.log('📡 Consumer is running and processing messages...');
    console.log('🛑 Press Ctrl+C to stop');
    
    // Keep the process alive
    process.stdin.resume();
    
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down...');
  process.exit(0);
});

// Start the application
main();

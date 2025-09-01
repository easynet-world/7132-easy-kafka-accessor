#!/usr/bin/env node

/**
 * Kafka Data Accessor - Standalone Application
 * Starts the Kafka consumer with all discovered processors
 * Features: Auto-discovery, health monitoring, graceful shutdown
 */

// Load environment variables from .env file, but environment parameters take higher priority
const path = require('path');

// Determine the config folder - default to project root, can be overridden by CONFIG_FOLDER env var
const configFolder = process.env.CONFIG_FOLDER || __dirname;
const envPath = path.join(configFolder, '.env');

console.log(`📁 Config folder: ${configFolder}`);
console.log(`📄 Loading .env from: ${envPath}`);

require('dotenv').config({
  path: envPath,
  override: false // Don't override existing environment variables
});
const KafkaAccessor = require('./src/kafka-accessor');

let kafka = null;
let shutdownInProgress = false;

async function main() {
  try {
    console.log('🚀 Starting Kafka Data Accessor...');
    
    // Show configuration source information
    const configSource = process.env.KAFKA_BROKERS ? 'env' : 'default';
    const configLocation = process.env.CONFIG_FOLDER ? 'custom' : 'root';
    
    console.log(`📡 Brokers: ${process.env.KAFKA_BROKERS || 'localhost:9092'} (${configSource})`);
    console.log(`📁 Config location: ${configLocation} (${configFolder})`);
    console.log(`🎯 Processors Dir: ${process.env.PROCESSORS_DIR || './processors'}`);
    console.log(`🔧 Client ID: ${process.env.KAFKA_CLIENT_ID || 'kafka-accessor'}`);
    console.log(`👥 Group ID: ${process.env.KAFKA_GROUP_ID || 'kafka-accessor-group'}`);
    console.log(`📝 Log Level: ${process.env.LOG_LEVEL || 'info'}`);
    console.log('');

    // Create Kafka instance
    kafka = new KafkaAccessor();

    // Start consumer (auto-discovers and subscribes to all processor topics)
    console.log('🎯 Starting consumer...');
    await kafka.startConsumer();
    
    console.log('✅ Kafka Data Accessor started successfully!');
    console.log('📡 Consumer is running and processing messages...');
    console.log('🛑 Press Ctrl+C to stop gracefully');
    console.log('');
    
    // Show initial health status
    await showHealthStatus();
    
    // Keep the process alive
    process.stdin.resume();
    
    // Set up periodic health checks
    const healthCheckInterval = setInterval(async () => {
      if (!shutdownInProgress) {
        await showHealthStatus();
      }
    }, 60000); // Check every minute
    
    // Clean up interval on shutdown
    process.on('SIGINT', () => {
      clearInterval(healthCheckInterval);
      gracefulShutdown();
    });
    
  } catch (error) {
    console.error('❌ Failed to start:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

async function showHealthStatus() {
  try {
    if (!kafka) return;
    
    const health = kafka.getHealthStatus();
    const processorInfo = kafka.getProcessorRegistryInfo();
    
    console.log('📊 Health Status:', new Date().toLocaleTimeString());
    console.log(`  Producer: ${health.producer.initialized ? '✅' : '❌'}`);
    console.log(`  Consumer: ${health.consumer.initialized ? '✅' : '❌'}`);
    console.log(`  Admin: ${health.admin.initialized ? '✅' : '❌'}`);
    
    if (processorInfo) {
      console.log(`  Processors: ${processorInfo.availableTopics.length} topics`);
      if (processorInfo.availableTopics.length > 0) {
        console.log(`    Topics: ${processorInfo.availableTopics.join(', ')}`);
      }
    }
    
    console.log('');
    
  } catch (error) {
    console.error('⚠️  Health check failed:', error.message);
  }
}

async function gracefulShutdown() {
  if (shutdownInProgress) return;
  
  shutdownInProgress = true;
  console.log('\n🛑 Shutting down gracefully...');
  
  try {
    if (kafka) {
      console.log('🔌 Disconnecting Kafka clients...');
      await kafka.disconnect();
      console.log('✅ Kafka clients disconnected');
    }
    
    console.log('👋 Shutdown completed');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error.message);
    process.exit(1);
  }
}

// Handle various shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('💥 Uncaught Exception:', error.message);
  if (error.stack) {
    console.error('Stack trace:', error.stack);
  }
  gracefulShutdown();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Unhandled Rejection at:', promise, 'reason:', reason);
  gracefulShutdown();
});

// Start the application
main();

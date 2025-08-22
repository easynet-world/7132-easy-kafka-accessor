#!/usr/bin/env node

/**
 * Kafka Data Accessor
 * Simple Kafka producer and consumer library
 */

const KafkaAccessor = require('./src/kafka-accessor');
const BaseProcessor = require('./src/base-processor');
const ProcessorRegistry = require('./src/processor-registry');
const SystemLogsProcessor = require('./processors/system-logs');

// Export the main classes
module.exports = {
  KafkaAccessor,
  BaseProcessor,
  ProcessorRegistry,
  SystemLogsProcessor
};

// If run directly, show usage
if (require.main === module) {
  console.log(`
Kafka Data Accessor - Simple Kafka Library

Usage:
  const { KafkaAccessor } = require('kafka-data-accessor');
  
  // No parameters needed - uses .env configuration
  const kafka = new KafkaAccessor();

  // Send a message (producer auto-initializes)
  await kafka.sendMessage('my-topic', { message: 'Hello!' });
  
  // Start consuming messages (consumer auto-initializes and subscribes to all processor topics)
  await kafka.startConsumer();
  // That's it! All processors/[topic-name].js files are automatically loaded

See README.md for more examples.
`);
}

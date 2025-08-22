#!/usr/bin/env node

/**
 * Kafka Accessor Main Entry Point
 * 
 * This script allows running the Kafka accessor in different modes:
 * - producer: Start producer service
 * - consumer: Start consumer service  
 * - both: Start both producer and consumer services
 */

const { program } = require('commander');
const KafkaProducer = require('./src/producer');
const KafkaConsumer = require('./src/consumer');
const SystemLogsProcessor = require('./processors/system-logs');

program
  .name('kafka-accessor')
  .description('Kafka producer and consumer service')
  .version('0.0.1');

program
  .command('producer')
  .description('Start Kafka producer service')
  .action(async () => {
    console.log('Starting Kafka Producer service...');
    const producer = new KafkaProducer();
    await producer.start();
  });

program
  .command('consumer')
  .description('Start Kafka consumer service')
  .option('-t, --topics <topics>', 'Comma-separated list of topics to consume', 'system-logs')
  .action(async (options) => {
    console.log('Starting Kafka Consumer service...');
    const consumer = new KafkaConsumer();
    
    // Register the system logs processor
    const systemLogsProcessor = new SystemLogsProcessor();
    
    await consumer.init();
    
    // Subscribe to specified topics
    const topics = options.topics.split(',').map(t => t.trim());
    for (const topic of topics) {
      if (topic === 'system-logs' || topic === 'logs' || topic === 'system') {
        await consumer.subscribeToTopic(topic, systemLogsProcessor);
        console.log(`Subscribed to topic: ${topic} with SystemLogsProcessor`);
      } else {
        console.log(`Warning: No processor available for topic: ${topic}`);
      }
    }
    
    await consumer.start();
  });

program
  .command('both')
  .description('Start both producer and consumer services')
  .option('-t, --topics <topics>', 'Comma-separated list of topics to consume', 'system-logs')
  .action(async (options) => {
    console.log('Starting both Kafka Producer and Consumer services...');
    
    // Start producer
    const producer = new KafkaProducer();
    
    // Start consumer
    const consumer = new KafkaConsumer();
    const systemLogsProcessor = new SystemLogsProcessor();
    
    await consumer.init();
    
    // Subscribe to specified topics
    const topics = options.topics.split(',').map(t => t.trim());
    for (const topic of topics) {
      if (topic === 'system-logs' || topic === 'logs' || topic === 'system') {
        await consumer.subscribeToTopic(topic, systemLogsProcessor);
        console.log(`Subscribed to topic: ${topic} with SystemLogsProcessor`);
      } else {
        console.log(`Warning: No processor available for topic: ${topic}`);
      }
    }
    
    // Start both services
    await Promise.all([
      producer.start(),
      consumer.start()
    ]);
  });

// Default action if no command is provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();

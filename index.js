#!/usr/bin/env node

/**
 * Kafka Data Accessor
 * Simple Kafka producer and consumer library with self-starter capability
 */

const KafkaAccessor = require('./src/kafka-accessor');
const KafkaTopicProcessor = require('./src/kafka-topic-processor');
const ProcessorRegistry = require('./src/processor-registry');
const SystemLogsProcessor = require('./processors/system-logs');

// Export the main classes
module.exports = {
  KafkaAccessor,
  KafkaTopicProcessor,
  ProcessorRegistry,
  SystemLogsProcessor
};

// If run directly, provide CLI functionality
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0];

  // Load environment variables
  require('dotenv').config();

  switch (command) {
    case 'start':
    case 'run':
      // Start the standalone application
      require('./app.js');
      break;
      
    case 'help':
    case '--help':
    case '-h':
      showHelp();
      break;
      
    case 'version':
    case '--version':
    case '-v':
      showVersion();
      break;
      
    case 'health':
      // Show health status
      showHealthStatus();
      break;
      
    case 'processors':
      // List available processors
      listProcessors();
      break;
      
    default:
      if (command && !command.startsWith('-')) {
        console.error(`❌ Unknown command: ${command}`);
        console.error('Use "easy-kafka-accessor help" for available commands');
        process.exit(1);
      } else {
        showUsage();
      }
      break;
  }
}

function showHelp() {
  console.log(`
🚀 Easy Kafka Accessor - Self-Starter CLI

USAGE:
  easy-kafka-accessor <command> [options]

COMMANDS:
  start, run     Start the standalone Kafka consumer application
  health         Show health status and configuration
  processors     List available message processors
  help           Show this help message
  version        Show version information

EXAMPLES:
  # Start the standalone application
  easy-kafka-accessor start
  
  # Show health status
  easy-kafka-accessor health
  
  # List processors
  easy-kafka-accessor processors

ENVIRONMENT VARIABLES:
  KAFKA_BROKERS          Kafka broker addresses (default: localhost:9092)
  KAFKA_CLIENT_ID        Client ID (default: kafka-accessor)
  KAFKA_GROUP_ID         Consumer group ID (default: kafka-accessor-group)
  PROCESSORS_DIR         Processors directory (default: ./processors)
  LOG_LEVEL              Logging level (default: info)

LIBRARY USAGE:
  const { KafkaAccessor } = require('easy-kafka-accessor');
  
  const kafka = new KafkaAccessor();
  await kafka.sendMessage('my-topic', { message: 'Hello!' });
  await kafka.startConsumer();

For more information, see: https://github.com/easynet-world/7132-easy-kafka-accessor
`);
}

function showVersion() {
  const packageJson = require('./package.json');
  console.log(`easy-kafka-accessor v${packageJson.version}`);
}

function showUsage() {
  console.log(`
Kafka Data Accessor - Simple Kafka Library

Usage:
  const { KafkaAccessor } = require('easy-kafka-accessor');
  
  // No parameters needed - uses .env configuration
  const kafka = new KafkaAccessor();

  // Send a message (producer auto-initializes)
  await kafka.sendMessage('my-topic', { message: 'Hello!' });
  
  // Start consuming messages (consumer auto-initializes and subscribes to all processor topics)
  await kafka.startConsumer();
  // That's it! All processors/[topic-name].js files are automatically loaded

CLI Commands:
  easy-kafka-accessor start     # Start standalone application
  easy-kafka-accessor help      # Show help
  easy-kafka-accessor health    # Show health status

See README.md for more examples.
`);
}

async function showHealthStatus() {
  try {
    console.log('🔍 Checking Kafka Accessor health...');
    
    const kafka = new KafkaAccessor();
    const health = kafka.getHealthStatus();
    
    console.log('\n📊 Health Status:');
    console.log(`  Producer: ${health.producer.initialized ? '✅ Initialized' : '❌ Not Initialized'}`);
    console.log(`  Consumer: ${health.consumer.initialized ? '✅ Initialized' : '❌ Not Initialized'}`);
    console.log(`  Admin: ${health.admin.initialized ? '✅ Initialized' : '❌ Not Initialized'}`);
    
    console.log('\n⚙️  Configuration:');
    console.log(`  Brokers: ${health.config.brokers}`);
    console.log(`  Client ID: ${health.config.clientId}`);
    console.log(`  Group ID: ${health.config.groupId}`);
    
    if (health.processorRegistry) {
      console.log('\n🔧 Processor Registry:');
      console.log(`  Auto-refresh: ${health.processorRegistry.enabled ? '✅ Enabled' : '❌ Disabled'}`);
      console.log(`  Available Topics: ${health.processorRegistry.processors.length}`);
      if (health.processorRegistry.processors.length > 0) {
        health.processorRegistry.processors.forEach(topic => {
          console.log(`    - ${topic}`);
        });
      }
    }
    
    console.log('\n✅ Health check completed');
    
  } catch (error) {
    console.error('❌ Health check failed:', error.message);
    process.exit(1);
  }
}

async function listProcessors() {
  try {
    console.log('🔍 Scanning for available processors...');
    
    const kafka = new KafkaAccessor();
    const processorInfo = kafka.getProcessorRegistryInfo();
    
    if (!processorInfo) {
      console.log('❌ Processor registry not available');
      return;
    }
    
    console.log('\n📁 Processors Directory:', processorInfo.directory);
    console.log(`🔄 Auto-refresh: ${processorInfo.autoRefresh.enabled ? '✅ Enabled' : '❌ Disabled'}`);
    
    if (processorInfo.availableTopics.length === 0) {
      console.log('\n📋 No processors found');
      console.log('💡 Create processor files in the processors directory to get started');
    } else {
      console.log(`\n📋 Found ${processorInfo.availableTopics.length} processor(s):`);
      
      for (const topic of processorInfo.availableTopics) {
        const info = processorInfo.fileInfo[topic];
        if (info) {
          console.log(`  📄 ${topic} (${info.filePath})`);
        } else {
          console.log(`  📄 ${topic}`);
        }
      }
    }
    
    console.log('\n✅ Processor scan completed');
    
  } catch (error) {
    console.error('❌ Processor scan failed:', error.message);
    process.exit(1);
  }
}

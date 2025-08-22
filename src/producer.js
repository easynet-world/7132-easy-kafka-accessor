const KafkaAccessor = require('./kafka-accessor');
require('dotenv').config();

class KafkaProducer {
  constructor(config = {}) {
    this.accessor = new KafkaAccessor({
      ...config,
      clientId: config.clientId || `${process.env.KAFKA_CLIENT_ID || 'kafka-accessor'}-producer-${process.pid}`
    });
    
    this.isRunning = false;
    this.setupGracefulShutdown();
  }

  /**
   * Initialize the producer
   */
  async init() {
    try {
      await this.accessor.initProducer();
      this.isRunning = true;
      console.log('Kafka producer initialized and ready');
    } catch (error) {
      console.error('Failed to initialize producer:', error);
      process.exit(1);
    }
  }

  /**
   * Send a message to a specific topic
   * @param {string} topic - Topic name
   * @param {Object} payload - Message payload
   * @param {Object} options - Additional options
   */
  async sendMessage(topic, payload, options = {}) {
    if (!this.isRunning) {
      throw new Error('Producer not initialized');
    }

    return await this.accessor.sendMessage(topic, payload, options);
  }

  /**
   * Create a topic explicitly
   * @param {string} topic - Topic name
   * @param {Object} options - Topic creation options
   */
  async createTopic(topic, options = {}) {
    if (!this.isRunning) {
      throw new Error('Producer not initialized');
    }

    return await this.accessor.createTopic(topic, options);
  }

  /**
   * Ensure a topic exists, create if it doesn't
   * @param {string} topic - Topic name
   * @param {Object} options - Topic creation options
   */
  async ensureTopicExists(topic, options = {}) {
    if (!this.isRunning) {
      throw new Error('Producer not initialized');
    }

    return await this.accessor.ensureTopicExists(topic, options);
  }

  /**
   * Send multiple messages to a topic
   * @param {string} topic - Topic name
   * @param {Array} messages - Array of message payloads
   * @param {Object} options - Additional options
   */
  async sendBatch(topic, messages, options = {}) {
    if (!this.isRunning) {
      throw new Error('Producer not initialized');
    }

    const results = [];
    for (const message of messages) {
      try {
        const result = await this.accessor.sendMessage(topic, message, options);
        results.push({ success: true, result });
      } catch (error) {
        results.push({ success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Get producer health status
   */
  getHealthStatus() {
    return this.accessor.getHealthStatus();
  }

  /**
   * Setup graceful shutdown
   */
  setupGracefulShutdown() {
    const shutdown = async (signal) => {
      console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
      this.isRunning = false;
      
      try {
        await this.accessor.disconnect();
        console.log('Producer shutdown completed');
        process.exit(0);
      } catch (error) {
        console.error('Error during shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGUSR2', () => shutdown('SIGUSR2')); // For nodemon
  }

  /**
   * Start the producer service
   */
  async start() {
    await this.init();
    
    // Keep the process alive
    setInterval(() => {
      if (this.isRunning) {
        const health = this.getHealthStatus();
        console.log('Producer health check:', JSON.stringify(health, null, 2));
      }
    }, 30000); // Health check every 30 seconds
  }
}

// If this file is run directly, start the producer service
if (require.main === module) {
  const producer = new KafkaProducer();
  producer.start().catch(error => {
    console.error('Failed to start producer:', error);
    process.exit(1);
  });
}

module.exports = KafkaProducer;


const KafkaAccessor = require('./kafka-accessor');
require('dotenv').config();

class KafkaConsumer {
  constructor(config = {}) {
    this.accessor = new KafkaAccessor({
      ...config,
      clientId: config.clientId || `${process.env.KAFKA_CLIENT_ID || 'kafka-accessor'}-consumer-${process.pid}`,
      groupId: config.groupId || `${process.env.KAFKA_GROUP_ID || 'kafka-accessor-group'}-${process.pid}`
    });
    
    this.isRunning = false;
    this.subscribedTopics = new Map();
    this.setupGracefulShutdown();
  }

  /**
   * Initialize the consumer
   */
  async init() {
    try {
      await this.accessor.initConsumer();
      this.isRunning = true;
      console.log('Kafka consumer initialized and ready');
    } catch (error) {
      console.error('Failed to initialize consumer:', error);
      process.exit(1);
    }
  }

  /**
   * Subscribe to a topic with a message handler
   * @param {string} topic - Topic name
   * @param {Function} messageHandler - Function to process messages
   * @param {Object} options - Additional options
   */
  async subscribeToTopic(topic, messageHandler, options = {}) {
    if (!this.isRunning) {
      throw new Error('Consumer not initialized');
    }

    if (this.subscribedTopics.has(topic)) {
      console.warn(`Already subscribed to topic: ${topic}`);
      return;
    }

    try {
      await this.accessor.subscribeToTopic(topic, messageHandler, options);
      this.subscribedTopics.set(topic, { messageHandler, options });
      console.log(`Successfully subscribed to topic: ${topic}`);
    } catch (error) {
      console.error(`Failed to subscribe to topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Subscribe to multiple topics
   * @param {Array} subscriptions - Array of {topic, messageHandler, options}
   */
  async subscribeToTopics(subscriptions) {
    const results = [];
    
    for (const subscription of subscriptions) {
      try {
        await this.subscribeToTopic(
          subscription.topic,
          subscription.messageHandler,
          subscription.options || {}
        );
        results.push({ topic: subscription.topic, success: true });
      } catch (error) {
        results.push({ topic: subscription.topic, success: false, error: error.message });
      }
    }

    return results;
  }

  /**
   * Unsubscribe from a topic
   * @param {string} topic - Topic name
   */
  async unsubscribeFromTopic(topic) {
    if (!this.subscribedTopics.has(topic)) {
      console.warn(`Not subscribed to topic: ${topic}`);
      return;
    }

    try {
      // Note: KafkaJS doesn't support unsubscribing from specific topics
      // This would require reconnecting the consumer
      console.log(`Unsubscribing from topic: ${topic}`);
      this.subscribedTopics.delete(topic);
    } catch (error) {
      console.error(`Failed to unsubscribe from topic ${topic}:`, error);
      throw error;
    }
  }

  /**
   * Get consumer health status
   */
  getHealthStatus() {
    const status = this.accessor.getHealthStatus();
    return {
      ...status,
      subscribedTopics: Array.from(this.subscribedTopics.keys()),
      isRunning: this.isRunning
    };
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
        console.log('Consumer shutdown completed');
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
   * Start the consumer service
   */
  async start() {
    await this.init();
    
    // Keep the process alive
    setInterval(() => {
      if (this.isRunning) {
        const health = this.getHealthStatus();
        console.log('Consumer health check:', JSON.stringify(health, null, 2));
      }
    }, 30000); // Health check every 30 seconds
  }
}

// If this file is run directly, start the consumer service
if (require.main === module) {
  const consumer = new KafkaConsumer();
  consumer.start().catch(error => {
    console.error('Failed to start consumer:', error);
    process.exit(1);
  });
}

module.exports = KafkaConsumer;


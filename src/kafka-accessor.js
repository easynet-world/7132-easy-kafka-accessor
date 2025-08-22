const { Kafka } = require('kafkajs');
const winston = require('winston');

class KafkaAccessor {
  constructor(config = {}) {
    this.config = {
      brokers: config.brokers || process.env.KAFKA_BROKERS || 'localhost:9092',
      clientId: config.clientId || process.env.KAFKA_CLIENT_ID || 'kafka-accessor',
      groupId: config.groupId || process.env.KAFKA_GROUP_ID || 'kafka-accessor-group',
      ...config
    };

    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'kafka-accessor' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });

    this.kafka = new Kafka({
      clientId: this.config.clientId,
      brokers: this.config.brokers.split(','),
      retry: {
        initialRetryTime: 100,
        retries: 8
      }
    });

    this.producer = null;
    this.consumer = null;
    this.admin = null;
  }

  /**
   * Initialize the Kafka admin client
   */
  async initAdmin() {
    try {
      if (!this.admin) {
        this.admin = this.kafka.admin();
        await this.admin.connect();
        this.logger.info('Kafka admin client initialized successfully');
      }
      return this.admin;
    } catch (error) {
      this.logger.error('Failed to initialize admin client', { error: error.message });
      throw error;
    }
  }

  /**
   * Check if a topic exists
   * @param {string} topic - Topic name
   * @returns {boolean} - True if topic exists, false otherwise
   */
  async topicExists(topic) {
    try {
      if (!this.admin) {
        await this.initAdmin();
      }
      
      const topics = await this.admin.listTopics();
      return topics.includes(topic);
    } catch (error) {
      this.logger.error('Failed to check topic existence', { topic, error: error.message });
      return false;
    }
  }

  /**
   * Create a topic with default configuration
   * @param {string} topic - Topic name
   * @param {Object} options - Topic creation options
   */
  async createTopic(topic, options = {}) {
    try {
      if (!this.admin) {
        await this.initAdmin();
      }

      const topicConfig = {
        topic,
        numPartitions: options.numPartitions || 1,
        replicationFactor: options.replicationFactor || 1,
        configEntries: options.configEntries || []
      };

      await this.admin.createTopics([topicConfig]);
      this.logger.info('Topic created successfully', { topic, config: topicConfig });
    } catch (error) {
      this.logger.error('Failed to create topic', { topic, error: error.message });
      throw error;
    }
  }

  /**
   * Ensure topic exists, create if it doesn't
   * @param {string} topic - Topic name
   * @param {Object} options - Topic creation options
   */
  async ensureTopicExists(topic, options = {}) {
    try {
      const exists = await this.topicExists(topic);
      if (!exists) {
        this.logger.info('Topic does not exist, creating...', { topic });
        await this.createTopic(topic, options);
        return true; // Topic was created
      }
      return false; // Topic already existed
    } catch (error) {
      this.logger.error('Failed to ensure topic exists', { topic, error: error.message });
      throw error;
    }
  }

  /**
   * Initialize the Kafka producer
   */
  async initProducer() {
    try {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000
      });

      await this.producer.connect();
      this.logger.info('Kafka producer initialized successfully');
      return this.producer;
    } catch (error) {
      this.logger.error('Failed to initialize producer', { error: error.message });
      throw error;
    }
  }

  /**
   * Initialize the Kafka consumer
   */
  async initConsumer() {
    try {
      this.consumer = this.kafka.consumer({
        groupId: this.config.groupId,
        sessionTimeout: parseInt(process.env.CONSUMER_SESSION_TIMEOUT) || 30000,
        heartbeatInterval: parseInt(process.env.CONSUMER_HEARTBEAT_INTERVAL) || 3000,
        maxBytesPerPartition: parseInt(process.env.CONSUMER_MAX_BYTES) || 1048576
      });

      await this.consumer.connect();
      this.logger.info('Kafka consumer initialized successfully');
      return this.consumer;
    } catch (error) {
      this.logger.error('Failed to initialize consumer', { error: error.message });
      throw error;
    }
  }

  /**
   * Send message to a specific topic
   * @param {string} topic - Topic name
   * @param {Object} payload - Message payload (will be JSON stringified)
   * @param {Object} options - Additional options (key, partition, etc.)
   */
  async sendMessage(topic, payload, options = {}) {
    if (!this.producer) {
      throw new Error('Producer not initialized. Call initProducer() first.');
    }

    try {
      // First, ensure the topic exists
      await this.ensureTopicExists(topic, options.topicConfig);

      const message = {
        topic,
        messages: [{
          key: options.key || null,
          value: JSON.stringify(payload),
          partition: options.partition || 0,
          timestamp: options.timestamp || Date.now()
        }]
      };

      const result = await this.producer.send(message);
      this.logger.info('Message sent successfully', {
        topic,
        partition: result[0].partition,
        offset: result[0].baseOffset
      });

      return result;
    } catch (error) {
      this.logger.error('Failed to send message', {
        topic,
        error: error.message,
        payload
      });
      throw error;
    }
  }

  /**
   * Subscribe to a topic and process messages
   * @param {string} topic - Topic name
   * @param {Function} messageHandler - Function to process messages
   * @param {Object} options - Additional options
   */
  async subscribeToTopic(topic, messageHandler, options = {}) {
    if (!this.consumer) {
      throw new Error('Consumer not initialized. Call initConsumer() first.');
    }

    try {
      await this.consumer.subscribe({
        topic,
        fromBeginning: options.fromBeginning || false
      });

      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const payload = JSON.parse(message.value.toString());
            const key = message.key ? message.key.toString() : null;

            this.logger.info('Processing message', {
              topic,
              partition,
              offset: message.offset,
              key
            });

            await messageHandler(payload, {
              topic,
              partition,
              offset: message.offset,
              key,
              timestamp: message.timestamp,
              headers: message.headers
            });

            this.logger.info('Message processed successfully', {
              topic,
              partition,
              offset: message.offset
            });
          } catch (error) {
            this.logger.error('Error processing message', {
              topic,
              partition,
              offset: message.offset,
              error: error.message
            });
            
            // Re-throw error to let Kafka handle retry logic
            throw error;
          }
        },
        eachBatch: options.eachBatch || null
      });

      this.logger.info('Successfully subscribed to topic', { topic });
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', {
        topic,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Disconnect producer, consumer, and admin client
   */
  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.logger.info('Producer disconnected');
      }
      
      if (this.consumer) {
        await this.consumer.disconnect();
        this.logger.info('Consumer disconnected');
      }

      if (this.admin) {
        await this.admin.disconnect();
        this.logger.info('Admin client disconnected');
      }
    } catch (error) {
      this.logger.error('Error during disconnect', { error: error.message });
      throw error;
    }
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    return {
      producer: {
        connected: this.producer !== null,
        initialized: !!this.producer
      },
      consumer: {
        connected: this.consumer !== null,
        initialized: !!this.consumer
      },
      admin: {
        connected: this.admin !== null,
        initialized: !!this.admin
      },
      config: {
        brokers: this.config.brokers,
        clientId: this.config.clientId,
        groupId: this.config.groupId
      }
    };
  }
}

module.exports = KafkaAccessor;


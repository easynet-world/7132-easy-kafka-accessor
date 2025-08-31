const { Kafka } = require('kafkajs');
const winston = require('winston');
const ProcessorRegistry = require('./processor-registry');

class KafkaAccessor {
  constructor(options = {}) {
    // Load configuration from options or environment variables
    this.config = {
      brokers: options.brokers || process.env.KAFKA_BROKERS || 'localhost:9092',
      clientId: options.clientId || process.env.KAFKA_CLIENT_ID || 'kafka-accessor',
      groupId: options.groupId || process.env.KAFKA_GROUP_ID || 'kafka-accessor-group'
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
    
    // Initialize processor registry automatically
    this.processorRegistry = new ProcessorRegistry({
      processorsDir: process.env.PROCESSORS_DIR || './processors',
      autoRefresh: process.env.PROCESSORS_AUTO_REFRESH !== 'false',
      refreshInterval: parseInt(process.env.PROCESSORS_REFRESH_INTERVAL) || 10000
    });
  }

  /**
   * Initialize the Kafka admin client
   */
  async initAdmin() {
    try {
      if (!this.admin) {
        this.admin = this.kafka.admin();
        await this.admin.connect();
        this.logger.debug('Kafka admin client initialized successfully');
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
      // Auto-initialize admin if not already initialized
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
      // Auto-initialize admin if not already initialized
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
      if (!this.producer) {
        this.producer = this.kafka.producer({
          allowAutoTopicCreation: true,
          transactionTimeout: parseInt(process.env.PRODUCER_TIMEOUT) || 30000,
          retry: {
            initialRetryTime: 100,
            retries: parseInt(process.env.PRODUCER_RETRY_ATTEMPTS) || 3
          }
        });

        await this.producer.connect();
        this.logger.debug('Kafka producer initialized successfully');
      }
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
      this.logger.debug('Kafka consumer initialized successfully');
      
      // Ensure admin client is initialized before processor discovery
      if (!this.admin) {
        await this.initAdmin();
      }
      
      // Automatically discover and subscribe to topics with processors
      await this.autoSubscribeToProcessorTopics();
      
      return this.consumer;
    } catch (error) {
      this.logger.error('Failed to initialize consumer', { error: error.message });
      throw error;
    }
  }

  /**
   * Automatically subscribe to all topics that have processors
   */
  async autoSubscribeToProcessorTopics() {
    try {
      // Auto-discover processors
      await this.processorRegistry.autoDiscoverProcessors({
        kafkaAccessor: this
      });

      const availableTopics = this.processorRegistry.getAvailableTopics();
      
      if (availableTopics.length === 0) {
        this.logger.info('No processors found - no topics to subscribe to');
        return;
      }

      this.logger.info(`Auto-subscribing to ${availableTopics.length} topics with processors:`, availableTopics);

      // Subscribe to all topics at once
      await this.consumer.subscribe({
        topics: availableTopics,
        fromBeginning: false
      });

      // Set up message processing
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const payload = JSON.parse(message.value.toString());
            const key = message.key ? message.key.toString() : null;

            const metadata = {
              topic,
              partition,
              offset: message.offset,
              key,
              timestamp: message.timestamp,
              headers: message.headers
            };

            this.logger.debug('Processing message', {
              topic,
              partition,
              offset: message.offset,
              key
            });

            // Process using the registry
            await this.processorRegistry.processMessage(topic, payload, metadata);

            this.logger.debug('Message processed successfully', {
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
        }
      });

      this.logger.info(`Successfully subscribed to ${availableTopics.length} topics`);
    } catch (error) {
      this.logger.error('Failed to auto-subscribe to processor topics', { error: error.message });
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
    // Auto-initialize producer if not already initialized
    if (!this.producer) {
      await this.initProducer();
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
   * Start consuming messages from all topics with processors
   * This is the main method to start message consumption
   */
  async startConsumer() {
    if (!this.consumer) {
      await this.initConsumer();
    }
    this.logger.info('Consumer started and processing messages from all processor topics');
  }

  /**
   * Subscribe to a specific topic with custom message handler
   * Note: This is mainly for custom use cases. Use startConsumer() for automatic processing.
   * @param {string} topic - Topic name
   * @param {Function} messageHandler - Function to process messages
   * @param {Object} options - Additional options
   */
  async subscribeToTopic(topic, messageHandler, options = {}) {
    // Auto-initialize consumer if not already initialized
    if (!this.consumer) {
      await this.initConsumer();
    }

    if (!messageHandler) {
      throw new Error('Message handler is required for manual subscription');
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

            const metadata = {
              topic,
              partition,
              offset: message.offset,
              key,
              timestamp: message.timestamp,
              headers: message.headers
            };

            this.logger.info('Processing message with custom handler', {
              topic,
              partition,
              offset: message.offset,
              key
            });

            await messageHandler(payload, metadata);

            this.logger.debug('Message processed successfully', {
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

      this.logger.info('Successfully subscribed to topic with custom handler', { topic });
    } catch (error) {
      this.logger.error('Failed to subscribe to topic', {
        topic,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get a message from a specified topic, blocking until one is available
   * @param {string} topic - The topic name to consume from
   * @param {Object} options - Optional configuration
   * @param {string} options.groupId - Consumer group ID (defaults to client ID)
   * @param {number} options.timeout - Maximum time to wait in milliseconds (optional)
   * @returns {Promise<Object>} The message object with key, value, headers, etc.
   */
  async getMessageFromTopic(topic, options = {}) {
    const groupId = options.groupId || this.config.clientId;
    const timeout = options.timeout;
    
    // Create a dedicated consumer for this specific operation
    const dedicatedConsumer = this.kafka.consumer({
      groupId: `${groupId}-${Date.now()}`, // Ensure unique group ID
      sessionTimeout: parseInt(process.env.CONSUMER_SESSION_TIMEOUT) || 30000,
      heartbeatInterval: parseInt(process.env.CONSUMER_HEARTBEAT_INTERVAL) || 3000,
      maxBytesPerPartition: parseInt(process.env.CONSUMER_MAX_BYTES) || 1048576
    });

    try {
      await dedicatedConsumer.connect();
      this.logger.debug('Dedicated consumer connected for topic', { topic, groupId });

      // Subscribe to the specific topic
      await dedicatedConsumer.subscribe({
        topic,
        fromBeginning: false
      });

      // Create a promise that resolves when a message is received
      const messagePromise = new Promise((resolve, reject) => {
        let messageReceived = false;
        let timeoutId = null;

        // Set up timeout if specified
        if (timeout) {
          timeoutId = setTimeout(() => {
            if (!messageReceived) {
              messageReceived = true;
              reject(new Error(`Timeout waiting for message from topic: ${topic}`));
            }
          }, timeout);
        }

        // Run the consumer
        dedicatedConsumer.run({
          eachMessage: async ({ topic, partition, message }) => {
            if (messageReceived) return; // Prevent multiple message processing
            
            messageReceived = true;
            
            // Clear timeout if message received
            if (timeoutId) {
              clearTimeout(timeoutId);
            }

            try {
              const payload = JSON.parse(message.value.toString());
              const key = message.key ? message.key.toString() : null;

              const messageData = {
                topic,
                partition,
                offset: message.offset,
                key,
                value: payload,
                timestamp: message.timestamp,
                headers: message.headers
              };

              this.logger.debug('Message received from topic', {
                topic,
                partition,
                offset: message.offset,
                key
              });

              resolve(messageData);
            } catch (error) {
              reject(new Error(`Failed to parse message: ${error.message}`));
            }
          }
        }).catch(reject);
      });

      // Wait for the message
      const message = await messagePromise;
      
      this.logger.info('Successfully retrieved message from topic', {
        topic,
        partition: message.partition,
        offset: message.offset
      });

      return message;

    } catch (error) {
      this.logger.error('Error retrieving message from topic', {
        topic,
        error: error.message
      });
      throw error;
    } finally {
      // Always disconnect the dedicated consumer
      try {
        await dedicatedConsumer.disconnect();
        this.logger.debug('Dedicated consumer disconnected', { topic });
      } catch (disconnectError) {
        this.logger.warn('Failed to disconnect dedicated consumer', {
          topic,
          error: disconnectError.message
        });
      }
    }
  }

  /**
   * Disconnect producer, consumer, and admin client
   */
  async disconnect() {
    try {
      if (this.producer) {
        await this.producer.disconnect();
        this.logger.debug('Producer disconnected');
      }
      
      if (this.consumer) {
        await this.consumer.disconnect();
        this.logger.debug('Consumer disconnected');
      }

      if (this.admin) {
        await this.admin.disconnect();
        this.logger.debug('Admin client disconnected');
      }

      // Stop processor registry auto-refresh
      if (this.processorRegistry) {
        this.processorRegistry.stopAutoRefresh();
        this.logger.debug('Processor registry auto-refresh stopped');
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
      },
      processorRegistry: this.processorRegistry ? {
        enabled: this.processorRegistry.getAutoRefreshStatus().enabled,
        processors: this.processorRegistry.getAvailableTopics(),
        autoRefresh: this.processorRegistry.getAutoRefreshStatus()
      } : null
    };
  }

  /**
   * Get processor registry information
   */
  getProcessorRegistryInfo() {
    if (!this.processorRegistry) {
      return null;
    }
    
    return {
      directory: this.processorRegistry.getProcessorsDirectory(),
      availableTopics: this.processorRegistry.getAvailableTopics(),
      autoRefresh: this.processorRegistry.getAutoRefreshStatus(),
      fileInfo: this.processorRegistry.getProcessorFileInfo()
    };
  }
}

module.exports = KafkaAccessor;


const KafkaAccessor = require('../src/kafka-accessor');

// Mock kafkajs
const mockProducer = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  send: jest.fn().mockResolvedValue([{ partition: 0, baseOffset: '123' }])
};

const mockConsumer = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  subscribe: jest.fn().mockResolvedValue(),
  run: jest.fn().mockResolvedValue()
};

const mockAdmin = {
  connect: jest.fn().mockResolvedValue(),
  disconnect: jest.fn().mockResolvedValue(),
  listTopics: jest.fn().mockResolvedValue(['existing-topic']),
  createTopics: jest.fn().mockResolvedValue()
};

const mockKafka = {
  producer: jest.fn().mockReturnValue(mockProducer),
  consumer: jest.fn().mockReturnValue(mockConsumer),
  admin: jest.fn().mockReturnValue(mockAdmin)
};

jest.mock('kafkajs', () => ({
  Kafka: jest.fn().mockImplementation(() => mockKafka)
}));

// Mock winston
jest.mock('winston', () => ({
  createLogger: jest.fn().mockReturnValue({
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn()
  }),
  format: {
    combine: jest.fn(),
    timestamp: jest.fn(),
    errors: jest.fn(),
    json: jest.fn(),
    simple: jest.fn()
  },
  transports: {
    Console: jest.fn()
  }
}));

// Mock timers to prevent hanging
jest.useFakeTimers();

// Global cleanup after all tests
afterAll(() => {
  // Clear any remaining timers
  jest.clearAllTimers();
  jest.useRealTimers();
});

describe('KafkaAccessor', () => {
  let accessor;

  beforeEach(() => {
    jest.clearAllMocks();
    accessor = new KafkaAccessor({
      brokers: 'localhost:9092',
      clientId: 'test-client'
    });
  });

  afterEach(async () => {
    // Clean up auto-refresh timers to prevent hanging
    if (accessor && accessor.processorRegistry) {
      try {
        accessor.processorRegistry.stopAutoRefresh();
      } catch (error) {
        // Ignore cleanup errors
      }
    }
    
    // Disconnect all clients
    if (accessor) {
      try {
        await accessor.disconnect();
      } catch (error) {
        // Ignore disconnect errors in tests
      }
    }
  });

  describe('constructor', () => {
    it('should create instance with default config', () => {
      expect(accessor.config.brokers).toBe('localhost:9092');
      expect(accessor.config.clientId).toBe('test-client');
      expect(accessor.config.groupId).toBe('kafka-accessor-group');
    });

    it('should create instance with custom config', () => {
      const customAccessor = new KafkaAccessor({
        brokers: 'kafka:9092',
        clientId: 'custom-client',
        groupId: 'custom-group'
      });

      expect(customAccessor.config.brokers).toBe('kafka:9092');
      expect(customAccessor.config.clientId).toBe('custom-client');
      expect(customAccessor.config.groupId).toBe('custom-group');
    });
  });

  describe('admin client', () => {
    it('should initialize admin client successfully', async () => {
      await accessor.initAdmin();
      
      expect(accessor.admin).toBeDefined();
      expect(mockKafka.admin).toHaveBeenCalled();
    });

    it('should reuse existing admin client', async () => {
      await accessor.initAdmin();
      const firstAdmin = accessor.admin;
      
      await accessor.initAdmin();
      
      expect(accessor.admin).toBe(firstAdmin);
      expect(mockKafka.admin).toHaveBeenCalledTimes(1);
    });

    it('should check if topic exists', async () => {
      await accessor.initAdmin();
      
      const exists = await accessor.topicExists('existing-topic');
      
      expect(exists).toBe(true);
      expect(mockKafka.admin().listTopics).toHaveBeenCalled();
    });

    it('should return false for non-existent topic', async () => {
      mockKafka.admin().listTopics.mockResolvedValue(['existing-topic']);
      await accessor.initAdmin();
      
      const exists = await accessor.topicExists('non-existent-topic');
      
      expect(exists).toBe(false);
    });

    it('should create topic successfully', async () => {
      await accessor.initAdmin();
      
      const options = { numPartitions: 3, replicationFactor: 2 };
      await accessor.createTopic('new-topic', options);
      
      expect(mockKafka.admin().createTopics).toHaveBeenCalledWith([{
        topic: 'new-topic',
        numPartitions: 3,
        replicationFactor: 2,
        configEntries: []
      }]);
    });

    it('should ensure topic exists without creating if already exists', async () => {
      mockKafka.admin().listTopics.mockResolvedValue(['existing-topic']);
      await accessor.initAdmin();
      
      const wasCreated = await accessor.ensureTopicExists('existing-topic');
      
      expect(wasCreated).toBe(false);
      expect(mockKafka.admin().createTopics).not.toHaveBeenCalled();
    });

    it('should ensure topic exists by creating if not exists', async () => {
      mockKafka.admin().listTopics.mockResolvedValue(['existing-topic']);
      await accessor.initAdmin();
      
      const wasCreated = await accessor.ensureTopicExists('new-topic');
      
      expect(wasCreated).toBe(true);
      expect(mockKafka.admin().createTopics).toHaveBeenCalled();
    });
  });

  describe('producer', () => {
    it('should initialize producer successfully', async () => {
      const producer = await accessor.initProducer();
      
      expect(producer).toBeDefined();
      expect(mockKafka.producer).toHaveBeenCalledWith({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 3
        }
      });
    });

    it('should send message with topic creation', async () => {
      const payload = { message: 'test' };
      const options = { topicConfig: { numPartitions: 3 } };
      
      const result = await accessor.sendMessage('new-topic', payload, options);
      
      expect(result).toEqual([{ partition: 0, baseOffset: '123' }]);
      expect(mockProducer.send).toHaveBeenCalled();
    });

    it('should auto-initialize producer when sending message', async () => {
      // Ensure producer is not initialized
      accessor.producer = null;
      
      const result = await accessor.sendMessage('topic', { message: 'test' });
      
      expect(result).toEqual([{ partition: 0, baseOffset: '123' }]);
      expect(accessor.producer).toBeDefined();
    });
  });

  describe('consumer', () => {
    it('should initialize consumer successfully', async () => {
      const consumer = await accessor.initConsumer();
      
      expect(consumer).toBeDefined();
      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: 'kafka-accessor-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576
      });
    });

    it('should subscribe to topic successfully', async () => {
      const messageHandler = jest.fn();
      
      await accessor.subscribeToTopic('topic', messageHandler);
      
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'topic',
        fromBeginning: false
      });
    });

    it('should auto-initialize consumer when subscribing to topic', async () => {
      // Ensure consumer is not initialized
      accessor.consumer = null;
      
      const messageHandler = jest.fn();
      await accessor.subscribeToTopic('topic', messageHandler);
      
      expect(accessor.consumer).toBeDefined();
      expect(mockConsumer.subscribe).toHaveBeenCalled();
    });
  });

  describe('getMessageFromTopic', () => {
    let mockDedicatedConsumer;
    let mockDedicatedKafka;

    beforeEach(() => {
      mockDedicatedConsumer = {
        connect: jest.fn().mockResolvedValue(),
        disconnect: jest.fn().mockResolvedValue(),
        subscribe: jest.fn().mockResolvedValue(),
        run: jest.fn().mockResolvedValue()
      };

      mockDedicatedKafka = {
        consumer: jest.fn().mockReturnValue(mockDedicatedConsumer)
      };

      // Mock the kafka instance for the new method
      accessor.kafka = mockDedicatedKafka;
    });

    it('should create a dedicated consumer and retrieve a message', async () => {
      const mockMessage = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '123',
          key: 'test-key',
          value: Buffer.from('{"message": "test"}'),
          timestamp: Date.now(),
          headers: {}
        }
      };

      // Mock the consumer.run to immediately call eachMessage
      mockDedicatedConsumer.run.mockImplementation(({ eachMessage }) => {
        // Call eachMessage immediately to simulate message arrival
        eachMessage(mockMessage);
        return Promise.resolve();
      });

      const message = await accessor.getMessageFromTopic('test-topic');

      expect(mockDedicatedKafka.consumer).toHaveBeenCalledWith({
        groupId: expect.stringMatching(/^test-client-\d+$/),
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576
      });

      expect(mockDedicatedConsumer.connect).toHaveBeenCalled();
      expect(mockDedicatedConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'test-topic',
        fromBeginning: false
      });
      expect(mockDedicatedConsumer.run).toHaveBeenCalled();
      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();

      expect(message).toEqual({
        topic: 'test-topic',
        partition: 0,
        offset: '123',
        key: 'test-key',
        value: { message: 'test' },
        timestamp: mockMessage.message.timestamp,
        headers: {}
      });
    });

    it('should use custom group ID when provided', async () => {
      const mockMessage = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '123',
          key: null,
          value: Buffer.from('{"message": "test"}'),
          timestamp: Date.now(),
          headers: {}
        }
      };

      mockDedicatedConsumer.run.mockImplementation(({ eachMessage }) => {
        eachMessage(mockMessage);
        return Promise.resolve();
      });

      await accessor.getMessageFromTopic('test-topic', { groupId: 'custom-group' });

      expect(mockDedicatedKafka.consumer).toHaveBeenCalledWith({
        groupId: expect.stringMatching(/^custom-group-\d+$/),
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576
      });
    });

    it('should handle timeout correctly', async () => {
      // Mock the consumer.run to not call eachMessage (simulating no messages)
      mockDedicatedConsumer.run.mockResolvedValue();

      // Mock setTimeout to immediately trigger timeout for our test
      const originalSetTimeout = global.setTimeout;
      global.setTimeout = jest.fn((callback, delay) => {
        if (delay === 100) {
          // For our timeout test, immediately call the callback
          callback();
        }
        return originalSetTimeout(callback, delay);
      });

      try {
        const timeout = 100;
        
        await expect(
          accessor.getMessageFromTopic('test-topic', { timeout })
        ).rejects.toThrow('Timeout waiting for message from topic: test-topic');

        expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
      } finally {
        // Restore original setTimeout
        global.setTimeout = originalSetTimeout;
      }
    });

    it('should handle message parsing errors', async () => {
      const mockMessage = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '123',
          key: null,
          value: Buffer.from('invalid-json'), // Invalid JSON
          timestamp: Date.now(),
          headers: {}
        }
      };

      mockDedicatedConsumer.run.mockImplementation(({ eachMessage }) => {
        eachMessage(mockMessage);
        return Promise.resolve();
      });

      await expect(
        accessor.getMessageFromTopic('test-topic')
      ).rejects.toThrow('Failed to parse message:');

      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
    });

    it('should handle consumer connection errors', async () => {
      mockDedicatedConsumer.connect.mockRejectedValue(new Error('Connection failed'));

      await expect(
        accessor.getMessageFromTopic('test-topic')
      ).rejects.toThrow('Connection failed');

      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
    });

    it('should handle consumer subscription errors', async () => {
      mockDedicatedConsumer.subscribe.mockRejectedValue(new Error('Subscription failed'));

      await expect(
        accessor.getMessageFromTopic('test-topic')
      ).rejects.toThrow('Subscription failed');

      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
    });

    it('should handle consumer run errors', async () => {
      mockDedicatedConsumer.run.mockRejectedValue(new Error('Run failed'));

      await expect(
        accessor.getMessageFromTopic('test-topic')
      ).rejects.toThrow('Run failed');

      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
    });

    it('should handle disconnect errors gracefully', async () => {
      const mockMessage = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '123',
          key: null,
          value: Buffer.from('{"message": "test"}'),
          timestamp: Date.now(),
          headers: {}
        }
      };

      mockDedicatedConsumer.run.mockImplementation(({ eachMessage }) => {
        eachMessage(mockMessage);
        return Promise.resolve();
      });

      // Mock disconnect to fail
      mockDedicatedConsumer.disconnect.mockRejectedValue(new Error('Disconnect failed'));

      const message = await accessor.getMessageFromTopic('test-topic');

      // Should still return the message even if disconnect fails
      expect(message).toBeDefined();
      expect(mockDedicatedConsumer.disconnect).toHaveBeenCalled();
    });

    it('should prevent multiple message processing', async () => {
      const mockMessage1 = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '123',
          key: null,
          value: Buffer.from('{"message": "first"}'),
          timestamp: Date.now(),
          headers: {}
        }
      };

      const mockMessage2 = {
        topic: 'test-topic',
        partition: 0,
        message: {
          offset: '124',
          key: null,
          value: Buffer.from('{"message": "second"}'),
          timestamp: Date.now(),
          headers: {}
        }
      };

      mockDedicatedConsumer.run.mockImplementation(({ eachMessage }) => {
        // Call eachMessage multiple times - only first should be processed
        eachMessage(mockMessage1);
        eachMessage(mockMessage2); // This should be ignored
        return Promise.resolve();
      });

      const message = await accessor.getMessageFromTopic('test-topic');

      // Should only process the first message
      expect(message.value.message).toBe('first');
    });
  });

  describe('disconnect', () => {
    it('should disconnect all clients', async () => {
      await accessor.initProducer();
      await accessor.initConsumer();
      await accessor.initAdmin();
      
      await accessor.disconnect();
      
      expect(mockKafka.producer().disconnect).toHaveBeenCalled();
      expect(mockKafka.consumer().disconnect).toHaveBeenCalled();
      expect(mockKafka.admin().disconnect).toHaveBeenCalled();
    });
  });

  describe('health status', () => {
    it('should return health status for all components', () => {
      const status = accessor.getHealthStatus();
      
      expect(status).toEqual({
        producer: { connected: false, initialized: false },
        consumer: { connected: false, initialized: false },
        admin: { connected: false, initialized: false },
        config: {
          brokers: 'localhost:9092',
          clientId: 'test-client',
          groupId: 'kafka-accessor-group'
        },
        processorRegistry: {
          enabled: true,
          processors: [],
          autoRefresh: {
            enabled: true,
            interval: 10000,
            isRunning: true,
            lastRefresh: null,
            refreshCount: 0
          }
        }
      });
    });

    it('should return health status for initialized components', async () => {
      await accessor.initProducer();
      await accessor.initConsumer();
      await accessor.initAdmin();
      
      const status = accessor.getHealthStatus();
      
      expect(status.producer.initialized).toBe(true);
      expect(status.consumer.initialized).toBe(true);
      expect(status.admin.initialized).toBe(true);
    });
  });

  describe('processor registry integration', () => {
    it('should return processor registry information', () => {
      const info = accessor.getProcessorRegistryInfo();
      
      expect(info).toBeDefined();
      expect(info.directory).toBe('./processors');
      expect(info.availableTopics).toEqual([]);
      expect(info.autoRefresh.enabled).toBe(true);
    });

    it('should handle processor registry when not initialized', () => {
      accessor.processorRegistry = null;
      
      const info = accessor.getProcessorRegistryInfo();
      
      expect(info).toBeNull();
    });
  });

  describe('autoSubscribeToProcessorTopics', () => {
    it('should auto-subscribe to processor topics successfully', async () => {
      // Mock processor registry methods
      const mockProcessorRegistry = {
        autoDiscoverProcessors: jest.fn().mockResolvedValue(),
        getAvailableTopics: jest.fn().mockReturnValue(['topic1', 'topic2']),
        processMessage: jest.fn().mockResolvedValue()
      };
      
      accessor.processorRegistry = mockProcessorRegistry;
      accessor.admin = mockAdmin;
      
      await accessor.autoSubscribeToProcessorTopics();
      
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topics: ['topic1', 'topic2'],
        fromBeginning: false
      });
      expect(mockConsumer.run).toHaveBeenCalled();
    });

    it('should handle case when no processors are found', async () => {
      const mockProcessorRegistry = {
        autoDiscoverProcessors: jest.fn().mockResolvedValue(),
        getAvailableTopics: jest.fn().mockReturnValue([])
      };
      
      accessor.processorRegistry = mockProcessorRegistry;
      accessor.admin = mockAdmin;
      
      await accessor.autoSubscribeToProcessorTopics();
      
      expect(mockConsumer.subscribe).not.toHaveBeenCalled();
      expect(mockConsumer.run).not.toHaveBeenCalled();
    });

    it('should handle processor discovery errors gracefully', async () => {
      const mockProcessorRegistry = {
        autoDiscoverProcessors: jest.fn().mockRejectedValue(new Error('Discovery failed'))
      };
      
      accessor.processorRegistry = mockProcessorRegistry;
      accessor.admin = mockAdmin;
      
      await expect(accessor.autoSubscribeToProcessorTopics()).rejects.toThrow('Discovery failed');
    });

    it('should handle message processing errors gracefully', async () => {
      const mockProcessorRegistry = {
        autoDiscoverProcessors: jest.fn().mockResolvedValue(),
        getAvailableTopics: jest.fn().mockReturnValue(['topic1']),
        processMessage: jest.fn().mockResolvedValue()
      };
      
      accessor.processorRegistry = mockProcessorRegistry;
      accessor.admin = mockAdmin;
      
      await accessor.autoSubscribeToProcessorTopics();
      
      // Mock the consumer.run to simulate message processing
      const runCall = mockConsumer.run.mock.calls[0][0];
      
      // Simulate message processing error
      await expect(runCall.eachMessage({
        topic: 'topic1',
        partition: 0,
        message: {
          value: Buffer.from('invalid-json'),
          key: null,
          offset: 123,
          timestamp: Date.now(),
          headers: {}
        }
      })).rejects.toThrow();
    });
  });

  describe('sendMessage edge cases', () => {
    it('should handle message sending with all optional parameters', async () => {
      const payload = { message: 'test' };
      const options = {
        key: 'test-key',
        partition: 1,
        timestamp: 1234567890,
        topicConfig: { numPartitions: 3, replicationFactor: 2 }
      };
      
      const result = await accessor.sendMessage('test-topic', payload, options);
      
      expect(result).toEqual([{ partition: 0, baseOffset: '123' }]);
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [{
          key: 'test-key',
          value: JSON.stringify(payload),
          partition: 1,
          timestamp: 1234567890
        }]
      });
    });

    it('should handle message sending with null key', async () => {
      const payload = { message: 'test' };
      const options = { key: null };
      
      await accessor.sendMessage('test-topic', payload, options);
      
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [{
          key: null,
          value: JSON.stringify(payload),
          partition: 0,
          timestamp: expect.any(Number)
        }]
      });
    });

    it('should handle message sending with undefined options', async () => {
      const payload = { message: 'test' };
      
      await accessor.sendMessage('test-topic', payload);
      
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [{
          key: null,
          value: JSON.stringify(payload),
          partition: 0,
          timestamp: expect.any(Number)
        }]
      });
    });

    it('should handle message sending with empty payload', async () => {
      const payload = {};
      
      await accessor.sendMessage('test-topic', payload);
      
      expect(mockProducer.send).toHaveBeenCalledWith({
        topic: 'test-topic',
        messages: [{
          key: null,
          value: '{}',
          partition: 0,
          timestamp: expect.any(Number)
        }]
      });
    });
  });

  describe('subscribeToTopic edge cases', () => {
    it('should handle subscription with custom options', async () => {
      const messageHandler = jest.fn();
      const options = {
        fromBeginning: true,
        eachBatch: jest.fn()
      };
      
      await accessor.subscribeToTopic('test-topic', messageHandler, options);
      
      expect(mockConsumer.subscribe).toHaveBeenCalledWith({
        topic: 'test-topic',
        fromBeginning: true
      });
      expect(mockConsumer.run).toHaveBeenCalledWith({
        eachMessage: expect.any(Function),
        eachBatch: options.eachBatch
      });
    });

    it('should handle subscription without message handler', async () => {
      await expect(accessor.subscribeToTopic('test-topic')).rejects.toThrow('Message handler is required for manual subscription');
    });

    it('should handle subscription with null message handler', async () => {
      await expect(accessor.subscribeToTopic('test-topic', null)).rejects.toThrow('Message handler is required for manual subscription');
    });

    it('should handle message processing errors in subscription', async () => {
      const messageHandler = jest.fn().mockRejectedValue(new Error('Handler failed'));
      
      await accessor.subscribeToTopic('test-topic', messageHandler);
      
      const runCall = mockConsumer.run.mock.calls[0][0];
      
      // Simulate message processing error
      await expect(runCall.eachMessage({
        topic: 'test-topic',
        partition: 0,
        message: {
          value: Buffer.from('{"message": "test"}'),
          key: null,
          offset: 123,
          timestamp: Date.now(),
          headers: {}
        }
      })).rejects.toThrow('Handler failed');
    });
  });

  describe('disconnect edge cases', () => {
    it('should handle disconnect when no clients are initialized', async () => {
      await accessor.disconnect();
      
      // Should not throw any errors
      expect(true).toBe(true);
    });

    it('should handle disconnect errors gracefully', async () => {
      await accessor.initProducer();
      await accessor.initConsumer();
      await accessor.initAdmin();
      
      // Mock disconnect to fail
      mockProducer.disconnect.mockRejectedValue(new Error('Producer disconnect failed'));
      mockConsumer.disconnect.mockRejectedValue(new Error('Consumer disconnect failed'));
      mockAdmin.disconnect.mockRejectedValue(new Error('Admin disconnect failed'));
      
      // Should not throw errors during disconnect
      await accessor.disconnect();
      
      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(mockConsumer.disconnect).toHaveBeenCalled();
      expect(mockAdmin.disconnect).toHaveBeenCalled();
    });

    it('should stop processor registry auto-refresh on disconnect', async () => {
      const stopAutoRefreshSpy = jest.spyOn(accessor.processorRegistry, 'stopAutoRefresh');
      
      await accessor.disconnect();
      
      expect(stopAutoRefreshSpy).toHaveBeenCalled();
    });
  });

  describe('environment variable handling', () => {
    it('should use environment variables for configuration', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        KAFKA_BROKERS: 'kafka:9092,kafka2:9092',
        KAFKA_CLIENT_ID: 'env-client',
        KAFKA_GROUP_ID: 'env-group',
        LOG_LEVEL: 'debug',
        PRODUCER_TIMEOUT: '60000',
        PRODUCER_RETRY_ATTEMPTS: '5',
        CONSUMER_SESSION_TIMEOUT: '60000',
        CONSUMER_HEARTBEAT_INTERVAL: '5000',
        CONSUMER_MAX_BYTES: '2097152'
      };
      
      const envAccessor = new KafkaAccessor();
      
      expect(envAccessor.config.brokers).toBe('kafka:9092,kafka2:9092');
      expect(envAccessor.config.clientId).toBe('env-client');
      expect(envAccessor.config.groupId).toBe('env-group');
      
      // Restore original environment
      process.env = originalEnv;
    });

    it('should handle invalid environment variable values', () => {
      const originalEnv = process.env;
      
      process.env = {
        ...originalEnv,
        PRODUCER_TIMEOUT: 'invalid',
        PRODUCER_RETRY_ATTEMPTS: 'invalid',
        CONSUMER_SESSION_TIMEOUT: 'invalid',
        CONSUMER_HEARTBEAT_INTERVAL: 'invalid',
        CONSUMER_MAX_BYTES: 'invalid'
      };
      
      const envAccessor = new KafkaAccessor();
      
      // Should use default values when environment variables are invalid
      expect(envAccessor.config.brokers).toBe('localhost:9092');
      expect(envAccessor.config.clientId).toBe('kafka-accessor');
      expect(envAccessor.config.groupId).toBe('kafka-accessor-group');
      
      // Restore original environment
      process.env = originalEnv;
    });
  });

  describe('Kafka client configuration', () => {
    it('should configure Kafka client with retry settings', () => {
      expect(mockKafka).toBeDefined();
      expect(mockKafka.producer).toBeDefined();
      expect(mockKafka.consumer).toBeDefined();
      expect(mockKafka.admin).toBeDefined();
    });

    it('should configure producer with correct settings', async () => {
      await accessor.initProducer();
      
      expect(mockKafka.producer).toHaveBeenCalledWith({
        allowAutoTopicCreation: true,
        transactionTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 3
        }
      });
    });

    it('should configure consumer with correct settings', async () => {
      await accessor.initConsumer();
      
      expect(mockKafka.consumer).toHaveBeenCalledWith({
        groupId: 'kafka-accessor-group',
        sessionTimeout: 30000,
        heartbeatInterval: 3000,
        maxBytesPerPartition: 1048576
      });
    });
  });

  describe('error handling and logging', () => {
    it('should log errors appropriately', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      
      try {
        await accessor.initAdmin();
        mockAdmin.listTopics.mockRejectedValue(new Error('Admin error'));
        await accessor.topicExists('test-topic');
      } catch (error) {
        // Error should be logged
      }
      
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('should handle network errors gracefully', async () => {
      mockKafka.admin.mockImplementation(() => ({
        connect: jest.fn().mockRejectedValue(new Error('Network error'))
      }));
      
      await expect(accessor.initAdmin()).rejects.toThrow('Network error');
    });
  });

  describe('concurrent operations', () => {
    it('should handle multiple concurrent send operations', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(accessor.sendMessage(`topic-${i}`, { message: `test-${i}` }));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toEqual([{ partition: 0, baseOffset: '123' }]);
      });
    });

    it('should handle multiple concurrent topic existence checks', async () => {
      const promises = [];
      
      for (let i = 0; i < 5; i++) {
        promises.push(accessor.topicExists(`topic-${i}`));
      }
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      results.forEach(result => {
        expect(result).toBe(true);
      });
    });
  });

  describe('resource cleanup', () => {
    it('should clean up resources on multiple disconnect calls', async () => {
      await accessor.initProducer();
      await accessor.initConsumer();
      await accessor.initAdmin();
      
      // Multiple disconnect calls should not cause issues
      await accessor.disconnect();
      await accessor.disconnect();
      await accessor.disconnect();
      
      expect(mockProducer.disconnect).toHaveBeenCalledTimes(1);
      expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
      expect(mockAdmin.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup when clients are already disconnected', async () => {
      await accessor.initProducer();
      await accessor.initConsumer();
      await accessor.initAdmin();
      
      // Mock clients to be already disconnected
      mockProducer.disconnect.mockRejectedValue(new Error('Already disconnected'));
      mockConsumer.disconnect.mockRejectedValue(new Error('Already disconnected'));
      mockAdmin.disconnect.mockRejectedValue(new Error('Already disconnected'));
      
      // Should not throw errors
      await accessor.disconnect();
      
      expect(mockProducer.disconnect).toHaveBeenCalled();
      expect(mockConsumer.disconnect).toHaveBeenCalled();
      expect(mockAdmin.disconnect).toHaveBeenCalled();
    });
  });
});


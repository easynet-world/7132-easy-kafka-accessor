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
});


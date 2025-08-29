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


const KafkaConsumer = require('../src/consumer');

// Mock the KafkaAccessor
jest.mock('../src/kafka-accessor');

describe('KafkaConsumer', () => {
  let consumer;
  let mockAccessor;
  let KafkaAccessorMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the KafkaAccessor instance
    mockAccessor = {
      initConsumer: jest.fn().mockResolvedValue(),
      subscribeToTopic: jest.fn().mockResolvedValue(),
      disconnect: jest.fn().mockResolvedValue(),
      getHealthStatus: jest.fn().mockReturnValue({
        producer: { connected: false },
        consumer: { connected: true },
        config: { brokers: 'localhost:9092', clientId: 'test-consumer', groupId: 'test-group' }
      })
    };

    // Mock the constructor to return our mock
    KafkaAccessorMock = require('../src/kafka-accessor');
    KafkaAccessorMock.mockImplementation(() => mockAccessor);
    
    consumer = new KafkaConsumer({
      brokers: 'localhost:9092',
      clientId: 'test-consumer',
      groupId: 'test-group'
    });
  });

  afterEach(() => {
    // Clean up event listeners to prevent memory leaks
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGUSR2');
  });

  describe('constructor', () => {
    it('should create consumer with unique client ID and group ID', () => {
      expect(KafkaAccessorMock).toHaveBeenCalledWith({
        brokers: 'localhost:9092',
        clientId: 'test-consumer',
        groupId: 'test-group'
      });
    });

    it('should setup graceful shutdown handlers', () => {
      const sigtermSpy = jest.spyOn(process, 'on');
      
      // Recreate consumer to trigger setup
      new KafkaConsumer();
      
      expect(sigtermSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(sigtermSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(sigtermSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function));
    });
  });

  describe('init', () => {
    it('should initialize consumer successfully', async () => {
      await consumer.init();
      
      expect(mockAccessor.initConsumer).toHaveBeenCalled();
      expect(consumer.isRunning).toBe(true);
    });

    it('should handle initialization error', async () => {
      const error = new Error('Init failed');
      mockAccessor.initConsumer.mockRejectedValue(error);
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await consumer.init();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize consumer:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('subscribeToTopic', () => {
    beforeEach(async () => {
      await consumer.init();
    });

    it('should subscribe to topic successfully', async () => {
      const topic = 'test-topic';
      const messageHandler = jest.fn();
      const options = { fromBeginning: true };
      
      await consumer.subscribeToTopic(topic, messageHandler, options);
      
      expect(mockAccessor.subscribeToTopic).toHaveBeenCalledWith(topic, messageHandler, options);
      expect(consumer.subscribedTopics.has(topic)).toBe(true);
    });

    it('should warn if already subscribed to topic', async () => {
      const topic = 'test-topic';
      const messageHandler = jest.fn();
      
      // First subscription
      await consumer.subscribeToTopic(topic, messageHandler);
      
      // Second subscription to same topic
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      await consumer.subscribeToTopic(topic, messageHandler);
      
      expect(consoleSpy).toHaveBeenCalledWith(`Already subscribed to topic: ${topic}`);
      
      consoleSpy.mockRestore();
    });

    it('should throw error if not running', async () => {
      consumer.isRunning = false;
      
      await expect(consumer.subscribeToTopic('topic', jest.fn())).rejects.toThrow('Consumer not initialized');
    });

    it('should handle subscription error', async () => {
      const error = new Error('Subscription failed');
      mockAccessor.subscribeToTopic.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await expect(consumer.subscribeToTopic('topic', jest.fn())).rejects.toThrow('Subscription failed');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to subscribe to topic topic:', error);
      
      consoleSpy.mockRestore();
    });
  });

  describe('subscribeToTopics', () => {
    beforeEach(async () => {
      await consumer.init();
    });

    it('should subscribe to multiple topics successfully', async () => {
      const subscriptions = [
        { topic: 'topic1', messageHandler: jest.fn() },
        { topic: 'topic2', messageHandler: jest.fn(), options: { fromBeginning: true } }
      ];
      
      const results = await consumer.subscribeToTopics(subscriptions);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockAccessor.subscribeToTopic).toHaveBeenCalledTimes(2);
    });

    it('should handle partial subscription failures', async () => {
      const subscriptions = [
        { topic: 'topic1', messageHandler: jest.fn() },
        { topic: 'topic2', messageHandler: jest.fn() }
      ];
      
      // First subscription succeeds, second fails
      mockAccessor.subscribeToTopic
        .mockResolvedValueOnce()
        .mockRejectedValueOnce(new Error('Subscription failed'));
      
      const results = await consumer.subscribeToTopics(subscriptions);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Subscription failed');
    });
  });

  describe('unsubscribeFromTopic', () => {
    beforeEach(async () => {
      await consumer.init();
      await consumer.subscribeToTopic('test-topic', jest.fn());
    });

    it('should unsubscribe from topic', async () => {
      const topic = 'test-topic';
      
      await consumer.unsubscribeFromTopic(topic);
      
      expect(consumer.subscribedTopics.has(topic)).toBe(false);
    });

    it('should warn if not subscribed to topic', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      
      await consumer.unsubscribeFromTopic('non-existent-topic');
      
      expect(consoleSpy).toHaveBeenCalledWith('Not subscribed to topic: non-existent-topic');
      
      consoleSpy.mockRestore();
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status with subscribed topics', async () => {
      await consumer.init();
      await consumer.subscribeToTopic('topic1', jest.fn());
      await consumer.subscribeToTopic('topic2', jest.fn());
      
      const status = consumer.getHealthStatus();
      
      expect(status.subscribedTopics).toContain('topic1');
      expect(status.subscribedTopics).toContain('topic2');
      expect(status.isRunning).toBe(true);
    });
  });

  describe('graceful shutdown', () => {
    it('should handle SIGTERM gracefully', async () => {
      await consumer.init();
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Simulate SIGTERM
      const sigtermHandler = process.listeners('SIGTERM')[0];
      await sigtermHandler();
      
      expect(consumer.isRunning).toBe(false);
      expect(mockAccessor.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Consumer shutdown completed');
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle shutdown errors', async () => {
      await consumer.init();
      
      const error = new Error('Disconnect failed');
      mockAccessor.disconnect.mockRejectedValue(error);
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      // Simulate SIGTERM
      const sigtermHandler = process.listeners('SIGTERM')[0];
      await sigtermHandler();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error during shutdown:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('start', () => {
    it('should start consumer service with health checks', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await consumer.start();
      
      expect(mockAccessor.initConsumer).toHaveBeenCalled();
      expect(consumer.isRunning).toBe(true);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should handle start errors', async () => {
      const error = new Error('Start failed');
      mockAccessor.initConsumer.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // The start method will call process.exit(1) when there's an error
      await consumer.start();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize consumer:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});

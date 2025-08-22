const KafkaProducer = require('../src/producer');

// Mock the KafkaAccessor
jest.mock('../src/kafka-accessor');

describe('KafkaProducer', () => {
  let producer;
  let mockAccessor;
  let KafkaAccessorMock;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock the KafkaAccessor instance
    mockAccessor = {
      initProducer: jest.fn().mockResolvedValue(),
      sendMessage: jest.fn().mockResolvedValue({ partition: 0, offset: '123' }),
      createTopic: jest.fn().mockResolvedValue(),
      ensureTopicExists: jest.fn().mockResolvedValue(false),
      disconnect: jest.fn().mockResolvedValue(),
      getHealthStatus: jest.fn().mockReturnValue({
        producer: { connected: true },
        consumer: { connected: false },
        admin: { connected: true },
        config: { brokers: 'localhost:9092', clientId: 'test-producer' }
      })
    };

    // Mock the constructor to return our mock
    KafkaAccessorMock = require('../src/kafka-accessor');
    KafkaAccessorMock.mockImplementation(() => mockAccessor);
    
    producer = new KafkaProducer({
      brokers: 'localhost:9092',
      clientId: 'test-producer'
    });
  });

  afterEach(() => {
    // Clean up event listeners to prevent memory leaks
    process.removeAllListeners('SIGTERM');
    process.removeAllListeners('SIGINT');
    process.removeAllListeners('SIGUSR2');
  });

  describe('constructor', () => {
    it('should create producer with unique client ID', () => {
      expect(KafkaAccessorMock).toHaveBeenCalledWith({
        brokers: 'localhost:9092',
        clientId: 'test-producer'
      });
    });

    it('should setup graceful shutdown handlers', () => {
      const sigtermSpy = jest.spyOn(process, 'on');
      
      // Recreate producer to trigger setup
      new KafkaProducer();
      
      expect(sigtermSpy).toHaveBeenCalledWith('SIGTERM', expect.any(Function));
      expect(sigtermSpy).toHaveBeenCalledWith('SIGINT', expect.any(Function));
      expect(sigtermSpy).toHaveBeenCalledWith('SIGUSR2', expect.any(Function));
    });
  });

  describe('init', () => {
    it('should initialize producer successfully', async () => {
      await producer.init();
      
      expect(mockAccessor.initProducer).toHaveBeenCalled();
      expect(producer.isRunning).toBe(true);
    });

    it('should handle initialization error', async () => {
      const error = new Error('Init failed');
      mockAccessor.initProducer.mockRejectedValue(error);
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      await producer.init();
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize producer:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('sendMessage', () => {
    beforeEach(async () => {
      await producer.init();
    });

    it('should send message successfully', async () => {
      const topic = 'test-topic';
      const payload = { message: 'Hello World' };
      const options = { key: 'test-key' };
      
      const result = await producer.sendMessage(topic, payload, options);
      
      expect(mockAccessor.sendMessage).toHaveBeenCalledWith(topic, payload, options);
      expect(result).toEqual({ partition: 0, offset: '123' });
    });

    it('should throw error if not running', async () => {
      producer.isRunning = false;
      
      await expect(producer.sendMessage('topic', {})).rejects.toThrow('Producer not initialized');
    });
  });

  describe('createTopic', () => {
    beforeEach(async () => {
      await producer.init();
    });

    it('should create topic successfully', async () => {
      const topic = 'new-topic';
      const options = { numPartitions: 3, replicationFactor: 2 };
      
      await producer.createTopic(topic, options);
      
      expect(mockAccessor.createTopic).toHaveBeenCalledWith(topic, options);
    });

    it('should throw error if not running', async () => {
      producer.isRunning = false;
      
      await expect(producer.createTopic('topic')).rejects.toThrow('Producer not initialized');
    });
  });

  describe('ensureTopicExists', () => {
    beforeEach(async () => {
      await producer.init();
    });

    it('should return false if topic already exists', async () => {
      mockAccessor.ensureTopicExists.mockResolvedValue(false);
      
      const result = await producer.ensureTopicExists('existing-topic');
      
      expect(result).toBe(false);
      expect(mockAccessor.ensureTopicExists).toHaveBeenCalledWith('existing-topic', {});
    });

    it('should return true if topic was created', async () => {
      mockAccessor.ensureTopicExists.mockResolvedValue(true);
      
      const result = await producer.ensureTopicExists('new-topic', { numPartitions: 2 });
      
      expect(result).toBe(true);
      expect(mockAccessor.ensureTopicExists).toHaveBeenCalledWith('new-topic', { numPartitions: 2 });
    });

    it('should throw error if not running', async () => {
      producer.isRunning = false;
      
      await expect(producer.ensureTopicExists('topic')).rejects.toThrow('Producer not initialized');
    });
  });

  describe('sendBatch', () => {
    beforeEach(async () => {
      await producer.init();
    });

    it('should send batch messages successfully', async () => {
      const topic = 'test-topic';
      const messages = [
        { id: 1, message: 'Hello' },
        { id: 2, message: 'World' }
      ];
      const options = { key: 'batch-key' };
      
      const results = await producer.sendBatch(topic, messages, options);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(mockAccessor.sendMessage).toHaveBeenCalledTimes(2);
    });

    it('should handle partial batch failures', async () => {
      const topic = 'test-topic';
      const messages = [
        { id: 1, message: 'Hello' },
        { id: 2, message: 'World' }
      ];
      
      // First message succeeds, second fails
      mockAccessor.sendMessage
        .mockResolvedValueOnce({ partition: 0, offset: '123' })
        .mockRejectedValueOnce(new Error('Send failed'));
      
      const results = await producer.sendBatch(topic, messages);
      
      expect(results).toHaveLength(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[1].error).toBe('Send failed');
    });

    it('should throw error if not running', async () => {
      producer.isRunning = false;
      
      await expect(producer.sendBatch('topic', [])).rejects.toThrow('Producer not initialized');
    });
  });

  describe('getHealthStatus', () => {
    it('should return health status', () => {
      const status = producer.getHealthStatus();
      
      expect(status).toEqual({
        producer: { connected: true },
        consumer: { connected: false },
        admin: { connected: true },
        config: { brokers: 'localhost:9092', clientId: 'test-producer' }
      });
    });
  });

  describe('graceful shutdown', () => {
    it('should handle SIGTERM gracefully', async () => {
      await producer.init();
      
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
      
      // Simulate SIGTERM
      const sigtermHandler = process.listeners('SIGTERM')[0];
      await sigtermHandler();
      
      expect(producer.isRunning).toBe(false);
      expect(mockAccessor.disconnect).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith('Producer shutdown completed');
      expect(exitSpy).toHaveBeenCalledWith(0);
      
      exitSpy.mockRestore();
      consoleSpy.mockRestore();
    });

    it('should handle shutdown errors', async () => {
      await producer.init();
      
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
    it('should start producer service with health checks', async () => {
      const setIntervalSpy = jest.spyOn(global, 'setInterval');
      
      await producer.start();
      
      expect(mockAccessor.initProducer).toHaveBeenCalled();
      expect(producer.isRunning).toBe(true);
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
    });

    it('should handle start errors', async () => {
      const error = new Error('Start failed');
      mockAccessor.initProducer.mockRejectedValue(error);
      
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
      
      // The start method will call process.exit(1) when there's an error
      await producer.start();
      expect(consoleSpy).toHaveBeenCalledWith('Failed to initialize producer:', error);
      expect(exitSpy).toHaveBeenCalledWith(1);
      
      consoleSpy.mockRestore();
      exitSpy.mockRestore();
    });
  });
});

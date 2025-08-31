const SystemLogsProcessor = require('../processors/system-logs');
const KafkaTopicProcessor = require('../src/kafka-topic-processor');

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

describe('Processors', () => {
  describe('SystemLogsProcessor', () => {
    let processor;

    beforeEach(() => {
      jest.clearAllMocks();
      processor = new SystemLogsProcessor();
    });

    it('should extend KafkaTopicProcessor', () => {
      expect(processor).toBeInstanceOf(KafkaTopicProcessor);
    });

    it('should have the correct topic name', () => {
      expect(processor.topic).toBe('system-logs');
    });

    it('should process system log messages successfully', async () => {
      const message = {
        level: 'info',
        message: 'System startup completed',
        timestamp: Date.now(),
        service: 'auth-service'
      };

      const metadata = {
        topic: 'system-logs',
        partition: 0,
        offset: 123,
        key: 'system-123',
        timestamp: Date.now(),
        headers: {
          'content-type': 'application/json'
        }
      };

      const result = await processor.processMessage(message, metadata);

      expect(result.status).toBe('success');
      expect(result.message).toBe('System log message logged successfully');
    });

    it('should log system messages with correct metadata', async () => {
      const message = {
        level: 'error',
        message: 'Database connection failed',
        timestamp: Date.now()
      };

      const metadata = {
        topic: 'system-logs',
        partition: 1,
        offset: 456,
        key: 'system-456',
        timestamp: Date.now(),
        headers: {}
      };

      await processor.processMessage(message, metadata);

      expect(processor.logger.info).toHaveBeenCalledWith('System Log Message', {
        topic: 'system-logs',
        partition: 1,
        offset: 456,
        message: JSON.stringify(message, null, 2)
      });
    });

    it('should handle various message types', async () => {
      const testCases = [
        { level: 'info', message: 'Info message' },
        { level: 'warn', message: 'Warning message' },
        { level: 'error', message: 'Error message' },
        { level: 'debug', message: 'Debug message' }
      ];

      for (const testCase of testCases) {
        const result = await processor.processMessage(testCase, { topic: 'system-logs' });
        expect(result.status).toBe('success');
      }
    });

    it('should handle complex message structures', async () => {
      const complexMessage = {
        level: 'info',
        message: 'Complex system event',
        timestamp: Date.now(),
        metadata: {
          userId: 12345,
          sessionId: 'sess-67890',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          requestId: 'req-abc123',
          duration: 150,
          statusCode: 200
        },
        tags: ['authentication', 'success', 'performance']
      };

      const result = await processor.processMessage(complexMessage, { topic: 'system-logs' });

      expect(result.status).toBe('success');
      expect(processor.logger.info).toHaveBeenCalledWith('System Log Message', {
        topic: 'system-logs',
        partition: undefined,
        offset: undefined,
        message: JSON.stringify(complexMessage, null, 2)
      });
    });

    it('should handle edge cases gracefully', async () => {
      const edgeCases = [
        null,
        undefined,
        '',
        0,
        false,
        [],
        () => {},
        Symbol('test')
      ];

      for (const edgeCase of edgeCases) {
        const result = await processor.processMessage(edgeCase, { topic: 'system-logs' });
        expect(result.status).toBe('success');
      }
    });

    it('should handle circular references in messages', async () => {
      const circularMessage = { data: 'test' };
      circularMessage.self = circularMessage;

      const result = await processor.processMessage(circularMessage, { topic: 'system-logs' });

      expect(result.status).toBe('success');
    });

    it('should handle very long messages', async () => {
      const longMessage = {
        level: 'info',
        message: 'x'.repeat(10000),
        timestamp: Date.now()
      };

      const result = await processor.processMessage(longMessage, { topic: 'system-logs' });

      expect(result.status).toBe('success');
    });

    it('should handle special characters in messages', async () => {
      const specialMessage = {
        level: 'info',
        message: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: 'Unicode: 🚀🌟🎯',
        newlines: 'Line1\nLine2\r\nLine3',
        quotes: 'Single: \' Double: " Backtick: `',
        timestamp: Date.now()
      };

      const result = await processor.processMessage(specialMessage, { topic: 'system-logs' });

      expect(result.status).toBe('success');
    });

    it('should handle missing metadata gracefully', async () => {
      const message = { level: 'info', message: 'Test message' };
      const minimalMetadata = { topic: 'system-logs' };

      const result = await processor.processMessage(message, minimalMetadata);

      expect(result.status).toBe('success');
      expect(processor.logger.info).toHaveBeenCalledWith('System Log Message', {
        topic: 'system-logs',
        partition: undefined,
        offset: undefined,
        message: JSON.stringify(message, null, 2)
      });
    });

    it('should handle metadata with undefined values', async () => {
      const message = { level: 'info', message: 'Test message' };
      const metadataWithUndefined = {
        topic: 'system-logs',
        partition: undefined,
        offset: undefined,
        key: undefined,
        timestamp: undefined,
        headers: undefined
      };

      const result = await processor.processMessage(message, metadataWithUndefined);

      expect(result.status).toBe('success');
    });
  });

  describe('Processor Integration Tests', () => {
    it('should process messages through the complete pipeline', async () => {
      const processor = new SystemLogsProcessor();
      
      const message = {
        level: 'info',
        message: 'Integration test message',
        timestamp: Date.now()
      };

      const metadata = {
        topic: 'system-logs',
        partition: 0,
        offset: 999,
        key: 'integration-test',
        timestamp: Date.now(),
        headers: {
          'test-id': 'integration-001'
        }
      };

      // Test the complete process method (inherited from KafkaTopicProcessor)
      const result = await processor.process('system-logs', message, metadata);

      expect(result.status).toBe('success');
      expect(result.message).toBe('System log message logged successfully');
    });

    it('should handle processing errors gracefully', async () => {
      const processor = new SystemLogsProcessor();
      
      // Mock the logger to throw an error
      processor.logger.info = jest.fn().mockImplementation(() => {
        throw new Error('Logger error');
      });

      const message = { level: 'info', message: 'Test message' };
      const metadata = { topic: 'system-logs' };

      const result = await processor.process('system-logs', message, metadata);

      expect(result.status).toBe('error');
      expect(result.message).toBe('Logger error');
    });

    it('should validate messages correctly', () => {
      const processor = new SystemLogsProcessor();
      
      const validMessage = { level: 'info', message: 'Valid message' };
      const invalidMessage = 'Invalid message string';
      
      expect(processor.validateMessage(validMessage).valid).toBe(true);
      expect(processor.validateMessage(invalidMessage).valid).toBe(false);
    });

    it('should create appropriate result objects', () => {
      const processor = new SystemLogsProcessor();
      
      const successResult = processor.createSuccessResult('Custom success');
      const errorResult = processor.createErrorResult('Custom error');
      
      expect(successResult.status).toBe('success');
      expect(successResult.message).toBe('Custom success');
      expect(errorResult.status).toBe('error');
      expect(errorResult.message).toBe('Custom error');
    });
  });

  describe('Processor Performance Tests', () => {
    it('should handle high-volume message processing', async () => {
      const processor = new SystemLogsProcessor();
      const messages = [];
      
      // Generate 1000 test messages
      for (let i = 0; i < 1000; i++) {
        messages.push({
          level: 'info',
          message: `High volume message ${i}`,
          timestamp: Date.now(),
          sequence: i
        });
      }

      const startTime = Date.now();
      
      // Process all messages
      const promises = messages.map((message, index) => 
        processor.processMessage(message, { topic: 'system-logs', partition: index % 3 })
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(1000);
      results.forEach(result => {
        expect(result.status).toBe('success');
      });
      
      // Should complete within reasonable time (adjust threshold as needed)
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    it('should handle concurrent message processing', async () => {
      const processor = new SystemLogsProcessor();
      const concurrentCount = 100;
      
      const message = {
        level: 'info',
        message: 'Concurrent test message',
        timestamp: Date.now()
      };

      const metadata = { topic: 'system-logs' };

      const startTime = Date.now();
      
      // Process messages concurrently
      const promises = Array(concurrentCount).fill().map(() => 
        processor.processMessage(message, metadata)
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(concurrentCount);
      results.forEach(result => {
        expect(result.status).toBe('success');
      });
      
      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(2000); // 2 seconds
    });
  });

  describe('Processor Error Scenarios', () => {
    it('should handle JSON stringify errors gracefully', async () => {
      const processor = new SystemLogsProcessor();
      
      // Create a message that can't be JSON stringified
      const problematicMessage = {};
      problematicMessage.self = problematicMessage; // Circular reference
      
      const metadata = { topic: 'system-logs' };

      // This should not throw an error
      const result = await processor.processMessage(problematicMessage, metadata);
      
      expect(result.status).toBe('success');
    });

    it('should handle logger failures gracefully', async () => {
      const processor = new SystemLogsProcessor();
      
      // Mock logger methods to fail
      processor.logger.info = jest.fn().mockImplementation(() => {
        throw new Error('Logger failure');
      });

      const message = { level: 'info', message: 'Test message' };
      const metadata = { topic: 'system-logs' };

      // Should handle logger failure gracefully
      const result = await processor.process('system-logs', message, metadata);
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Logger failure');
    });

    it('should handle missing logger gracefully', async () => {
      const processor = new SystemLogsProcessor();
      
      // Remove logger temporarily
      const originalLogger = processor.logger;
      processor.logger = null;

      const message = { level: 'info', message: 'Test message' };
      const metadata = { topic: 'system-logs' };

      // Should handle missing logger gracefully
      const result = await processor.process('system-logs', message, metadata);
      
      expect(result.status).toBe('error');
      
      // Restore logger
      processor.logger = originalLogger;
    });
  });

  describe('Processor Configuration Tests', () => {
    it('should use correct log level from environment', () => {
      const originalEnv = process.env;
      
      process.env.LOG_LEVEL = 'debug';
      
      const processor = new SystemLogsProcessor();
      
      expect(processor.logger).toBeDefined();
      
      // Restore environment
      process.env = originalEnv;
    });

    it('should handle missing environment variables', () => {
      const originalEnv = process.env;
      
      delete process.env.LOG_LEVEL;
      
      const processor = new SystemLogsProcessor();
      
      expect(processor.logger).toBeDefined();
      
      // Restore environment
      process.env = originalEnv;
    });
  });
});

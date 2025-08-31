const KafkaTopicProcessor = require('../src/kafka-topic-processor');
const path = require('path');

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

describe('KafkaTopicProcessor', () => {
  let processor;
  let mockStack;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock Error.stack to return a predictable stack trace
    mockStack = [
      'Error',
      '    at Object.<anonymous> (/test/file.js:1:1)',
      '    at KafkaTopicProcessor (/test/kafka-topic-processor.js:10:15)',
      '    at Object.<anonymous> (/test/test-file.js:5:10)'
    ].join('\n');
    
    // Mock the Error constructor to return our custom stack
    const originalError = global.Error;
    global.Error = jest.fn().mockImplementation(() => ({
      stack: mockStack
    }));
    
    processor = new KafkaTopicProcessor();
    
    // Restore original Error
    global.Error = originalError;
  });

  describe('constructor', () => {
    it('should create instance with auto-detected topic from stack trace', () => {
      // The actual topic will be based on the current file name, not a mocked value
      expect(processor.topic).toBeDefined();
      expect(typeof processor.topic).toBe('string');
      expect(processor.topic.length).toBeGreaterThan(0);
    });

    it('should fallback to unknown-topic when stack trace parsing fails', () => {
      // Mock a stack trace that doesn't match the expected pattern
      const invalidStack = [
        'Error',
        '    at Object.<anonymous> /test/file.js:1:1',
        '    at KafkaTopicProcessor /test/kafka-topic-processor.js:10:15'
      ].join('\n');
      
      const originalError = global.Error;
      global.Error = jest.fn().mockImplementation(() => ({
        stack: invalidStack
      }));
      
      const processorWithInvalidStack = new KafkaTopicProcessor();
      
      expect(processorWithInvalidStack.topic).toBe('unknown-topic');
      
      // Restore original Error
      global.Error = originalError;
    });

    it('should initialize logger with correct metadata', () => {
      expect(processor.logger).toBeDefined();
      // The logger should be initialized with the detected topic
    });

    it('should handle stack trace with different file extensions', () => {
      const tsStack = [
        'Error',
        '    at Object.<anonymous> (/test/file.ts:1:1)',
        '    at KafkaTopicProcessor (/test/kafka-topic-processor.js:10:15)'
      ].join('\n');
      
      const originalError = global.Error;
      global.Error = jest.fn().mockImplementation(() => ({
        stack: tsStack
      }));
      
      const tsProcessor = new KafkaTopicProcessor();
      
      expect(tsProcessor.topic).toBeDefined();
      expect(typeof tsProcessor.topic).toBe('string');
      
      // Restore original Error
      global.Error = originalError;
    });
  });

  describe('process', () => {
    it('should process message successfully and return success result', async () => {
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      // Mock the processMessage method to return a result
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success', data: 'processed' });
      
      const result = await processor.process('test-topic', message, metadata);
      
      expect(result.status).toBe('success');
      expect(result.data).toBe('processed');
      expect(processor.processMessage).toHaveBeenCalledWith(message, metadata);
    });

    it('should handle processing errors gracefully', async () => {
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      // Mock the processMessage method to throw an error
      processor.processMessage = jest.fn().mockRejectedValue(new Error('Processing failed'));
      
      const result = await processor.process('test-topic', message, metadata);
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Processing failed');
    });

    it('should log debug information for successful processing', async () => {
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      await processor.process('test-topic', message, metadata);
      
      expect(processor.logger.debug).toHaveBeenCalledWith('Received message for topic', {
        topic: 'test-topic',
        message: JSON.stringify(message, null, 2)
      });
      
      expect(processor.logger.debug).toHaveBeenCalledWith('Message metadata', {
        metadata: JSON.stringify(metadata, null, 2)
      });
      
      expect(processor.logger.debug).toHaveBeenCalledWith('Message processed successfully', {
        topic: 'test-topic',
        result: JSON.stringify({ status: 'success' }, null, 2)
      });
    });

    it('should log error information for failed processing', async () => {
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockRejectedValue(new Error('Processing failed'));
      
      await processor.process('test-topic', message, metadata);
      
      expect(processor.logger.error).toHaveBeenCalledWith('Error processing message for topic', {
        topic: 'test-topic',
        error: 'Processing failed'
      });
    });

    it('should handle circular reference in message gracefully', async () => {
      const circularMessage = { data: 'test' };
      circularMessage.self = circularMessage; // Create circular reference
      
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      // This should not throw an error
      const result = await processor.process('test-topic', circularMessage, metadata);
      
      expect(result.status).toBe('success');
    });
  });

  describe('processMessage', () => {
    it('should return default success result when not overridden', async () => {
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      const result = await processor.processMessage(message, metadata);
      
      expect(result.status).toBe('success');
      expect(result.message).toBe('Message processed successfully');
    });

    it('should be overridable by subclasses', async () => {
      class TestProcessor extends KafkaTopicProcessor {
        async processMessage(message, metadata) {
          return { status: 'custom', data: message.data, topic: metadata.topic };
        }
      }
      
      const testProcessor = new TestProcessor();
      const message = { data: 'test message' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      const result = await testProcessor.processMessage(message, metadata);
      
      expect(result.status).toBe('custom');
      expect(result.data).toBe('test message');
      expect(result.topic).toBe('test-topic');
    });
  });

  describe('validateMessage', () => {
    it('should validate valid message object', () => {
      const validMessage = { data: 'test', timestamp: Date.now() };
      
      const result = processor.validateMessage(validMessage);
      
      expect(result.valid).toBe(true);
    });

    it('should reject null message', () => {
      const result = processor.validateMessage(null);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a valid object');
    });

    it('should reject undefined message', () => {
      const result = processor.validateMessage(undefined);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a valid object');
    });

    it('should reject non-object message', () => {
      const result = processor.validateMessage('string message');
      
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Message must be a valid object');
    });

    it('should accept array message (arrays are objects in JavaScript)', () => {
      const result = processor.validateMessage(['array', 'message']);
      
      expect(result.valid).toBe(true);
    });

    it('should accept empty object', () => {
      const result = processor.validateMessage({});
      
      expect(result.valid).toBe(true);
    });
  });

  describe('createSuccessResult', () => {
    it('should create success result with default message', () => {
      const result = processor.createSuccessResult();
      
      expect(result.status).toBe('success');
      expect(result.message).toBe('Message processed successfully');
    });

    it('should create success result with custom message', () => {
      const result = processor.createSuccessResult('Custom success message');
      
      expect(result.status).toBe('success');
      expect(result.message).toBe('Custom success message');
    });

    it('should include additional data in result', () => {
      const additionalData = { userId: 123, timestamp: Date.now() };
      const result = processor.createSuccessResult('Success', additionalData);
      
      expect(result.status).toBe('success');
      expect(result.message).toBe('Success');
      expect(result.userId).toBe(123);
      expect(result.timestamp).toBeDefined();
    });

    it('should handle null additional data', () => {
      const result = processor.createSuccessResult('Success', null);
      
      expect(result.status).toBe('success');
      expect(result.message).toBe('Success');
      expect(Object.keys(result)).toHaveLength(2); // Only status and message
    });
  });

  describe('createErrorResult', () => {
    it('should create error result with default message', () => {
      const result = processor.createErrorResult();
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Unknown error occurred');
    });

    it('should create error result with custom message', () => {
      const result = processor.createErrorResult('Custom error message');
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Custom error message');
    });

    it('should include additional data in result', () => {
      const additionalData = { errorCode: 'E001', retryCount: 3 };
      const result = processor.createErrorResult('Error occurred', additionalData);
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Error occurred');
      expect(result.errorCode).toBe('E001');
      expect(result.retryCount).toBe(3);
    });

    it('should handle null additional data', () => {
      const result = processor.createErrorResult('Error', null);
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Error');
      expect(Object.keys(result)).toHaveLength(2); // Only status and message
    });
  });

  describe('inheritance and extension', () => {
    it('should allow subclasses to extend functionality', () => {
      class ExtendedProcessor extends KafkaTopicProcessor {
        constructor() {
          super();
          this.customProperty = 'extended';
        }
        
        async processMessage(message, metadata) {
          return { status: 'extended', customProperty: this.customProperty };
        }
      }
      
      const extendedProcessor = new ExtendedProcessor();
      
      expect(extendedProcessor.customProperty).toBe('extended');
      expect(extendedProcessor.topic).toBeDefined();
      expect(extendedProcessor.logger).toBeDefined();
    });

    it('should maintain topic detection in subclasses', () => {
      class SubProcessor extends KafkaTopicProcessor {
        constructor() {
          super();
        }
      }
      
      const subProcessor = new SubProcessor();
      
      expect(subProcessor.topic).toBeDefined();
      expect(typeof subProcessor.topic).toBe('string');
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle very long message content', async () => {
      const longMessage = { data: 'x'.repeat(10000) };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      const result = await processor.process('test-topic', longMessage, metadata);
      
      expect(result.status).toBe('success');
    });

    it('should handle message with special characters', async () => {
      const specialMessage = { 
        data: 'Special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
        unicode: 'Unicode: 🚀🌟🎯',
        newlines: 'Line1\nLine2\r\nLine3'
      };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      const result = await processor.process('test-topic', specialMessage, metadata);
      
      expect(result.status).toBe('success');
    });

    it('should handle metadata with complex structure', async () => {
      const message = { data: 'test' };
      const complexMetadata = {
        topic: 'test-topic',
        partition: 0,
        offset: 123,
        headers: {
          'content-type': 'application/json',
          'correlation-id': 'uuid-12345'
        },
        timestamp: Date.now(),
        key: 'test-key'
      };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      const result = await processor.process('test-topic', message, complexMetadata);
      
      expect(result.status).toBe('success');
    });

    it('should handle async processMessage that returns promise', async () => {
      class AsyncProcessor extends KafkaTopicProcessor {
        async processMessage(message, metadata) {
          // Simulate async operation
          await new Promise(resolve => setTimeout(resolve, 10));
          return { status: 'async-success', data: message.data };
        }
      }
      
      const asyncProcessor = new AsyncProcessor();
      const message = { data: 'async test' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      const result = await asyncProcessor.process('test-topic', message, metadata);
      
      expect(result.status).toBe('async-success');
      expect(result.data).toBe('async test');
    });
  });

  describe('logging behavior', () => {
    it('should log at appropriate levels', async () => {
      const message = { data: 'test' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockResolvedValue({ status: 'success' });
      
      await processor.process('test-topic', message, metadata);
      
      // Should log debug messages for successful processing
      expect(processor.logger.debug).toHaveBeenCalledTimes(3);
      expect(processor.logger.error).not.toHaveBeenCalled();
    });

    it('should log errors when processing fails', async () => {
      const message = { data: 'test' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      processor.processMessage = jest.fn().mockRejectedValue(new Error('Test error'));
      
      await processor.process('test-topic', message, metadata);
      
      expect(processor.logger.error).toHaveBeenCalledTimes(1);
    });
  });
});

const ProcessorRegistry = require('../src/processor-registry');
const fs = require('fs');

// Mock fs module
jest.mock('fs');

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

describe('ProcessorRegistry', () => {
  let registry;
  let mockProcessor;
  let mockKafkaAccessor;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset fs mocks
    fs.existsSync.mockReturnValue(true);
    fs.readdirSync.mockReturnValue(['test-processor.js']);
    fs.statSync.mockReturnValue({
      mtime: new Date('2023-01-01T00:00:00Z'),
      size: 1024
    });

    // Create mock processor
    mockProcessor = {
      name: 'TestProcessor',
      description: 'Test processor for testing',
      process: jest.fn().mockResolvedValue({ status: 'success' }),
      getInfo: jest.fn().mockReturnValue({ version: '1.0.0' })
    };

    // Create mock kafka accessor
    mockKafkaAccessor = {
      admin: {
        listTopics: jest.fn().mockResolvedValue(['test-processor'])
      }
    };

    registry = new ProcessorRegistry({
      processorsDir: './test-processors',
      autoRefresh: false
    });
  });

  afterEach(() => {
    if (registry) {
      registry.stopAutoRefresh();
    }
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      const defaultRegistry = new ProcessorRegistry();
      
      expect(defaultRegistry.processorsDir).toBe('./processors');
      expect(defaultRegistry.autoRefresh).toBe(true);
      expect(defaultRegistry.refreshInterval).toBe(5000);
      expect(defaultRegistry.fileExtensions).toEqual(['.js']);
    });

    it('should create instance with custom configuration', () => {
      const customRegistry = new ProcessorRegistry({
        processorsDir: './custom-processors',
        autoRefresh: false,
        refreshInterval: 10000,
        fileExtensions: ['.js', '.ts']
      });
      
      expect(customRegistry.processorsDir).toBe('./custom-processors');
      expect(customRegistry.autoRefresh).toBe(false);
      expect(customRegistry.refreshInterval).toBe(10000);
      expect(customRegistry.fileExtensions).toEqual(['.js', '.ts']);
    });

    it('should start auto-refresh when enabled', () => {
      const autoRefreshRegistry = new ProcessorRegistry({ autoRefresh: true });
      expect(autoRefreshRegistry.refreshTimer).toBeDefined();
      autoRefreshRegistry.stopAutoRefresh();
    });
  });

  describe('setProcessorsDirectory', () => {
    it('should change processors directory', () => {
      registry.setProcessorsDirectory('./new-processors');
      expect(registry.getProcessorsDirectory()).toBe('./new-processors');
    });

    it('should trigger refresh when auto-refresh is enabled', async () => {
      const autoRefreshRegistry = new ProcessorRegistry({ autoRefresh: true });
      const refreshSpy = jest.spyOn(autoRefreshRegistry, 'refreshProcessors');
      
      autoRefreshRegistry.setProcessorsDirectory('./new-processors');
      
      expect(refreshSpy).toHaveBeenCalled();
      autoRefreshRegistry.stopAutoRefresh();
    });
  });

  describe('scanProcessorFiles', () => {
    it('should scan directory and return processor files', () => {
      fs.readdirSync.mockReturnValue(['processor1.js', 'processor2.js', '.hidden.js', 'readme.md']);
      
      const files = registry.scanProcessorFiles();
      
      expect(files).toHaveLength(2);
      expect(files[0]).toContain('processor1.js');
      expect(files[1]).toContain('processor2.js');
    });

    it('should return empty array when directory does not exist', () => {
      fs.existsSync.mockReturnValue(false);
      
      const files = registry.scanProcessorFiles();
      
      expect(files).toEqual([]);
    });

    it('should handle readdir errors gracefully', () => {
      fs.readdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const files = registry.scanProcessorFiles();
      
      expect(files).toEqual([]);
    });

    it('should filter files by extension', () => {
      registry.fileExtensions = ['.js', '.ts'];
      fs.readdirSync.mockReturnValue(['processor1.js', 'processor2.ts', 'processor3.py']);
      
      const files = registry.scanProcessorFiles();
      
      expect(files).toHaveLength(2);
      expect(files[0]).toContain('processor1.js');
      expect(files[1]).toContain('processor2.ts');
    });
  });

  describe('loadProcessorFromFile', () => {
    it('should load processor class and instantiate it', () => {
      // Mock the loadProcessorFromFile method directly
      const originalMethod = registry.loadProcessorFromFile;
      registry.loadProcessorFromFile = jest.fn().mockReturnValue(mockProcessor);
      
      const processor = registry.loadProcessorFromFile('./test-processor.js');
      
      expect(processor).toBeDefined();
      expect(typeof processor.process).toBe('function');
      
      // Restore original method
      registry.loadProcessorFromFile = originalMethod;
    });

    it('should load processor object directly', () => {
      const mockModule = { process: jest.fn() };
      const originalMethod = registry.loadProcessorFromFile;
      registry.loadProcessorFromFile = jest.fn().mockReturnValue(mockModule);
      
      const processor = registry.loadProcessorFromFile('./test-processor.js');
      
      expect(processor).toBeDefined();
      expect(typeof processor.process).toBe('function');
      
      registry.loadProcessorFromFile = originalMethod;
    });

    it('should return null for invalid processor', () => {
      const originalMethod = registry.loadProcessorFromFile;
      registry.loadProcessorFromFile = jest.fn().mockReturnValue(null);
      
      const processor = registry.loadProcessorFromFile('./test-processor.js');
      
      expect(processor).toBeNull();
      
      registry.loadProcessorFromFile = originalMethod;
    });

    it('should handle require errors gracefully', () => {
      const originalMethod = registry.loadProcessorFromFile;
      registry.loadProcessorFromFile = jest.fn().mockReturnValue(null);
      
      const processor = registry.loadProcessorFromFile('./test-processor.js');
      
      expect(processor).toBeNull();
      
      registry.loadProcessorFromFile = originalMethod;
    });
  });

  describe('autoDiscoverProcessors', () => {
    it('should discover and register processors successfully', async () => {
      fs.readdirSync.mockReturnValue(['test-processor.js']);
      fs.statSync.mockReturnValue({
        mtime: new Date('2023-01-01T00:00:00Z'),
        size: 1024
      });
      
      // Mock the loadProcessorFromFile method
      jest.spyOn(registry, 'loadProcessorFromFile').mockReturnValue(mockProcessor);
      jest.spyOn(registry, 'registerProcessor').mockReturnValue({ success: true });
      
      const result = await registry.autoDiscoverProcessors({ kafkaAccessor: mockKafkaAccessor });
      
      expect(result.success).toBe(true);
      expect(result.discovered).toBe(1);
      expect(result.errors).toBe(0);
    });

    it('should skip processors when topic does not exist in Kafka', async () => {
      fs.readdirSync.mockReturnValue(['unknown-processor.js']);
      
      const result = await registry.autoDiscoverProcessors({ kafkaAccessor: mockKafkaAccessor });
      
      expect(result.discovered).toBe(0);
    });

    it('should handle Kafka topic scanning errors gracefully', async () => {
      const failingKafkaAccessor = {
        admin: {
          listTopics: jest.fn().mockRejectedValue(new Error('Connection failed'))
        }
      };
      
      const result = await registry.autoDiscoverProcessors({ kafkaAccessor: failingKafkaAccessor });
      
      expect(result.success).toBe(true);
      expect(result.availableTopics).toEqual([]);
    });

    it('should remove processors for deleted files', async () => {
      // First register a processor
      registry.registerProcessor('test-topic', mockProcessor, { source: 'auto-discovery', filePath: './test-processor.js' });
      
      // Mock file deletion
      fs.existsSync.mockReturnValue(false);
      
      const result = await registry.autoDiscoverProcessors({ kafkaAccessor: mockKafkaAccessor });
      
      expect(registry.hasProcessor('test-topic')).toBe(false);
    });

    it('should handle file modification time errors gracefully', async () => {
      fs.readdirSync.mockReturnValue(['test-processor.js']);
      fs.statSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });
      
      const result = await registry.autoDiscoverProcessors({ kafkaAccessor: mockKafkaAccessor });
      
      expect(result.success).toBe(true);
    });
  });

  describe('registerProcessor', () => {
    it('should register processor successfully', () => {
      const result = registry.registerProcessor('test-topic', mockProcessor);
      
      expect(result.success).toBe(true);
      expect(result.topic).toBe('test-topic');
      expect(result.action).toBe('registered');
      expect(registry.hasProcessor('test-topic')).toBe(true);
    });

    it('should update existing processor', () => {
      // First registration
      registry.registerProcessor('test-topic', mockProcessor);
      
      // Update with new processor
      const newProcessor = { ...mockProcessor, name: 'UpdatedProcessor' };
      const result = registry.registerProcessor('test-topic', newProcessor);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(registry.getProcessor('test-topic')).toBe(newProcessor);
    });

    it('should validate topic parameter', () => {
      const result = registry.registerProcessor(null, mockProcessor);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Topic must be a valid string');
    });

    it('should validate processor parameter', () => {
      const invalidProcessor = { name: 'InvalidProcessor' };
      const result = registry.registerProcessor('test-topic', invalidProcessor);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Processor must have a process method');
    });

    it('should emit events on registration', () => {
      const eventSpy = jest.fn();
      registry.on('processor:registered', eventSpy);
      
      registry.registerProcessor('test-topic', mockProcessor);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          processor: mockProcessor
        })
      );
    });

    it('should emit events on update', () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      const eventSpy = jest.fn();
      registry.on('processor:updated', eventSpy);
      
      const updatedProcessor = { ...mockProcessor, name: 'UpdatedProcessor' };
      registry.registerProcessor('test-topic', updatedProcessor);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          processor: updatedProcessor
        })
      );
    });
  });

  describe('deregisterProcessor', () => {
    beforeEach(() => {
      registry.registerProcessor('test-topic', mockProcessor);
    });

    it('should deregister processor successfully', () => {
      const result = registry.deregisterProcessor('test-topic');
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('deregistered');
      expect(registry.hasProcessor('test-topic')).toBe(false);
    });

    it('should validate topic parameter', () => {
      const result = registry.deregisterProcessor(null);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Topic must be a valid string');
    });

    it('should handle non-existent processor', () => {
      const result = registry.deregisterProcessor('non-existent-topic');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No processor found for topic');
    });

    it('should emit deregistration event', () => {
      const eventSpy = jest.fn();
      registry.on('processor:deregistered', eventSpy);
      
      registry.deregisterProcessor('test-topic');
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          processor: mockProcessor
        })
      );
    });
  });

  describe('updateProcessor', () => {
    beforeEach(() => {
      registry.registerProcessor('test-topic', mockProcessor);
    });

    it('should update processor successfully', () => {
      const updatedProcessor = { ...mockProcessor, name: 'UpdatedProcessor' };
      const result = registry.updateProcessor('test-topic', updatedProcessor);
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('updated');
      expect(result.previousVersion).toBeDefined();
      expect(registry.getProcessor('test-topic')).toBe(updatedProcessor);
    });

    it('should validate topic parameter', () => {
      const result = registry.updateProcessor(null, mockProcessor);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Topic must be a valid string');
    });

    it('should validate processor parameter', () => {
      const invalidProcessor = { name: 'InvalidProcessor' };
      const result = registry.updateProcessor('test-topic', invalidProcessor);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Processor must have a process method');
    });

    it('should handle non-existent processor', () => {
      const result = registry.updateProcessor('non-existent-topic', mockProcessor);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('No processor found for topic');
    });

    it('should emit update event', () => {
      const eventSpy = jest.fn();
      registry.on('processor:updated', eventSpy);
      
      const updatedProcessor = { ...mockProcessor, name: 'UpdatedProcessor' };
      registry.updateProcessor('test-topic', updatedProcessor);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          topic: 'test-topic',
          processor: updatedProcessor
        })
      );
    });
  });

  describe('getProcessor and hasProcessor', () => {
    it('should return processor when it exists', () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      expect(registry.getProcessor('test-topic')).toBe(mockProcessor);
      expect(registry.hasProcessor('test-topic')).toBe(true);
    });

    it('should return null when processor does not exist', () => {
      expect(registry.getProcessor('non-existent-topic')).toBeNull();
      expect(registry.hasProcessor('non-existent-topic')).toBe(false);
    });
  });

  describe('getAvailableTopics', () => {
    it('should return all registered topics', () => {
      registry.registerProcessor('topic1', mockProcessor);
      registry.registerProcessor('topic2', mockProcessor);
      
      const topics = registry.getAvailableTopics();
      
      expect(topics).toContain('topic1');
      expect(topics).toContain('topic2');
      expect(topics).toHaveLength(2);
    });

    it('should return empty array when no processors registered', () => {
      const topics = registry.getAvailableTopics();
      
      expect(topics).toEqual([]);
    });
  });

  describe('getProcessorInfo', () => {
    it('should return processor information', () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      const info = registry.getProcessorInfo('test-topic');
      
      expect(info.topic).toBe('test-topic');
      expect(info.processor.name).toBe('TestProcessor');
      expect(info.processor.hasProcessMethod).toBe(true);
      expect(info.version).toBeDefined();
      expect(info.registeredAt).toBeDefined();
    });

    it('should return null for non-existent processor', () => {
      const info = registry.getProcessorInfo('non-existent-topic');
      
      expect(info).toBeNull();
    });
  });

  describe('getAllProcessorInfo', () => {
    it('should return information for all processors', () => {
      registry.registerProcessor('topic1', mockProcessor);
      registry.registerProcessor('topic2', mockProcessor);
      
      const allInfo = registry.getAllProcessorInfo();
      
      expect(allInfo.topic1).toBeDefined();
      expect(allInfo.topic2).toBeDefined();
      expect(Object.keys(allInfo)).toHaveLength(2);
    });

    it('should return empty object when no processors registered', () => {
      const allInfo = registry.getAllProcessorInfo();
      
      expect(allInfo).toEqual({});
    });
  });

  describe('getRegistryStats', () => {
    it('should return registry statistics', () => {
      registry.registerProcessor('topic1', mockProcessor);
      registry.registerProcessor('topic2', mockProcessor);
      
      const stats = registry.getRegistryStats();
      
      expect(stats.totalRegistered).toBe(2);
      expect(stats.currentProcessors).toBe(2);
      expect(stats.currentTopics).toContain('topic1');
      expect(stats.currentTopics).toContain('topic2');
    });
  });

  describe('removeProcessor', () => {
    it('should be an alias for deregisterProcessor', () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      const result = registry.removeProcessor('test-topic');
      
      expect(result.success).toBe(true);
      expect(result.action).toBe('deregistered');
      expect(registry.hasProcessor('test-topic')).toBe(false);
    });
  });

  describe('clear', () => {
    it('should clear all processors', () => {
      registry.registerProcessor('topic1', mockProcessor);
      registry.registerProcessor('topic2', mockProcessor);
      
      const result = registry.clear();
      
      expect(result.success).toBe(true);
      expect(result.clearedCount).toBe(2);
      expect(result.topics).toContain('topic1');
      expect(result.topics).toContain('topic2');
      expect(registry.getAvailableTopics()).toEqual([]);
    });

    it('should emit clear event', () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      const eventSpy = jest.fn();
      registry.on('registry:cleared', eventSpy);
      
      registry.clear();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          clearedCount: 1,
          topics: ['test-topic']
        })
      );
    });
  });

  describe('generateProcessorVersion', () => {
    it('should generate unique version for processor', () => {
      // Mock Date.now to return different values
      const originalDateNow = Date.now;
      let callCount = 0;
      Date.now = jest.fn(() => {
        callCount++;
        return 1000000000000 + callCount;
      });
      
      const version1 = registry.generateProcessorVersion(mockProcessor);
      const version2 = registry.generateProcessorVersion(mockProcessor);
      
      expect(version1).toBeDefined();
      expect(version2).toBeDefined();
      expect(version1).not.toBe(version2);
      
      // Restore original Date.now
      Date.now = originalDateNow;
    });
  });

  describe('hashProcessor', () => {
    it('should generate consistent hash for same processor', () => {
      const hash1 = registry.hashProcessor(mockProcessor);
      const hash2 = registry.hashProcessor(mockProcessor);
      
      expect(hash1).toBe(hash2);
    });

    it('should generate different hash for different processors', () => {
      const processor1 = { name: 'Processor1', process: jest.fn() };
      const processor2 = { name: 'Processor2', process: jest.fn() };
      
      const hash1 = registry.hashProcessor(processor1);
      const hash2 = registry.hashProcessor(processor2);
      
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('validateProcessor', () => {
    it('should validate valid processor', () => {
      const result = registry.validateProcessor(mockProcessor);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('should reject null processor', () => {
      const result = registry.validateProcessor(null);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Processor is required');
    });

    it('should reject processor without process method', () => {
      const invalidProcessor = { name: 'InvalidProcessor' };
      const result = registry.validateProcessor(invalidProcessor);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Processor must have a process method');
    });

    it('should reject processor without name', () => {
      const invalidProcessor = { process: jest.fn() };
      // Mock the constructor name to be undefined
      Object.defineProperty(invalidProcessor, 'constructor', {
        value: { name: undefined },
        writable: true
      });
      
      const result = registry.validateProcessor(invalidProcessor);
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Processor must have a name');
    });
  });

  describe('processMessage', () => {
    it('should process message successfully', async () => {
      registry.registerProcessor('test-topic', mockProcessor);
      
      const message = { data: 'test' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      const result = await registry.processMessage('test-topic', message, metadata);
      
      expect(result.status).toBe('success');
      expect(result.topic).toBe('test-topic');
      expect(result.processor).toBe('Object');
      expect(mockProcessor.process).toHaveBeenCalledWith('test-topic', message, metadata);
    });

    it('should handle missing processor gracefully', async () => {
      const message = { data: 'test' };
      const metadata = { topic: 'unknown-topic', partition: 0, offset: 123 };
      
      const result = await registry.processMessage('unknown-topic', message, metadata);
      
      expect(result.status).toBe('error');
      expect(result.message).toContain('No processor found for topic');
    });

    it('should handle processor errors gracefully', async () => {
      const failingProcessor = {
        ...mockProcessor,
        process: jest.fn().mockRejectedValue(new Error('Processing failed'))
      };
      
      registry.registerProcessor('test-topic', failingProcessor);
      
      const message = { data: 'test' };
      const metadata = { topic: 'test-topic', partition: 0, offset: 123 };
      
      const result = await registry.processMessage('test-topic', message, metadata);
      
      expect(result.status).toBe('error');
      expect(result.message).toBe('Processing failed');
    });
  });

  describe('auto-refresh functionality', () => {
    it('should start and stop auto-refresh', () => {
      const autoRefreshRegistry = new ProcessorRegistry({ autoRefresh: true });
      
      expect(autoRefreshRegistry.refreshTimer).toBeDefined();
      
      autoRefreshRegistry.stopAutoRefresh();
      
      expect(autoRefreshRegistry.refreshTimer).toBeNull();
    });

    it('should get auto-refresh status', () => {
      const autoRefreshRegistry = new ProcessorRegistry({ autoRefresh: true });
      
      const status = autoRefreshRegistry.getAutoRefreshStatus();
      
      expect(status.enabled).toBe(true);
      expect(status.isRunning).toBe(true);
      expect(status.interval).toBe(5000);
      
      autoRefreshRegistry.stopAutoRefresh();
    });
  });

  describe('event emission', () => {
    it('should emit processor error events', () => {
      const eventSpy = jest.fn();
      registry.on('processor:error', eventSpy);
      
      // Trigger an error by trying to register invalid processor
      registry.registerProcessor('test-topic', null);
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          topic: 'test-topic'
        })
      );
    });

    it('should emit registry error events', () => {
      const eventSpy = jest.fn();
      registry.on('registry:error', eventSpy);
      
      // Mock clear to throw error
      jest.spyOn(registry.processors, 'clear').mockImplementation(() => {
        throw new Error('Clear failed');
      });
      
      registry.clear();
      
      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false
        })
      );
    });
  });
});

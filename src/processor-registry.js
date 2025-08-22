/**
 * Dynamic Processor Registry
 * Manages Kafka topic processors with dynamic registration, deregistration, and updates
 * Supports configurable processor directories and automatic refresh
 */

const EventEmitter = require('events');
const fs = require('fs');
const path = require('path');
const winston = require('winston');

class ProcessorRegistry extends EventEmitter {
  constructor(options = {}) {
    super();
    
    // Configuration
    this.processorsDir = options.processorsDir || './processors';
    this.autoRefresh = options.autoRefresh !== false; // Default to true
    this.refreshInterval = options.refreshInterval || 5000; // 5 seconds
    this.fileExtensions = options.fileExtensions || ['.js'];
    
    // Initialize logger
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'processor-registry' },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
    
    // Internal state
    this.processors = new Map();
    this.processorVersions = new Map();
    this.processorFiles = new Map(); // Track file paths
    this.registryStats = {
      totalRegistered: 0,
      totalDeregistered: 0,
      totalUpdated: 0,
      lastUpdated: null,
      autoRefreshCount: 0
    };
    
    // Auto-refresh functionality
    this.refreshTimer = null;
    this.watcher = null;
    
    // Initialize auto-refresh if enabled
    if (this.autoRefresh) {
      this.startAutoRefresh();
    }
  }

  /**
   * Start automatic refresh of processors
   */
  startAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
    }
    
    this.refreshTimer = setInterval(async () => {
      try {
        await this.refreshProcessors();
      } catch (error) {
        this.logger.error('Auto-refresh error', { error: error.message });
      }
    }, this.refreshInterval);
    
    this.logger.info('Auto-refresh started', { processorsDir: this.processorsDir });
  }

  /**
   * Stop automatic refresh
   */
  stopAutoRefresh() {
    if (this.refreshTimer) {
      clearInterval(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
    
    this.logger.info('Auto-refresh stopped');
  }

  /**
   * Set processors directory
   * @param {string} dir - New processors directory path
   */
  setProcessorsDirectory(dir) {
    this.processorsDir = dir;
    this.logger.info('Processors directory changed', { newDir: dir });
    
    // Refresh processors from new directory
    if (this.autoRefresh) {
      this.refreshProcessors();
    }
  }

  /**
   * Get processors directory
   * @returns {string} Current processors directory
   */
  getProcessorsDirectory() {
    return this.processorsDir;
  }

  /**
   * Scan processors directory for available processor files
   * @returns {Array} Array of processor file paths
   */
  scanProcessorFiles() {
    try {
      if (!fs.existsSync(this.processorsDir)) {
        this.logger.warn('Processors directory does not exist', { dir: this.processorsDir });
        return [];
      }
      
      const files = fs.readdirSync(this.processorsDir)
        .filter(file => {
          const ext = path.extname(file);
          return this.fileExtensions.includes(ext) && !file.startsWith('.');
        })
        .map(file => path.join(this.processorsDir, file));
      
      return files;
    } catch (error) {
      this.logger.error('Error scanning processors directory', { error: error.message });
      return [];
    }
  }

  /**
   * Load processor from file
   * @param {string} filePath - Path to processor file
   * @returns {Object|null} Processor instance or null if failed
   */
  loadProcessorFromFile(filePath) {
    try {
      // Resolve the absolute path
      const absolutePath = path.resolve(filePath);
      
      // Clear require cache to ensure fresh load
      delete require.cache[absolutePath];
      
      const processorModule = require(absolutePath);
      const ProcessorClass = processorModule.default || processorModule;
      
      if (typeof ProcessorClass === 'function') {
        return new ProcessorClass();
      } else if (typeof processorModule === 'object' && processorModule.process) {
        return processorModule;
      }
      
      this.logger.warn('Invalid processor in file', { filePath });
      return null;
    } catch (error) {
      this.logger.error('Error loading processor from file', { filePath, error: error.message });
      return null;
    }
  }

  /**
   * Auto-discover and register processors from directory
   * @param {Object} options - Discovery options
   * @returns {Object} Discovery result
   */
  async autoDiscoverProcessors(options = {}) {
    const forceRefresh = options.forceRefresh || false;
    const kafkaAccessor = options.kafkaAccessor;
    const discoveredProcessors = [];
    const errors = [];
    
    this.logger.info('Scanning processors directory', { dir: this.processorsDir });
    
    // First, get available Kafka topics if kafkaAccessor is provided
    let availableTopics = [];
    if (kafkaAccessor && kafkaAccessor.admin) {
      try {
        this.logger.info('Scanning Kafka topics...');
        availableTopics = await kafkaAccessor.admin.listTopics();
        this.logger.info('Found Kafka topics', { count: availableTopics.length });
      } catch (error) {
        this.logger.warn('Could not scan Kafka topics', { error: error.message });
        // Fall back to scanning processor files without topic validation
        availableTopics = null;
      }
    }
    
    // Scan processor files
    const currentFiles = this.scanProcessorFiles();
    
    for (const filePath of currentFiles) {
      const fileName = path.basename(filePath, path.extname(filePath));
      const existingFile = this.processorFiles.get(fileName);
      
      // Check if file has changed
      if (existingFile && !forceRefresh) {
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtime.getTime() === existingFile.mtime.getTime()) {
            continue; // File hasn't changed
          }
        } catch (error) {
          this.logger.warn('Could not check file modification time', { filePath });
        }
      }
      
      // Only register processor if topic exists in Kafka (if we have topic list)
      if (availableTopics !== null && !availableTopics.includes(fileName)) {
        this.logger.info('Skipping processor', { fileName, reason: 'topic not found in Kafka' });
        continue;
      }
      
      // Load and register processor
      const processor = this.loadProcessorFromFile(filePath);
      if (processor) {
        try {
          // Use filename as topic name (remove .js extension)
          const topic = fileName;
          
          // Register processor
          const result = this.registerProcessor(topic, processor, {
            source: 'auto-discovery',
            filePath: filePath
          });
          
          if (result.success) {
            // Track file info
            try {
              const stats = fs.statSync(filePath);
              this.processorFiles.set(fileName, {
                filePath,
                mtime: stats.mtime,
                size: stats.size
              });
            } catch (error) {
              this.logger.warn('Could not track file info', { filePath });
            }
            
            discoveredProcessors.push({ topic, filePath, result });
            this.logger.info('Registered processor for topic', { topic });
          }
        } catch (error) {
          errors.push({ filePath, error: error.message });
        }
      }
    }
    
    // Remove processors for files that no longer exist
    const existingTopics = Array.from(this.processors.keys());
    for (const topic of existingTopics) {
      const processorInfo = this.processorVersions.get(topic);
      if (processorInfo && processorInfo.options.source === 'auto-discovery') {
        const filePath = processorInfo.options.filePath;
        if (!fs.existsSync(filePath)) {
          this.logger.info('Removing processor for deleted file', { topic });
          this.deregisterProcessor(topic);
        }
      }
    }
    
    this.registryStats.autoRefreshCount++;
    
    return {
      success: true,
      discovered: discoveredProcessors.length,
      errors: errors.length,
      totalProcessors: this.processors.size,
      availableTopics: availableTopics || [],
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Refresh processors (alias for autoDiscoverProcessors)
   * @param {Object} options - Refresh options
   * @returns {Object} Refresh result
   */
  async refreshProcessors(options = {}) {
    return await this.autoDiscoverProcessors(options);
  }

  /**
   * Get processor file information
   * @returns {Object} Map of processor names to file info
   */
  getProcessorFileInfo() {
    return Object.fromEntries(this.processorFiles);
  }

  /**
   * Get auto-refresh status
   * @returns {Object} Auto-refresh status information
   */
  getAutoRefreshStatus() {
    return {
      enabled: this.autoRefresh,
      interval: this.refreshInterval,
      isRunning: !!this.refreshTimer,
      lastRefresh: this.registryStats.lastUpdated,
      refreshCount: this.registryStats.autoRefreshCount
    };
  }

  /**
   * Register a processor for a topic
   * @param {string} topic - The Kafka topic name
   * @param {Object} processor - The processor instance
   * @param {Object} options - Registration options
   * @returns {Object} Registration result
   */
  registerProcessor(topic, processor, options = {}) {
    try {
      // Validate inputs
      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic must be a valid string');
      }
      
      if (!processor || typeof processor.process !== 'function') {
        throw new Error('Processor must have a process method');
      }

      // Check if processor already exists
      const existingProcessor = this.processors.get(topic);
      const isUpdate = !!existingProcessor;
      
      // Generate processor version
      const version = this.generateProcessorVersion(processor);
      
      // Store processor and version
      this.processors.set(topic, processor);
      this.processorVersions.set(topic, {
        version,
        registeredAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        options
      });

      // Update stats
      if (isUpdate) {
        this.registryStats.totalUpdated++;
        this.emit('processor:updated', { topic, processor, version, options });
        this.logger.info('Updated processor for topic', { topic, version });
      } else {
        this.registryStats.totalRegistered++;
        this.emit('processor:registered', { topic, processor, version, options });
        this.logger.info('Registered processor for topic', { topic, version });
      }

      this.registryStats.lastUpdated = new Date().toISOString();

      return {
        success: true,
        topic,
        version,
        action: isUpdate ? 'updated' : 'registered',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const result = {
        success: false,
        topic,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.emit('processor:error', result);
      this.logger.error('Failed to register processor for topic', { topic, error: error.message });
      
      return result;
    }
  }

  /**
   * Deregister a processor for a topic
   * @param {string} topic - The Kafka topic name
   * @param {Object} options - Deregistration options
   * @returns {Object} Deregistration result
   */
  deregisterProcessor(topic, options = {}) {
    try {
      // Validate inputs
      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic must be a valid string');
      }

      // Check if processor exists
      if (!this.processors.has(topic)) {
        throw new Error(`No processor found for topic: ${topic}`);
      }

      // Get processor info before removal
      const processor = this.processors.get(topic);
      const versionInfo = this.processorVersions.get(topic);

      // Remove processor and version info
      this.processors.delete(topic);
      this.processorVersions.delete(topic);

      // Update stats
      this.registryStats.totalDeregistered++;
      this.registryStats.lastUpdated = new Date().toISOString();

      // Emit event
      this.emit('processor:deregistered', { 
        topic, 
        processor, 
        versionInfo, 
        options 
      });

      this.logger.info('Deregistered processor for topic', { topic });

      return {
        success: true,
        topic,
        action: 'deregistered',
        version: versionInfo?.version,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const result = {
        success: false,
        topic,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.emit('processor:error', result);
      this.logger.error('Failed to deregister processor for topic', { topic, error: error.message });
      
      return result;
    }
  }

  /**
   * Update an existing processor
   * @param {string} topic - The Kafka topic name
   * @param {Object} processor - The new processor instance
   * @param {Object} options - Update options
   * @returns {Object} Update result
   */
  updateProcessor(topic, processor, options = {}) {
    try {
      // Validate inputs
      if (!topic || typeof topic !== 'string') {
        throw new Error('Topic must be a valid string');
      }
      
      if (!processor || typeof processor.process !== 'function') {
        throw new Error('Processor must have a process method');
      }

      // Check if processor exists
      if (!this.processors.has(topic)) {
        throw new Error(`No processor found for topic: ${topic}. Use registerProcessor instead.`);
      }

      // Get old processor info
      const oldProcessor = this.processors.get(topic);
      const oldVersion = this.processorVersions.get(topic);

      // Update processor
      this.processors.set(topic, processor);
      
      // Update version info
      const newVersion = this.generateProcessorVersion(processor);
      this.processorVersions.set(topic, {
        ...oldVersion,
        version: newVersion,
        updatedAt: new Date().toISOString(),
        previousVersion: oldVersion.version,
        options
      });

      // Update stats
      this.registryStats.totalUpdated++;
      this.registryStats.lastUpdated = new Date().toISOString();

      // Emit event
      this.emit('processor:updated', { 
        topic, 
        processor, 
        oldProcessor,
        version: newVersion,
        previousVersion: oldVersion.version,
        options 
      });

      this.logger.info('Updated processor for topic', { topic, oldVersion: oldVersion.version, newVersion: newVersion });

      return {
        success: true,
        topic,
        version: newVersion,
        previousVersion: oldVersion.version,
        action: 'updated',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const result = {
        success: false,
        topic,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.emit('processor:error', result);
      this.logger.error('Failed to update processor for topic', { topic, error: error.message });
      
      return result;
    }
  }

  /**
   * Get processor for a specific topic
   * @param {string} topic - The Kafka topic name
   * @returns {Object|null} The processor instance or null if not found
   */
  getProcessor(topic) {
    return this.processors.get(topic) || null;
  }

  /**
   * Check if a topic has a processor
   * @param {string} topic - The Kafka topic name
   * @returns {boolean} True if processor exists
   */
  hasProcessor(topic) {
    return this.processors.has(topic);
  }

  /**
   * Get all available topics
   * @returns {Array<string>} List of topics with processors
   */
  getAvailableTopics() {
    return Array.from(this.processors.keys());
  }

  /**
   * Get processor information for a specific topic
   * @param {string} topic - The Kafka topic name
   * @returns {Object|null} Processor info or null if not found
   */
  getProcessorInfo(topic) {
    if (!this.processors.has(topic)) {
      return null;
    }

    const processor = this.processors.get(topic);
    const versionInfo = this.processorVersions.get(topic);

    return {
      topic,
      processor: {
        name: processor.name || processor.constructor.name,
        description: processor.description || 'No description',
        hasProcessMethod: typeof processor.process === 'function',
        hasGetInfoMethod: typeof processor.getInfo === 'function'
      },
      version: versionInfo.version,
      registeredAt: versionInfo.registeredAt,
      updatedAt: versionInfo.updatedAt,
      options: versionInfo.options
    };
  }

  /**
   * Get all processor information
   * @returns {Object} Map of topic to processor info
   */
  getAllProcessorInfo() {
    const info = {};
    for (const topic of this.processors.keys()) {
      info[topic] = this.getProcessorInfo(topic);
    }
    return info;
  }

  /**
   * Get registry statistics
   * @returns {Object} Registry statistics
   */
  getRegistryStats() {
    return {
      ...this.registryStats,
      currentProcessors: this.processors.size,
      currentTopics: this.getAvailableTopics()
    };
  }

  /**
   * Remove a processor for a topic (alias for deregisterProcessor)
   * @param {string} topic - The Kafka topic name
   * @param {Object} options - Removal options
   * @returns {Object} Removal result
   */
  removeProcessor(topic, options = {}) {
    return this.deregisterProcessor(topic, options);
  }

  /**
   * Clear all processors
   * @param {Object} options - Clear options
   * @returns {Object} Clear result
   */
  clear(options = {}) {
    try {
      const topics = this.getAvailableTopics();
      const clearedCount = topics.length;

      // Clear all processors
      this.processors.clear();
      this.processorVersions.clear();

      // Update stats
      this.registryStats.lastUpdated = new Date().toISOString();

      // Emit event
      this.emit('registry:cleared', { 
        clearedCount, 
        topics, 
        options 
      });

      this.logger.info('Cleared all processors', { clearedCount });

      return {
        success: true,
        clearedCount,
        topics,
        action: 'cleared',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      const result = {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
      
      this.emit('registry:error', result);
      this.logger.error('Failed to clear registry', { error: error.message });
      
      return result;
    }
  }

  /**
   * Generate a version for a processor
   * @param {Object} processor - The processor instance
   * @returns {string} Version string
   */
  generateProcessorVersion(processor) {
    const timestamp = Date.now();
    const processorHash = this.hashProcessor(processor);
    return `${timestamp}-${processorHash}`;
  }

  /**
   * Simple hash function for processor
   * @param {Object} processor - The processor instance
   * @returns {string} Hash string
   */
  hashProcessor(processor) {
    const processorStr = JSON.stringify({
      name: processor.name || processor.constructor.name,
      description: processor.description,
      hasProcess: typeof processor.process === 'function',
      hasGetInfo: typeof processor.getInfo === 'function'
    });
    
    let hash = 0;
    for (let i = 0; i < processorStr.length; i++) {
      const char = processorStr.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(16);
  }

  /**
   * Validate processor structure
   * @param {Object} processor - The processor to validate
   * @returns {Object} Validation result
   */
  validateProcessor(processor) {
    const errors = [];
    
    if (!processor) {
      errors.push('Processor is required');
    } else {
      if (typeof processor.process !== 'function') {
        errors.push('Processor must have a process method');
      }
      
      if (!processor.name && !processor.constructor.name) {
        errors.push('Processor must have a name');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Process a message using the appropriate processor
   * @param {string} topic - The Kafka topic name
   * @param {Object} message - The message payload
   * @param {Object} metadata - Message metadata
   * @returns {Promise<Object>} Processing result
   */
  async processMessage(topic, message, metadata) {
    const processor = this.getProcessor(topic);
    
    if (!processor) {
      this.logger.warn('No processor found for topic', { topic });
      return {
        status: 'error',
        message: `No processor found for topic: ${topic}`,
        topic,
        timestamp: new Date().toISOString()
      };
    }

    try {
      this.logger.info('Processing message from topic', { topic });
      const result = await processor.process(topic, message, metadata);
      
      return {
        ...result,
        topic,
        processor: processor.constructor.name,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error('Error processing message from topic', { topic, error: error.message });
      return {
        status: 'error',
        message: error.message,
        topic,
        processor: processor.constructor.name,
        timestamp: new Date().toISOString()
      };
    }
  }
}

module.exports = ProcessorRegistry;

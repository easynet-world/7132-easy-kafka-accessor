/**
 * Dynamic Processor Registry
 * Manages Kafka topic processors with dynamic registration, deregistration, and updates
 */

const EventEmitter = require('events');

class ProcessorRegistry extends EventEmitter {
  constructor() {
    super();
    this.processors = new Map();
    this.processorVersions = new Map();
    this.registryStats = {
      totalRegistered: 0,
      totalDeregistered: 0,
      totalUpdated: 0,
      lastUpdated: null
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
        console.log(`🔄 Updated processor for topic: ${topic} (v${version})`);
      } else {
        this.registryStats.totalRegistered++;
        this.emit('processor:registered', { topic, processor, version, options });
        console.log(`✅ Registered processor for topic: ${topic} (v${version})`);
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
      console.error(`❌ Failed to register processor for topic ${topic}:`, error.message);
      
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

      console.log(`🗑️  Deregistered processor for topic: ${topic}`);

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
      console.error(`❌ Failed to deregister processor for topic ${topic}:`, error.message);
      
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

      console.log(`🔄 Updated processor for topic: ${topic} (v${oldVersion.version} → v${newVersion})`);

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
      console.error(`❌ Failed to update processor for topic ${topic}:`, error.message);
      
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

      console.log(`🧹 Cleared all processors (${clearedCount} removed)`);

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
      console.error('❌ Failed to clear registry:', error.message);
      
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
      console.warn(`⚠️  No processor found for topic: ${topic}`);
      return {
        status: 'error',
        message: `No processor found for topic: ${topic}`,
        topic,
        timestamp: new Date().toISOString()
      };
    }

    try {
      console.log(`🔄 Processing message from topic: ${topic}`);
      const result = await processor.process(topic, message, metadata);
      
      return {
        ...result,
        topic,
        processor: processor.constructor.name,
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      console.error(`❌ Error processing message from ${topic}:`, error.message);
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

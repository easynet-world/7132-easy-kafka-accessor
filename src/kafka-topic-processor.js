/**
 * Kafka Topic Processor Class
 * All Kafka topic processors should extend this class
 */

const winston = require('winston');
const path = require('path');

class KafkaTopicProcessor {
  constructor() {
    // Auto-detect topic name from the calling file path
    const stackTrace = new Error().stack;
    const callerFile = stackTrace.split('\n')[2].match(/\((.+):\d+:\d+\)/)?.[1];
    
    if (callerFile) {
      const fileName = path.basename(callerFile, path.extname(callerFile));
      this.topic = fileName;
    } else {
      this.topic = 'unknown-topic';
    }
    
    // Initialize logger with auto-detected topic
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json()
      ),
      defaultMeta: { service: 'kafka-topic-processor', topic: this.topic },
      transports: [
        new winston.transports.Console({
          format: winston.format.simple()
        })
      ]
    });
  }

  /**
   * Process a message from a Kafka topic
   * @param {string} topic - The topic name
   * @param {Object} message - The message content
   * @param {Object} metadata - Message metadata (partition, offset, etc.)
   * @returns {Promise<Object>} Processing result
   */
  async process(topic, message, metadata) {
    try {
      this.logger.debug('Received message for topic', { 
        topic, 
        message: JSON.stringify(message, null, 2) 
      });
      this.logger.debug('Message metadata', { metadata: JSON.stringify(metadata, null, 2) });
      
      // Call the actual message processing logic
      const result = await this.processMessage(message, metadata);
      
      // Log success
      this.logger.debug('Message processed successfully', { 
        topic, 
        result: JSON.stringify(result, null, 2) 
      });
      
      return this.createSuccessResult(result);
    } catch (error) {
      // Log error
      this.logger.error('Error processing message for topic', { 
        topic, 
        error: error.message 
      });
      
      return this.createErrorResult(error.message);
    }
  }

  /**
   * Abstract method to be implemented by subclasses
   * @param {Object} _message - The Kafka message object
   * @param {Object} _metadata - Message metadata
   * @returns {Promise<Object>} Processing result
   */
  async processMessage(_message, _metadata) {
    // Default implementation - return success
    return {
      status: 'success',
      message: 'Message processed successfully'
    };
  }

  /**
   * Validate message structure
   * @param {Object} message - Message to validate
   * @returns {Object} Validation result
   */
  validateMessage(message) {
    if (!message || typeof message !== 'object') {
      return { valid: false, error: 'Message must be a valid object' };
    }
    
    return { valid: true };
  }

  /**
   * Create success result
   * @param {string} message - Success message
   * @param {Object} additionalData - Additional data to include
   * @returns {Object} Success result
   */
  createSuccessResult(message, additionalData = {}) {
    return {
      status: 'success',
      message: message || 'Message processed successfully',
      ...additionalData
    };
  }

  /**
   * Create error result
   * @param {string} error - Error message
   * @param {Object} additionalData - Additional data to include
   * @returns {Object} Success result
   */
  createErrorResult(error, additionalData = {}) {
    return {
      status: 'error',
      message: error || 'Unknown error occurred',
      ...additionalData
    };
  }
}

module.exports = KafkaTopicProcessor;

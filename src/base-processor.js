/**
 * Base Processor Class
 * Provides common functionality for all Kafka message processors
 */

class BaseProcessor {
  /**
   * Common process method - handles logging, error handling, and result structure
   * @param {string} topic - The Kafka topic name
   * @param {Object} message - The Kafka message object (JSON)
   * @param {Object} metadata - Message metadata (topic, partition, offset, etc.)
   * @returns {Promise<Object>} Processing result
   */
  async process(topic, message, metadata) {
    try {
      // Log the message and metadata at the beginning
      console.log(`📥 Received message for topic "${topic}":`, JSON.stringify(message, null, 2));
      console.log('📋 Message metadata:', JSON.stringify(metadata, null, 2));
      
      // Call the specific processor implementation
      const result = await this.processMessage(message, metadata);
      
      // Ensure result has the correct structure
      if (!result || typeof result !== 'object') {
        return {
          status: 'success',
          message: `Message for topic "${topic}" processed successfully`
        };
      }
      
      // If result doesn't have status, add it
      if (!result.status) {
        result.status = 'success';
      }
      
      console.log(`✅ Message for topic "${topic}" processed successfully:`, result);
      return result;
      
    } catch (error) {
      console.error(`❌ Error processing message for topic "${topic}":`, error.message);
      return { 
        status: 'error',
        message: error.message
      };
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
   * @returns {Object} Error result
   */
  createErrorResult(error, additionalData = {}) {
    return {
      status: 'error',
      message: error || 'Unknown error occurred',
      ...additionalData
    };
  }
}

module.exports = BaseProcessor;

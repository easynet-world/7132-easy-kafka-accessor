/**
 * System Logs Processor
 * Simple processor that prints out system-level Kafka messages
 */

const KafkaTopicProcessor = require('../src/kafka-topic-processor');

class SystemLogsProcessor extends KafkaTopicProcessor {
  constructor() {
    super('system-logs'); // Pass the topic name to parent constructor
  }

  /**
   * Process system-level messages - simply print them out
   * @param {Object} message - The Kafka message object (JSON)
   * @param {Object} metadata - Message metadata (topic, partition, offset, etc.)
   * @returns {Promise<Object>} Processing result
   */
  async processMessage(message, metadata) {
    // Log the system message using the inherited logger
    this.logger.info('System Log Message', {
      topic: metadata.topic,
      partition: metadata.partition,
      offset: metadata.offset,
      message: JSON.stringify(message, null, 2)
    });
    
    // Return success result
    return this.createSuccessResult('System log message logged successfully');
  }
}

module.exports = SystemLogsProcessor;

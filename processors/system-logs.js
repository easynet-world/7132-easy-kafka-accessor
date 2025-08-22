/**
 * System Logs Processor
 * Simple processor that prints out system-level Kafka messages
 */

const BaseProcessor = require('../src/base-processor');

class SystemLogsProcessor extends BaseProcessor {
  /**
   * Process system-level messages - simply print them out
   * @param {Object} message - The Kafka message object (JSON)
   * @param {Object} metadata - Message metadata (topic, partition, offset, etc.)
   * @returns {Promise<Object>} Processing result
   */
  async processMessage(message, metadata) {
    // Simply print out the message
    console.log('📋 System Log Message:');
    console.log('  Topic:', metadata.topic);
    console.log('  Partition:', metadata.partition);
    console.log('  Offset:', metadata.offset);
    console.log('  Message:', JSON.stringify(message, null, 2));
    console.log('---');
    
    // Return success result
    return this.createSuccessResult('System log message printed successfully');
  }
}

module.exports = SystemLogsProcessor;

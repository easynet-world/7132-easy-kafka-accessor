const KafkaTopicProcessor = require('../src/kafka-topic-processor');

class KrumbitProcessor extends KafkaTopicProcessor {
  constructor() {
    super('krumbit'); // Pass the topic name to parent constructor
  }

  async processMessage(message, metadata) {
    // 🎯 Process messages from the krumbit topic
    console.log('Processing krumbit message:', message);
    
    // Log the message details
    this.logger.info('Krumbit message received', {
      topic: metadata.topic,
      partition: metadata.partition,
      offset: metadata.offset,
      key: metadata.key,
      timestamp: metadata.timestamp,
      messageSize: JSON.stringify(message).length
    });
    
    // Your custom processing logic for krumbit messages goes here
    // For example:
    // - Parse and validate the message
    // - Transform the data
    // - Store to database
    // - Send notifications
    // - etc.
    
    // Return processing result
    return {
      processed: true,
      topic: 'krumbit',
      timestamp: new Date().toISOString(),
      data: message,
      metadata: metadata
    };
  }
}

module.exports = KrumbitProcessor;

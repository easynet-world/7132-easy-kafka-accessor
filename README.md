# Kafka Data Accessor

A simple, lightweight Node.js library for Kafka message production and consumption.

## 🚀 Quick Start

```javascript
const { KafkaAccessor } = require('kafka-data-accessor');

// Create instance (uses .env configuration)
const kafka = new KafkaAccessor();

// Send a message (producer auto-initializes)
await kafka.sendMessage('my-topic', { message: 'Hello Kafka!' });

// Start consuming messages (consumer auto-initializes and subscribes to all processor topics)
await kafka.startConsumer();
// That's it! All topics with processors are automatically discovered and processed

// Clean up
await kafka.disconnect();
```

## 🎯 Creating Processors

### Quick Setup (One File)

Create a processor file for your topic:

```javascript
// processors/user-events.js
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class UserEventsProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    // Your processing logic here
    console.log('Processing user event:', message);
    
    // Return result
    return {
      userId: message.userId,
      action: message.action,
      processed: true
    };
  }
}

module.exports = UserEventsProcessor;
```

**That's it!** The processor automatically:
- ✅ Gets loaded when you start the consumer
- ✅ Subscribes to the `user-events` topic
- ✅ Handles all messages with logging and error handling
- ✅ Uses the topic name from the filename

### How It Works

1. **File Naming**: `processors/[topic-name].js` → automatically subscribes to `[topic-name]`
2. **Class Structure**: Extend `KafkaTopicProcessor` and implement `processMessage()`
3. **Auto-Discovery**: Just call `kafka.startConsumer()` - everything else is automatic

## 📦 Installation

```bash
npm install kafka-data-accessor
```

## 📖 Examples

### Producer

```javascript
const { KafkaAccessor } = require('kafka-data-accessor');

// Uses .env configuration automatically
const kafka = new KafkaAccessor();

// Send a message (producer auto-initializes)
await kafka.sendMessage('logs', {
  level: 'info',
  message: 'Server started',
  timestamp: new Date().toISOString()
});

await kafka.disconnect();
```

### Consumer

```javascript
const { KafkaAccessor } = require('kafka-data-accessor');

// Uses .env configuration automatically
const kafka = new KafkaAccessor();

// Start consumer - automatically subscribes to all topics with processors
await kafka.startConsumer();
// That's it! All processors/[topic-name].js files are automatically loaded

// Keep running
process.on('SIGINT', async () => {
  await kafka.disconnect();
  process.exit(0);
});
```

### Both Producer and Consumer

```javascript
const { KafkaAccessor } = require('kafka-data-accessor');

// Uses .env configuration automatically
const kafka = new KafkaAccessor();

// Start consumer (auto-initializes and subscribes to all processor topics)
await kafka.startConsumer();

// Send messages (producer auto-initializes)
setInterval(async () => {
  await kafka.sendMessage('events', {
    event: 'heartbeat',
    timestamp: new Date().toISOString()
  });
}, 5000);
// Messages will be automatically processed by processors/events.js
```

## 🎯 Processor Implementation Details

### Processor Structure

Every processor extends `KafkaTopicProcessor` and implements the `processMessage` method:

```javascript
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class MyTopicProcessor extends KafkaTopicProcessor {
  constructor(topic) {
    super(topic); // Automatically sets up logging and topic context
  }

  async processMessage(message, metadata) {
    // Your custom processing logic
    const result = await this.processBusinessLogic(message);
    
    // Return processing result
    return {
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    };
  }

  // Optional: Add custom methods
  async processBusinessLogic(message) {
    // Your business logic here
    return { processed: true, message: message.content };
  }
}

module.exports = MyTopicProcessor;
```

### Available Methods & Properties

```javascript
class MyProcessor extends KafkaTopicProcessor {
  constructor(topic) {
    super(topic);
    
    // Available properties:
    this.topic;        // Topic name
    this.logger;       // Winston logger instance
  }

  async processMessage(message, metadata) {
    // Available metadata:
    // metadata.topic, metadata.partition, metadata.offset, metadata.timestamp
    
    // Built-in helper methods:
    const isValid = this.validateMessage(message);
    const success = this.createSuccessResult('Processed successfully');
    const error = this.createErrorResult('Processing failed');
    
    return success;
  }
}
```

### Error Handling

The base class automatically handles errors and logging:

```javascript
async processMessage(message, metadata) {
  try {
    // Your processing logic
    const result = await this.processData(message);
    return this.createSuccessResult(result);
  } catch (error) {
    // Errors are automatically logged and formatted
    return this.createErrorResult(error.message);
  }
}
```

### Example Processors

#### Simple Logging Processor
```javascript
// processors/system-logs.js
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class SystemLogsProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    this.logger.info('System Log', { message, metadata });
    return this.createSuccessResult('Logged successfully');
  }
}

module.exports = SystemLogsProcessor;
```

#### Data Transformation Processor
```javascript
// processors/user-data.js
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class UserDataProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    // Transform user data
    const transformed = {
      id: message.userId,
      name: message.fullName,
      email: message.emailAddress,
      processedAt: new Date().toISOString()
    };
    
    // Save to database, send notifications, etc.
    await this.saveUserData(transformed);
    
    return this.createSuccessResult(transformed);
  }
}

module.exports = UserDataProcessor;
```

## 🔧 API

### KafkaAccessor

```javascript
// No parameters needed - uses .env configuration
const kafka = new KafkaAccessor();
```

### Producer Methods

```javascript
// Send message (auto-initializes producer)
await kafka.sendMessage('topic', { data: 'message' });

// Send with options
await kafka.sendMessage('topic', message, {
  key: 'message-key',
  partition: 0
});
```

### Consumer Methods

```javascript
// Start consumer (auto-initializes and subscribes to all processor topics)
await kafka.startConsumer();

// Optional: Subscribe to specific topic with custom handler
await kafka.subscribeToTopic('topic', (message, metadata) => {
  // Handle message
});
```

### Admin Methods

```javascript
// Check if topic exists (auto-initializes admin)
const exists = await kafka.topicExists('my-topic');

// Create topic (auto-initializes admin)
await kafka.createTopic('my-topic', {
  numPartitions: 3,
  replicationFactor: 1
});
```

### Cleanup

```javascript
// Disconnect all clients
await kafka.disconnect();
```

### Automatic Processor Discovery

The library automatically discovers and subscribes to all topics that have processors in the `processors/` directory. Simply create a processor file named `[topic-name].js` and it will be automatically loaded when you start the consumer.

**See [Creating Processors](#-creating-processors) section above for quick setup examples.**

```javascript
// Just start the consumer - that's it!
await kafka.startConsumer();
// Automatically finds and subscribes to all processors/[topic-name].js files

// Only use this for custom handlers (overrides auto-discovery)
await kafka.subscribeToTopic('user-events', (message, metadata) => {
  console.log('Custom handler:', message);
});
```

**How it works**:
1. When you call `startConsumer()`, the library scans Kafka topics
2. Finds matching `[topic-name].js` processor files
3. Automatically subscribes to all topics with processors
4. Processors are automatically refreshed in the background
5. Zero configuration required

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in your project root:

```bash
# Copy the example file
cp env.example .env

# Edit .env with your configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
LOG_LEVEL=info

# Processor Registry (optional)
PROCESSORS_DIR=./processors
PROCESSORS_AUTO_REFRESH=true
PROCESSORS_REFRESH_INTERVAL=5000
```

### Configuration Options

All configuration is done via environment variables:

```bash
# Kafka Configuration
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group

# Producer Configuration
PRODUCER_ACKS=1
PRODUCER_TIMEOUT=30000
PRODUCER_RETRY_ATTEMPTS=3

# Consumer Configuration
CONSUMER_SESSION_TIMEOUT=30000
CONSUMER_HEARTBEAT_INTERVAL=3000
CONSUMER_MAX_BYTES=1048576

# Processor Registry Configuration
PROCESSORS_DIR=./processors
PROCESSORS_AUTO_REFRESH=true
PROCESSORS_REFRESH_INTERVAL=10000
```

**Note**: No constructor parameters needed - everything comes from `.env` file.

## 🧪 Testing

```bash
npm test
```

## 📄 License

MIT


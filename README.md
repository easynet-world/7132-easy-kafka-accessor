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


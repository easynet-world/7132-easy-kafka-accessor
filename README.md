# Easy Kafka Accessor

[![npm version](https://badge.fury.io/js/easy-kafka-accessor.svg)](https://badge.fury.io/js/easy-kafka-accessor)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)](https://nodejs.org/)

> **One function = Kafka consumer + producer + auto-discovery**

Automatically discover Kafka topics and process messages with zero configuration.

**📦 Release Policy: This project ONLY does patch releases (1.0.x) forever. No breaking changes, no major/minor versions.**

## 🚀 Quick Start

### 1. Install
```bash
npm install easy-kafka-accessor
```

### 2. Create a processor
```javascript
// processors/krumbit.js
const { KafkaTopicProcessor } = require('easy-kafka-accessor');

class KrumbitProcessor extends KafkaTopicProcessor {
  constructor() {
    super('krumbit');
  }

  async processMessage(message, metadata) {
    console.log('Processing krumbit message:', message);
    return { processed: true, data: message };
  }
}

module.exports = KrumbitProcessor;
```

### 3. Start consuming
```bash
KAFKA_BROKERS=kafka:9092 npm start
```

**That's it!** The system automatically:
- ✅ Discovers your `processors/krumbit.js` file
- ✅ Subscribes to the `krumbit` topic
- ✅ Starts processing messages immediately

## ✨ How It Works

### File-Based Discovery
```
processors/krumbit.js     → Topic: "krumbit"
processors/user-events.js → Topic: "user-events"
processors/orders.js      → Topic: "orders"
```

### Zero Configuration
- **No manual topic setup** - topics are auto-created
- **No manual subscription** - processors are auto-discovered
- **No complex configuration** - just create processor files

## 🔧 Usage

### Start Consumer
```javascript
const { KafkaAccessor } = require('easy-kafka-accessor');

const kafka = new KafkaAccessor();
await kafka.startConsumer(); // Auto-discovers all processors
```

### Send Messages
```javascript
await kafka.sendMessage('krumbit', {
  userId: 123,
  action: 'login',
  timestamp: new Date().toISOString()
});
```

### Check Topics
```javascript
const exists = await kafka.topicExists('krumbit');
await kafka.createTopic('my-topic', { numPartitions: 3 });
```

## 📁 Processor Structure

Each processor file must:
1. **Extend `KafkaTopicProcessor`**
2. **Call `super(topicName)` in constructor**
3. **Implement `processMessage(message, metadata)` method**

```javascript
class MyProcessor extends KafkaTopicProcessor {
  constructor() {
    super('my-topic'); // Topic name from filename
  }

  async processMessage(message, metadata) {
    // Your processing logic here
    return { processed: true };
  }
}
```

## ⚙️ Configuration

Set environment variables:

```bash
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
LOG_LEVEL=info
```

## 🧪 Testing

```bash
npm test
```

## 📄 License

MIT License

---

**Write one function → Get Kafka consumer + producer + topic management** 🚀


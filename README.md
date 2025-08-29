# Easy Kafka Accessor

> **One function = Kafka consumer + producer + auto-discovery**

Automatically discover Kafka topics and process messages with zero configuration.

## 🚀 Quick Start

### 1. Install
```bash
npm install easy-kafka-accessor
```

### 2. Create processor
```javascript
// processors/user-events.js
const { KafkaTopicProcessor } = require('easy-kafka-accessor');

class UserEventsProcessor extends KafkaTopicProcessor {
  constructor() {
    super('user-events');
  }

  async processMessage(message, metadata) {
    console.log('Processing:', message);
    return { processed: true };
  }
}

module.exports = UserEventsProcessor;
```

### 3. Start
```bash
KAFKA_BROKERS=kafka:9092 npm start
```

**Done!** System automatically discovers `user-events.js` → subscribes to `user-events` topic → starts processing messages.

## ✨ How It Works

**Filename = Topic Name**
```
processors/user-events.js → Topic: "user-events"
processors/orders.js      → Topic: "orders"
processors/logs.js        → Topic: "logs"
```

**Zero Configuration**
- No manual topic setup
- No manual subscription  
- Just create processor files

## 🔧 Usage

```javascript
const { KafkaAccessor } = require('easy-kafka-accessor');

const kafka = new KafkaAccessor();

// Start consumer (auto-discovers all processors)
await kafka.startConsumer();

// Send messages
await kafka.sendMessage('user-events', { userId: 123, action: 'login' });
```

## 📁 Processor Rules

1. **Extend `KafkaTopicProcessor`**
2. **Call `super('topic-name')` in constructor**
3. **Implement `processMessage(message, metadata)`**

## ⚙️ Config

```bash
KAFKA_BROKERS=kafka:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
```

## 📄 License

MIT License

---

**Write one function → Get Kafka consumer + producer + topic management** 🚀


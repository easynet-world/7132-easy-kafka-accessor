# Kafka Data Accessor

> **Kafka message processing that automatically discovers your topics and requires just ONE function to process everything.**

## ✨ **What This Does** 

**Automatically discover Kafka topics and process messages with intelligent auto-subscription - you only implement ONE function and get everything else for free.**

## 🚀 **Key Benefits** 

| Feature                          | What You Get                                                       |
| -------------------------------- | ------------------------------------------------------------------ |
| 🔍 **Auto Discovery**            | Automatically finds and subscribes to all processor topics        |
| 🧠 **One Function Processing**   | Just implement `processMessage()` - everything else is automatic  |
| 🛡️ **Zero Configuration**        | No manual topic subscription or setup needed                       |
| ⚡ **File-Based Discovery**      | Create `processors/[topic-name].js` and it's automatically loaded |

## 📦 **Installation** 

```bash
npm install kafka-data-accessor
```

## ⚡ **Quick Start (3 Steps)** 

### **Step 1: Setup Environment**

```bash
# Copy and edit environment file
cp env.example .env
```

**Edit `.env` with your Kafka settings:**

```bash
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=my-app
KAFKA_GROUP_ID=my-group
```

### **Step 2: Create a Processor**

```javascript
// processors/my-topic.js
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class MyTopicProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    // 🎯 THIS IS THE ONLY FUNCTION YOU NEED TO IMPLEMENT!
    console.log('Processing message:', message);
    
    // Your processing logic here
    return { processed: true, data: message };
  }
}

module.exports = MyTopicProcessor;
```

### **Step 3: Start Processing**

```bash
npm start
```

**🎉 That's it!** The application automatically:
- ✅ Detects your `processors/my-topic.js` file
- ✅ Subscribes to the `my-topic` topic (from filename)
- ✅ Starts processing messages immediately

## 🎯 **Core Methods** 

| Method                          | Purpose               | Example                                                    |
| ------------------------------- | --------------------- | ---------------------------------------------------------- |
| startConsumer()                 | Start auto-processing | await kafka.startConsumer()                                |
| sendMessage(topic, data)        | Send messages         | await kafka.sendMessage('logs', {level: 'info'})          |
| subscribeToTopic(topic, handler)| Custom subscription   | await kafka.subscribeToTopic('events', handler)           |
| topicExists(topic)              | Check topic exists    | const exists = await kafka.topicExists('my-topic')        |
| createTopic(topic, options)     | Create new topic      | await kafka.createTopic('my-topic', {numPartitions: 3})   |
| disconnect()                     | Clean shutdown        | await kafka.disconnect()                                   |

## 🔍 **How It Works** 

### **1. Auto Discovery**

```javascript
await kafka.startConsumer();
// ✅ Scans processors/ directory for topic processors
// ✅ Automatically subscribes to all discovered topics
// ✅ Uses topic names from filenames (processors/[topic-name].js)
// ✅ Starts processing messages immediately
```

### **2. One Function Processing**

```javascript
// The processor KNOWS your topic, so it:
// - Automatically handles all messages for that topic
// - Provides built-in error handling and logging
// - Gives you metadata (partition, offset, timestamp)
// - Requires just ONE function: processMessage()
```

### **3. Zero Manual Work**

* ❌ No SQL writing required
* ❌ No manual topic subscription
* ❌ No configuration boilerplate
* ✅ Just create a processor file and implement one function

## 📋 **Complete Example** 

```javascript
const { KafkaAccessor } = require('kafka-data-accessor');

async function example() {
  const kafka = new KafkaAccessor();
  
  // Start consumer (auto-discovers all processors)
  await kafka.startConsumer();
  
  // Send messages (producer auto-initializes)
  await kafka.sendMessage('user-events', {
    userId: 123,
    action: 'login',
    timestamp: new Date().toISOString()
  });
  
  // Messages automatically processed by processors/user-events.js
}

// Your processor automatically handles the message:
// processors/user-events.js
class UserEventsProcessor extends KafkaTopicProcessor {
  async processMessage(message, metadata) {
    console.log('User event:', message);
    // Process user event...
    return { processed: true };
  }
}
```

## 🎯 **Creating Processors** 

### **⚡ One Function to Process Everything!**

Create a processor file for your topic - **just implement ONE function**:

```javascript
// processors/user-events.js
const { KafkaTopicProcessor } = require('kafka-data-accessor');

class UserEventsProcessor extends KafkaTopicProcessor {
  // 🎯 THIS IS THE ONLY FUNCTION YOU NEED TO IMPLEMENT!
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

**🎉 That's literally it!** The processor automatically:
- ✅ Gets loaded when you start the consumer
- ✅ Subscribes to the `user-events` topic (from filename)
- ✅ Handles all messages with logging and error handling
- ✅ Uses the topic name from the filename

### **🧠 How Smart Auto-Subscription Works**

1. **📁 File Naming**: `processors/[topic-name].js` → automatically subscribes to `[topic-name]`
2. **⚡ One Function**: Extend `KafkaTopicProcessor` and implement `processMessage()`
3. **🔍 Auto-Discovery**: Just call `kafka.startConsumer()` - **everything else is automatic!**

## 🚀 **Application Scripts** 

### **Start the Application**

```bash
# Using npm script
npm start

# Or directly with Node.js
node app.js

# Or using the shell script
./scripts/start.sh

# Windows users
scripts\start.bat
```

### **Stop the Application**

```bash
# Unix/Mac
npm run stop

# Windows users
npm run stop:win

# Or using the shell script
./scripts/stop.sh

# Windows users
scripts\stop.bat
```

## ⚙️ **Configuration** 

### **Environment Variables**

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

### **Configuration Options**

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
```

**Note**: No constructor parameters needed - everything comes from `.env` file.

## 🔧 **API Reference** 

### **KafkaAccessor**

```javascript
// No parameters needed - uses .env configuration
const kafka = new KafkaAccessor();
```

### **Producer Methods**

```javascript
// Send message (auto-initializes producer)
await kafka.sendMessage('topic', { data: 'message' });

// Send with options
await kafka.sendMessage('topic', message, {
  key: 'message-key',
  partition: 0
});
```

### **Consumer Methods**

```javascript
// Start consumer (auto-initializes and subscribes to all processor topics)
await kafka.startConsumer();

// Optional: Subscribe to specific topic with custom handler
await kafka.subscribeToTopic('topic', (message, metadata) => {
  // Handle message
});
```

### **Admin Methods**

```javascript
// Check if topic exists (auto-initializes admin)
const exists = await kafka.topicExists('my-topic');

// Create topic (auto-initializes admin)
await kafka.createTopic('my-topic', {
  numPartitions: 3,
  replicationFactor: 1
});
```

### **Cleanup**

```javascript
// Disconnect all clients
await kafka.disconnect();
```

## 🎯 **Why Choose Kafka Data Accessor?** 

### **🚀 Smart Auto-Subscription**
- **Zero Configuration**: No manual topic subscription needed
- **File-Based Discovery**: Create `processors/[topic-name].js` and it's automatically loaded
- **Instant Processing**: Messages start flowing immediately after `startConsumer()`
- **Background Refresh**: Processors are automatically refreshed in the background

### **⚡ One Function Processing**
- **Single Responsibility**: Just implement `processMessage()` - that's it!
- **Everything Included**: Error handling, logging, validation, and result formatting
- **No Boilerplate**: Focus on your business logic, not infrastructure code
- **Consistent Interface**: Same pattern for all processors

### **🔍 Zero Configuration**
- **Environment-Based**: All config comes from `.env` file
- **Auto-Initialization**: Producers, consumers, and admin clients auto-initialize
- **Smart Defaults**: Sensible defaults for all settings
- **Production Ready**: Configure once, deploy anywhere

**🎉 Result**: Write less code, get more functionality, focus on what matters!

## 🧪 **Testing** 

```bash
npm test
```

## 📄 **License** 

MIT License - see LICENSE file for details.

---

**Kafka message processing that thinks for itself** 🧠✨


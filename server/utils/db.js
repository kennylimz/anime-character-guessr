const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGODB_URI || 'mongodb://localhost:27017';
if (!uri) {
  throw new Error('Please define MONGODB_URI in .env file');
}

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

let connected = false;

async function connect() {
  try {
    if (!connected) {
      await client.connect();
      await client.db("admin").command({ ping: 1 });
      console.log("Successfully connected to MongoDB!");
      connected = true;
    }
    return client;
  } catch (error) {
    console.error("Error connecting to MongoDB:", error);
    throw error;
  }
}

async function disconnect() {
  try {
    if (connected) {
      await client.close();
      connected = false;
      console.log("Disconnected from MongoDB");
    }
  } catch (error) {
    console.error("Error disconnecting from MongoDB:", error);
    throw error;
  }
}

// Handle process termination
process.on('SIGINT', async () => {
  await disconnect();
  process.exit(0);
});

module.exports = {
  connect,
  disconnect,
  getClient: () => client
}; 
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { startSelfPing } = require('./utils/selfPing');

const app = express();
const PORT = process.env.PORT || 3001;

const cors_options = {
  origin: [
    'http://localhost:5173',
    'http://localhost:5174',
    'https://anime-character-guessr.onrender.com',
    'https://anime-character-guessr.vercel.app',
    'https://anime-character-guessr.netlify.app'
  ],
  methods: ['GET', 'POST'],
  credentials: true
};

// Middleware
app.use(cors(cors_options));
app.use(express.json());

// Connect to MongoDB when the server starts
db.connect().catch(console.error);

// Basic health check route
app.get('/health', async (req, res) => {
  try {
    const client = db.getClient();
    await client.db("admin").command({ ping: 1 });
    res.json({ status: 'ok', mongodb: 'connected' });
  } catch (error) {
    res.status(500).json({ status: 'error', message: 'MongoDB connection failed' });
  }
});

// Character Tags API
app.post('/api/character-tags', async (req, res) => {
  try {
    const { characterId, tags } = req.body;
    
    // Validate request body
    if (!characterId || !tags || !Array.isArray(tags)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Required format: { characterId: number, tags: string[] }' 
      });
    }

    const client = db.getClient();
    const database = client.db('tags');
    const collection = database.collection('character_tags');

    // Get existing document if it exists
    const existingDoc = await collection.findOne({ _id: characterId });
    
    // Initialize or get existing tagCounts
    let tagCounts = {};
    if (existingDoc && existingDoc.tagCounts) {
      tagCounts = existingDoc.tagCounts;
    }

    // Update tag counts
    for (const tag of tags) {
      if (tag in tagCounts) {
        tagCounts[tag]++;
      } else {
        tagCounts[tag] = 1;
      }
    }
    
    // Create or update document
    const document = {
      _id: characterId,
      tagCounts
    };

    // Use replaceOne with upsert to handle both insert and update cases
    const result = await collection.replaceOne(
      { _id: characterId },
      document,
      { upsert: true }
    );
    
    res.status(201).json({
      message: result.upsertedCount ? 'Character tags added successfully' : 'Character tags updated successfully',
      characterId,
      document
    });
  } catch (error) {
    console.error('Error inserting character tags:', error);
    res.status(500).json({ error: 'Failed to insert character tags' });
  }
});

// Propose new tags for a character
app.post('/api/propose-tags', async (req, res) => {
  try {
    const { characterId, tags } = req.body;
    
    // Validate request body
    if (!characterId || !tags || !Array.isArray(tags)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Required format: { characterId: number, tags: string[] }' 
      });
    }

    const client = db.getClient();
    const database = client.db('tags'); 
    const collection = database.collection('new_tags');

    // Get existing document if it exists
    const existingDoc = await collection.findOne({ _id: characterId });
    
    // Initialize or get existing tagCounts
    let tagCounts = {};
    if (existingDoc && existingDoc.tagCounts) {
      tagCounts = existingDoc.tagCounts;
    }

    // Update tag counts
    for (const tag of tags) {
      if (tag in tagCounts) {
        tagCounts[tag]++;
      } else {
        tagCounts[tag] = 1;
      }
    }

    // Create or update document
    const document = {
      _id: characterId,
      tagCounts
    };

    // Use replaceOne with upsert to handle both insert and update cases
    const result = await collection.replaceOne(
      { _id: characterId },
      document,
      { upsert: true }
    );

    res.status(201).json({
      message: result.upsertedCount ? 'New tags added successfully' : 'New tags updated successfully',
      characterId,
      document
    });
  } catch (error) {
    console.error('Error proposing new tags:', error);
    res.status(500).json({ error: 'Failed to propose new tags' });
  }
});

// Feedback for character tags
app.post('/api/feedback-tags', async (req, res) => {
  try {
    const { characterId, upvotes, downvotes } = req.body;
    
    // Validate request body
    if (!characterId || !upvotes || !downvotes || !Array.isArray(upvotes) || !Array.isArray(downvotes)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Required format: { characterId: number, upvotes: string[], downvotes: string[] }' 
      });
    }

    const client = db.getClient();
    const database = client.db('tags');
    const collection = database.collection('character_tags');

    // Get existing document if it exists
    const existingDoc = await collection.findOne({ _id: characterId });
    
    // Check if document exists
    if (!existingDoc || !existingDoc.tagCounts) {
      return res.status(404).json({
        error: 'Character not found or has no tags'
      });
    }

    let tagCounts = { ...existingDoc.tagCounts };

    // Increment upvoted tags
    for (const tag of upvotes) {
      if (tag in tagCounts) {
        tagCounts[tag]++;
      }
    }

    // Decrement downvoted tags
    for (const tag of downvotes) {
      if (tag in tagCounts) {
        tagCounts[tag]--;
      }
    }

    // Update document
    const result = await collection.updateOne(
      { _id: characterId },
      { $set: { tagCounts } }
    );

    res.json({
      message: 'Tag feedback processed successfully',
      characterId,
      updated: result.modifiedCount > 0,
      tagCounts
    });
  } catch (error) {
    console.error('Error processing tag feedback:', error);
    res.status(500).json({ error: 'Failed to process tag feedback' });
  }
});

startSelfPing();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
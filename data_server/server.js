require('dotenv').config();
const express = require('express');
const cors = require('cors');
const db = require('./db');
const { startSelfPing } = require('./utils/selfPing');

const app = express();
const PORT = process.env.PORT || 3001;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';

const cors_options = {
  origin: [CLIENT_URL, SERVER_URL],
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

app.post('/api/game-character-tags', async (req, res) => {
  try {
    const { characterId, subjectId, tags } = req.body;
    // Validate request body
    if (!characterId || !subjectId || !tags || typeof tags !== 'object' || Array.isArray(tags)) {
      return res.status(400).json({ 
        error: 'Invalid request body. Required format: { characterId: string|number, subjectId: string|number, tags: { [section]: tag } }' 
      });
    }

    const client = db.getClient();
    const database = client.db('tags');
    const collection = database.collection('game_character_tags');

    // Build the $inc update object
    const incUpdate = {};
    for (const [section, tag] of Object.entries(tags)) {
      if (!section || !tag) continue;
      // Path: characters.characterId.section.tag
      const path = `characters.${characterId}.${section}.${tag}`;
      incUpdate[path] = 1;
    }

    if (Object.keys(incUpdate).length === 0) {
      return res.status(400).json({ error: 'No valid tags provided.' });
    }

    // Update the document for the subjectId
    const result = await collection.updateOne(
      { _id: subjectId },
      { $inc: incUpdate },
      { upsert: true }
    );

    res.status(201).json({
      message: result.upsertedCount ? 'Game character tags added successfully' : 'Game character tags updated successfully',
      subjectId,
      characterId,
      tags
    });
  } catch (error) {
    console.error('Error inserting game character tags:', error);
    res.status(500).json({ error: 'Failed to insert game character tags' });
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

// Count character usage
app.post('/api/answer-character-count', async (req, res) => {
  try {
    const { characterId, characterName } = req.body;
    
    // Validate request body
    if (!characterId || !characterName || typeof characterId !== 'number' || typeof characterName !== 'string') {
      return res.status(400).json({ 
        error: 'Invalid request body. Required format: { characterId: number, characterName: string }' 
      });
    }

    const client = db.getClient();
    let database = client.db('stats');
    let collection = database.collection('weekly_count');

    await collection.updateOne(
      { _id: characterId },
      { 
        $inc: { count: 1 },
        $set: { characterName: characterName.trim() }
      },
      { upsert: true }
    );

    database = client.db('stats');
    collection = database.collection('answer_count');

    result = await collection.updateOne(
      { _id: characterId },
      { 
        $inc: { count: 1 },
        $set: { characterName: characterName.trim() }
      },
      { upsert: true }
    );

    res.json({
      message: 'Character answer count updated successfully',
      characterId,
      updated: result.modifiedCount > 0,
      created: result.upsertedCount > 0
    });
  } catch (error) {
    console.error('Error updating character answer count:', error);
    res.status(500).json({ error: 'Failed to update character answer count' });
  }
});

// Get character usage by _id
app.get('/api/character-usage/:id', async (req, res) => {
  try {
    const characterId = Number(req.params.id);
    if (isNaN(characterId)) {
      return res.status(400).json({ error: 'Invalid character id' });
    }
    const client = db.getClient();
    const database = client.db('stats');
    const collection = database.collection('answer_count');

    const result = await collection.findOne({ _id: characterId });
    if (!result) {
      return res.status(404).json({ error: 'Character usage not found' });
    }
    res.json(result);
  } catch (error) {
    console.error('Error fetching character usage by id:', error);
    res.status(500).json({ error: 'Failed to fetch character usage by id' });
  }
});

startSelfPing();

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 
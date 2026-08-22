require('dotenv').config();
const express = require('express');
const http = require('http');
const {Server} = require('socket.io');
const cors = require('cors');
const {startAutoClean} = require('./utils/autoClean');
const db = require('./utils/db');
const fs = require('fs');
const path = require('path');
const characters = require('./data/character_images.json');

const PORT = process.env.PORT || 3000;
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';
const CLIENT_URL_EN = process.env.CLIENT_URL_EN || 'http://localhost:5173';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3000';
const DEV_CLIENT_URLS = ['http://localhost:5173', 'http://127.0.0.1:5173'];
const AES_SECRET = process.env.AES_SECRET || 'My-Secret-Key';
const cors_options = {
    origin: [...new Set([CLIENT_URL, CLIENT_URL_EN, SERVER_URL, ...DEV_CLIENT_URLS, 'https://ccb.baka.website', 'https://ccbeta.baka.website', 'https://anime-character-guessr.netlify.app', 'https://vertikarl.github.io'])],
    methods: ['GET', 'POST'],
    credentials: true
}

// type: 'medium' | 'grid'，默认优先 medium
function getCharacterImage(id, type = 'medium') {
    const info = characters.find(c => c.id === id);
    if (!info) return '';
    
    if (type === 'grid') {
        // 优先使用 grid
        if (Array.isArray(info.image_grid) && info.image_grid.length > 0) {
            return info.image_grid[Math.floor(Math.random() * info.image_grid.length)];
        }
        if (Array.isArray(info.image_medium) && info.image_medium.length > 0) {
            return info.image_medium[Math.floor(Math.random() * info.image_medium.length)];
        }
    } else {
        // 优先使用 medium
        if (Array.isArray(info.image_medium) && info.image_medium.length > 0) {
            return info.image_medium[Math.floor(Math.random() * info.image_medium.length)];
        }
        if (Array.isArray(info.image_grid) && info.image_grid.length > 0) {
            return info.image_grid[Math.floor(Math.random() * info.image_grid.length)];
        }
    }
    return '';
}

const app = express();
const server = http.createServer(app);
const io = new Server(server, {cors: cors_options, path: '/api/ws'});
app.use(cors(cors_options));
app.use(express.json());

const rooms = new Map();
const setupSocket = require('./utils/socket');
setupSocket(io, rooms);

async function generateFeedbackJson() {
    try {
        const client = db.getClient();
        if (!client) {
            console.error('MongoDB client not initialized, skipping feedbacks.json generation');
            return;
        }
        const database = client.db('misc');
        const collection = database.collection('feedback');
        
        // Find all feedback entries, projecting only public fields, sorting by createdAt desc
        const feedbacks = await collection.find(
            {},
            {
                projection: {
                    bugType: 1,
                    description: 1,
                    createdAt: 1,
                    reply: 1
                }
            }
        ).sort({ createdAt: -1 }).toArray();
        
        const dataPath = path.join(__dirname, 'data', 'feedbacks.json');
        fs.writeFileSync(dataPath, JSON.stringify(feedbacks, null, 2), 'utf-8');
        console.log(`Generated feedbacks.json with ${feedbacks.length} items at server startup/refresh.`);
    } catch (err) {
        console.error('Error generating feedbacks.json:', err);
    }
}

db.connect()
    .then(() => {
        console.log('Connected to MongoDB');
        return generateFeedbackJson();
    })
    .catch(console.error);

app.get('/', (req, res) => {
    res.send(`Hello from the server!`);
});

const handleHealth = async (req, res) => {
    try {
        const client = db.getClient();
        await client.db("admin").command({ ping: 1 });
        res.json({ status: 'ok', mongodb: 'connected' });
    } catch (error) {
        res.status(500).json({ status: 'error', message: 'MongoDB connection failed' });
    }
};
app.get('/api/health', handleHealth);

const handleQuickJoin = (req, res) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    // Get all public rooms that are not in progress
    const publicRooms = Array.from(rooms.entries()).filter(([id, room]) => room.isPublic);

    if (publicRooms.length === 0) {
        return res.status(404).json({ error: '没有可用的公开房间' });
    }

    const [roomId] = publicRooms[Math.floor(Math.random() * publicRooms.length)];

    // Check language parameter and use appropriate client URL
    const lang = req.query.lang;
    const clientUrl = lang === 'en' ? 'https://vertikarl.github.io/anime-character-guessr-english/#' : CLIENT_URL;

    // Construct the URL for the client to join
    const url = `${clientUrl}/multiplayer/${roomId}`;
    res.json({ url });
};
app.get('/api/quick-join', handleQuickJoin);

const handleRoomCount = (req, res) => {
    res.json({count: rooms.size});
};
app.get('/api/room-count', handleRoomCount);

const handleCleanRooms = (req, res) => {
    // 开发者模式下跳过自动清理
    if (process.env.DEV_MODE === 'true') {
        console.log('[DevMode] 跳过清理房间');
        return res.json({message: '[DevMode] 已跳过清理', devMode: true});
    }
    
    const now = Date.now();
    let cleaned = 0;
    for (const [roomId, room] of rooms.entries()) {
        if (room.lastActive && now - room.lastActive > 300000 && !room.currentGame) {
            // Notify all players in the room
            io.to(roomId).emit('roomClosed', {message: '房间因长时间无活动已关闭'});
            // Delete the room
            rooms.delete(roomId);
            cleaned++;
            console.log(`Room ${roomId} closed due to inactivity.`);
        }
    }
    res.json({message: `已清理${cleaned}个房间`});
};
app.get('/api/clean-rooms', handleCleanRooms);

const handleCloseRoomGet = (req, res) => {
    const roomId = req.params.id;

    if (!roomId || typeof roomId !== 'string') {
        return res.status(400).json({error: '房间ID不能为空'});
    }

    const room = rooms.get(roomId);
    if (!room) {
        return res.status(404).json({error: '房间不存在'});
    }

    io.to(roomId).emit('roomClosed', {message: '房间被管理关闭'});
    rooms.delete(roomId);

    res.json({
        message: '房间已关闭',
        roomId,
        playerCount: room.players?.length || 0
    });
};
app.get('/api/close-room/:id', handleCloseRoomGet);

// 支持通过 POST 提交关闭原因: { reason: string }
const handleCloseRoomPost = (req, res) => {
    const roomId = req.params.id;

    if (!roomId || typeof roomId !== 'string') {
        return res.status(400).json({error: '房间ID不能为空'});
    }

    const room = rooms.get(roomId);
    if (!room) {
        return res.status(404).json({error: '房间不存在'});
    }

    const reason = req.body && typeof req.body.reason === 'string' ? req.body.reason.trim() : '';
    const message = reason ? `房间因${reason}被关闭，如有疑问请添加首页QQ群` : '房间被管理关闭，如有疑问请添加首页QQ群';

    io.to(roomId).emit('roomClosed', {message});
    rooms.delete(roomId);

    res.json({
        message: '房间已关闭',
        roomId,
        playerCount: room.players?.length || 0,
        closeMessage: message,
        reason: reason || null
    });
};
app.post('/api/close-room/:id', handleCloseRoomPost);

const handleListRooms = (req, res) => {
    const roomsList = Array.from(rooms.entries()).map(([id, room]) => {
        const hostPlayer = room.players.find(p => p.isHost) || room.players.find(p => p.id === room.host);
        const hostName = hostPlayer?.username || '';
        const displayRoomName = (room.roomName && room.roomName.trim()) ? room.roomName : `${hostName}的房间`;

        return {
            id,
            isPublic: room.isPublic,
            playerCount: room.players.length,
            players: room.players.map(player => player.username),
            isGameStarted: !!room.currentGame, // 游戏是否已开始
            roomName: room.roomName || '',
            displayRoomName,
            hostName
        };
    });
    res.json(roomsList);
};
app.get('/api/list-rooms', handleListRooms);

const handleRoomInfo = (req, res) => {
    const roomId = req.params.id;
    const room = rooms.get(roomId);
    if (!room) {
        return res.status(404).json({ error: 'Room not found' });
    }
    res.json(room);
};
app.get('/api/room-info/:id', handleRoomInfo);

const handleRoulette = (req, res) => {
    if (!Array.isArray(characters) || characters.length < 10) {
        return res.status(500).json({ error: 'Not enough character images' });
    }
    function getRandomSample(arr, n) {
        const result = [];
        const used = new Set();
        while (result.length < n && used.size < arr.length) {
            const idx = Math.floor(Math.random() * arr.length);
            if (!used.has(idx)) {
                used.add(idx);
                result.push(arr[idx]);
            }
        }
        return result;
    }
    const selected = getRandomSample(characters, 10).map(char => ({
        id: char.id,
        tier: char.tier,
        image_medium: Array.isArray(char.image_medium) && char.image_medium.length > 0 ? char.image_medium[Math.floor(Math.random() * char.image_medium.length)] : null,
        image_grid: Array.isArray(char.image_grid) && char.image_grid.length > 0 ? char.image_grid[Math.floor(Math.random() * char.image_grid.length)] : null
    }));
    res.json(selected);
};
app.get('/api/roulette', handleRoulette);

const handleRedeem = async (req, res) => {
    try {
        const { code } = req.query;
        if (!code) {
            return res.status(400).json({ error: 'Code is required' });
        }

        const client = db.getClient();
        const database = client.db('misc');
        const collection = database.collection('avatars');

        // Look up the code in the collection
        const result = await collection.findOne({ code: code });
        
        if (!result) {
            console.log(`[ERROR][redeem][${req.ip}] Invalid or expired code: ${code}`);
            return res.status(404).json({ error: 'Invalid or expired code' });
        }

        // Return the URL field
        res.json({ 
            avatarId: result.avatarId,
            avatarImage: result.avatarImage 
        });
    } catch (error) {
        console.error('Error redeeming code:', error);
        res.status(500).json({ error: 'Failed to redeem code' });
    }
};
app.get('/api/redeem', handleRedeem);

const handleAddAvatar = async (req, res) => {
    try {
        const secret = req.query.secret ?? req.query.Secret ?? req.body?.secret ?? req.body?.Secret;
        const avatarId = req.query.avatarId ?? req.body?.avatarId;
        const avatarImage = req.query.avatarImage ?? req.body?.avatarImage;
        const code = req.query.code ?? req.body?.code;
        const memo = req.query.memo ?? req.body?.memo ?? '';

        if (!secret) {
            return res.status(401).json({ 
                error: 'Secret is required' 
            });
        }

        if (secret !== AES_SECRET) {
            return res.status(403).json({ 
                error: 'Invalid secret' 
            });
        }

        if (avatarId === undefined || avatarId === null || !avatarImage || !code) {
            return res.status(400).json({ 
                error: 'avatarId, avatarImage, and code are required' 
            });
        }

        const trimmedCode = String(code).trim();
        const trimmedAvatarImage = String(avatarImage).trim();
        const trimmedMemo = String(memo).trim();
        const trimmedAvatarId = String(avatarId).trim();

        if (!trimmedCode || !trimmedAvatarImage || !trimmedAvatarId) {
            return res.status(400).json({ 
                error: 'avatarId, avatarImage, and code cannot be empty' 
            });
        }

        const CODE_REGEX = /^[A-Z0-9]{6}$/;
        if (!CODE_REGEX.test(trimmedCode)) {
            return res.status(400).json({ 
                error: 'Code must be 6 characters containing uppercase letters and numbers only (e.g. A1B2C3)' 
            });
        }

        const client = db.getClient();
        const database = client.db('misc');
        const collection = database.collection('avatars');

        // Check if code already exists
        const existingAvatar = await collection.findOne({ code: trimmedCode });
        if (existingAvatar) {
            return res.status(409).json({ 
                error: 'Code already exists' 
            });
        }

        const document = {
            avatarId: trimmedAvatarId,
            avatarImage: trimmedAvatarImage,
            code: trimmedCode,
            memo: trimmedMemo
        };

        await collection.insertOne(document);

        console.log(`[INFO][add-avatar][${req.ip}] Avatar added: code=${trimmedCode}, avatarId=${trimmedAvatarId}`);

        res.status(201).json({
            message: 'Avatar added successfully',
            avatar: {
                avatarId: trimmedAvatarId,
                avatarImage: trimmedAvatarImage,
                code: trimmedCode,
                memo: trimmedMemo
            }
        });
    } catch (error) {
        console.error('Error adding avatar:', error);
        res.status(500).json({ error: 'Failed to add avatar' });
    }
};

app.get('/api/add-avartar', handleAddAvatar);
app.post('/api/add-avartar', handleAddAvatar);
app.get('/api/add-avatar', handleAddAvatar);
app.post('/api/add-avatar', handleAddAvatar);

startAutoClean();

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
        // Initialize or get existing tagCounts
        let tagCounts = {};
        if (existingDoc && existingDoc.tagCounts) {
            tagCounts = { ...existingDoc.tagCounts };
        }

        // Increment upvoted tags
        for (const tag of upvotes) {
            if (tag in tagCounts) {
                tagCounts[tag]++;
            } else {
                tagCounts[tag] = 1;
            }
        }

        // Decrement downvoted tags
        for (const tag of downvotes) {
            if (tag in tagCounts) {
                tagCounts[tag]--;
            } else {
                tagCounts[tag] = -1;
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

        res.json({
            message: result.upsertedCount ? 'Tag feedback created successfully' : 'Tag feedback processed successfully',
            characterId,
            updated: result.modifiedCount > 0,
            tagCounts
        });
    } catch (error) {
        console.error('Error processing tag feedback:', error);
        res.status(500).json({ error: 'Failed to process tag feedback' });
    }
});

function cleanBackslashes(str) {
    if (typeof str !== 'string') return str;
    return str
        .replace(/\\([\[\]\(\)\{\}'"\/])/g, '$1')
        .replace(/\\\\/g, '\\');
}

function sanitizeDiagnosticData(data) {
    if (typeof data === 'string') {
        return cleanBackslashes(data);
    }
    if (Array.isArray(data)) {
        return data.map(item => sanitizeDiagnosticData(item));
    }
    if (data && typeof data === 'object') {
        const cleaned = {};
        for (const [key, value] of Object.entries(data)) {
            cleaned[key] = sanitizeDiagnosticData(value);
        }
        return cleaned;
    }
    return data;
}

app.post('/api/bug-feedback', async (req, res) => {
    try {
        const { bugType, description, diagnosticData } = req.body;

        if (!bugType || !description || typeof bugType !== 'string' || typeof description !== 'string') {
            return res.status(400).json({
                error: 'Invalid request body. Required format: { bugType: string, description: string }'
            });
        }

        const client = db.getClient();
        const database = client.db('misc');
        const collection = database.collection('feedback');

        const document = {
            bugType: cleanBackslashes(bugType.trim()),
            description: cleanBackslashes(description.trim()),
            createdAt: new Date()
        };

        if (diagnosticData && typeof diagnosticData === 'object') {
            document.diagnosticData = sanitizeDiagnosticData(diagnosticData);
        }

        const result = await collection.insertOne(document);

        res.status(201).json({
            message: 'Feedback submitted successfully',
            feedbackId: result.insertedId
        });
    } catch (error) {
        console.error('Error submitting feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback' });
    }
});

app.get('/api/refresh-feedback', async (req, res) => {
    try {
        await generateFeedbackJson();
        res.json({ message: 'feedbacks.json regenerated successfully' });
    } catch (error) {
        console.error('Error refreshing feedback JSON:', error);
        res.status(500).json({ error: 'Failed to refresh feedback JSON' });
    }
});

app.get('/api/feedback-list', (req, res) => {
    try {
        const dataPath = path.join(__dirname, 'data', 'feedbacks.json');
        if (fs.existsSync(dataPath)) {
            const data = fs.readFileSync(dataPath, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.send(data);
        } else {
            res.json([]);
        }
    } catch (err) {
        console.error('Error serving feedback list:', err);
        res.status(500).json({ error: 'Failed to retrieve feedback list' });
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
        let collection = database.collection('answer_count');

        let result = await collection.updateOne(
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

app.post('/api/guess-character-count', async (req, res) => {
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
        collection = database.collection('guess_count');

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

app.post('/api/subject-added', async (req, res) => {
    try {
        const { addedSubjects } = req.body;
        if (!Array.isArray(addedSubjects) || addedSubjects.length === 0) {
            return res.status(400).json({ error: 'Invalid request body. Required format: { addedSubjects: [{ id, name, name_cn, type }] }' });
        }

        const client = db.getClient();
        const database = client.db('stats');
        const collection = database.collection('subject_count');

        const results = [];
        for (const subject of addedSubjects) {
            if (!subject.id || !subject.name || !subject.type) continue;
            const updateResult = await collection.updateOne(
                { _id: subject.id },
                {
                    $inc: { count: 1 },
                    $set: { name_cn: subject.name.trim(), type: subject.type }
                },
                { upsert: true }
            );
            results.push({
                id: subject.id,
                name_cn: subject.name_cn,
                updated: updateResult.modifiedCount > 0,
                created: updateResult.upsertedCount > 0
            });
        }
        res.json({ message: 'Subject counts updated', results });
    } catch (error) {
        console.error('Error updating subject count:', error);
        res.status(500).json({ error: 'Failed to update subject count' });
    }
});

server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    startAutoClean(rooms);
});

// Graceful shutdown handling
const gracefulShutdown = (signal) => {
    console.log(`Received ${signal}. Server shutting down...`);
    io.emit('serverShutdown', { message: '服务器已关闭，这可能是更新导致的重启或出现了Bug' });
    
    // Give sockets time to send the message
    setTimeout(() => {
        console.log('Exiting process.');
        process.exit(0);
    }, 1000);
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGUSR2', () => gracefulShutdown('SIGUSR2'));

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    io.emit('serverShutdown', { message: '服务器因错误关闭'});
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    io.emit('serverShutdown', { message: '服务器因错误关闭' });
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

app.get('/api/leaderboard/characters', async (req, res) => {
    try {
        const topN = Number(req.query.limit) || 30;
        const client = db.getClient();
        const database = client.db('stats');
        const collection = database.collection('answer_count');
        
        const sorted = await collection
            .find({ count: { $gt: 0 } })
            .sort({ count: -1 })
            .limit(topN)
            .toArray();
        
        const withImages = sorted.map((item, idx) => ({
          ...item,
          image: getCharacterImage(item._id, idx < 3 ? 'medium' : 'grid')
        }));
        res.json(withImages);
    } catch (error) {
        console.error('Error fetching leaderboard characters:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard characters' });
    }
});

app.get('/api/leaderboard/guesses', async (req, res) => {
    try {
        const topN = Number(req.query.limit) || 30;
        const client = db.getClient();
        const database = client.db('stats');
        const collection = database.collection('guess_count');
        
        const sorted = await collection
            .find({ count: { $gt: 0 } })
            .sort({ count: -1 })
            .limit(topN)
            .toArray();
        
        const withImages = sorted.map((item, idx) => ({
          ...item,
          image: getCharacterImage(item._id, idx < 3 ? 'medium' : 'grid')
        }));
        res.json(withImages);
    } catch (error) {
        console.error('Error fetching leaderboard guesses:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard guesses' });
    }
});

app.get('/api/leaderboard/weekly', async (req, res) => {
    try {
        const topN = Number(req.query.limit) || 30;
        const client = db.getClient();
        const database = client.db('stats');
        
        // 先获取猜测榜（guess_count）前 topN 的角色 ID
        const guessCollection = database.collection('guess_count');
        const topCharacters = await guessCollection
            .find({ count: { $gt: 0 } })
            .sort({ count: -1 })
            .limit(topN)
            .toArray();
        
        const topCharacterIds = topCharacters.map(item => item._id);
        
        // 从周榜中查询这些角色的周数据
        const weeklyCollection = database.collection('weekly_count');
        const weeklyData = await weeklyCollection
            .find({ _id: { $in: topCharacterIds } })
            .toArray();
        
        // 创建周榜数据映射
        const weeklyMap = new Map(weeklyData.map(item => [item._id, item.count || 0]));
        
        // 按猜测榜顺序返回，附加周榜数据
        const result = topCharacters.map((item, idx) => ({
            _id: item._id,
            count: weeklyMap.get(item._id) || 0,
            image: getCharacterImage(item._id, idx < 3 ? 'medium' : 'grid')
        }));
        
        res.json(result);
    } catch (error) {
        console.error('Error fetching leaderboard weekly:', error);
        res.status(500).json({ error: 'Failed to fetch leaderboard weekly' });
    }
});



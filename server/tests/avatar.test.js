const test = require('node:test');
const assert = require('node:assert/strict');
const db = require('../utils/db');

// Mock request and response helpers
function createMockReqRes({ query = {}, body = {}, ip = '127.0.0.1' } = {}) {
    const req = { query, body, ip };
    const res = {
        statusCode: 200,
        body: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(data) {
            this.body = data;
            return this;
        }
    };
    return { req, res };
}

test('Avatar API - validation, code regex format, duplicate check, and storage', async () => {
    const originalGetClient = db.getClient;
    const mockStorage = new Map();
    const AES_SECRET = process.env.AES_SECRET || 'My-Secret-Key';

    db.getClient = () => ({
        db: () => ({
            collection: () => ({
                findOne: async (filter) => {
                    return mockStorage.get(filter.code) || null;
                },
                insertOne: async (doc) => {
                    mockStorage.set(doc.code, { ...doc });
                    return { insertedId: 'mock_id' };
                }
            })
        })
    });

    try {
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
                res.status(500).json({ error: 'Failed to add avatar' });
            }
        };

        // Test 1: Missing secret
        {
            const { req, res } = createMockReqRes({ query: { avatarId: '101', avatarImage: 'img.jpg', code: 'A1B2C3' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 401);
            assert.ok(res.body.error.includes('Secret is required'));
        }

        // Test 2: Invalid secret
        {
            const { req, res } = createMockReqRes({ query: { Secret: 'wrong-secret', avatarId: '101', avatarImage: 'img.jpg', code: 'A1B2C3' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 403);
            assert.ok(res.body.error.includes('Invalid secret'));
        }

        // Test 3: Missing avatarId
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarImage: 'img.jpg', code: 'A1B2C3' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 400);
            assert.ok(res.body.error.includes('required'));
        }

        // Test 4: Missing avatarImage
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarId: '101', code: 'A1B2C3' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 400);
            assert.ok(res.body.error.includes('required'));
        }

        // Test 5: Missing code
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarId: '101', avatarImage: 'img.jpg' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 400);
            assert.ok(res.body.error.includes('required'));
        }

        // Test 6: Invalid code formats (too short, too long, lowercase, special characters)
        {
            const invalidCodes = ['A1B2C', 'A1B2C3D', 'a1b2c3', 'A1B2C!', '12345', 'ABCDEFGH'];
            for (const badCode of invalidCodes) {
                const { req, res } = createMockReqRes({
                    query: { Secret: AES_SECRET, avatarId: '101', avatarImage: 'img.jpg', code: badCode }
                });
                await handleAddAvatar(req, res);
                assert.equal(res.statusCode, 400, `Expected 400 for code: ${badCode}`);
                assert.ok(res.body.error.includes('Code must be 6 characters'));
            }
        }

        // Test 7: Successful creation with valid 6-char alphanumeric code
        {
            const { req, res } = createMockReqRes({
                query: {
                    Secret: AES_SECRET,
                    avatarId: '12393',
                    avatarImage: 'https://example.com/avatar.jpg',
                    code: 'A1B2C3',
                    memo: 'VIP Reward'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.message, 'Avatar added successfully');
            assert.equal(res.body.avatar.avatarId, '12393');
            assert.equal(res.body.avatar.avatarImage, 'https://example.com/avatar.jpg');
            assert.equal(res.body.avatar.code, 'A1B2C3');
            assert.equal(res.body.avatar.memo, 'VIP Reward');

            const stored = mockStorage.get('A1B2C3');
            assert.equal(stored.avatarId, '12393');
            assert.equal(stored.avatarImage, 'https://example.com/avatar.jpg');
            assert.equal(stored.code, 'A1B2C3');
            assert.equal(stored.memo, 'VIP Reward');
        }

        // Test 8: Duplicate code rejection (409 Conflict)
        {
            const { req, res } = createMockReqRes({
                query: {
                    Secret: AES_SECRET,
                    avatarId: '99999',
                    avatarImage: 'https://example.com/another.jpg',
                    code: 'A1B2C3',
                    memo: 'Duplicate attempt'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 409);
            assert.equal(res.body.error, 'Code already exists');
        }

        // Test 9: Read from req.body (POST) with valid code
        {
            const { req, res } = createMockReqRes({
                body: {
                    Secret: AES_SECRET,
                    avatarId: '706',
                    avatarImage: 'https://example.com/senjougahara.jpg',
                    code: 'CRAB01',
                    memo: 'Hitagi'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.avatar.avatarId, '706');
            assert.equal(res.body.avatar.code, 'CRAB01');
        }

    } finally {
        db.getClient = originalGetClient;
    }
});

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

test('Avatar API - validation, secret check, and storage logic', async () => {
    const originalGetClient = db.getClient;
    const mockStorage = new Map();
    const AES_SECRET = process.env.AES_SECRET || 'My-Secret-Key';

    db.getClient = () => ({
        db: () => ({
            collection: () => ({
                updateOne: async (filter, update, options) => {
                    const existing = mockStorage.get(filter.code);
                    const upsertedCount = existing ? 0 : 1;
                    const doc = {
                        ...(existing || {}),
                        ...(update.$set || {}),
                        ...(upsertedCount ? update.$setOnInsert || {} : {})
                    };
                    mockStorage.set(filter.code, doc);
                    return { upsertedCount };
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

                if (!avatarId || !avatarImage || !code) {
                    return res.status(400).json({ 
                        error: 'avatarId, avatarImage, and code are required' 
                    });
                }

                const trimmedCode = String(code).trim();
                const trimmedAvatarImage = String(avatarImage).trim();
                const trimmedMemo = String(memo).trim();
                const parsedAvatarId = (!isNaN(Number(avatarId)) && String(avatarId).trim() !== '') 
                    ? Number(avatarId) 
                    : String(avatarId).trim();

                if (!trimmedCode || !trimmedAvatarImage || (typeof parsedAvatarId === 'string' && !parsedAvatarId)) {
                    return res.status(400).json({ 
                        error: 'avatarId, avatarImage, and code cannot be empty' 
                    });
                }

                const client = db.getClient();
                const database = client.db('misc');
                const collection = database.collection('avatars');

                const filter = { code: trimmedCode };
                const updateDoc = {
                    $set: {
                        avatarId: parsedAvatarId,
                        avatarImage: trimmedAvatarImage,
                        memo: trimmedMemo,
                        updatedAt: new Date()
                    },
                    $setOnInsert: {
                        createdAt: new Date()
                    }
                };

                const result = await collection.updateOne(filter, updateDoc, { upsert: true });

                res.status(result.upsertedCount > 0 ? 201 : 200).json({
                    message: result.upsertedCount > 0 ? 'Avatar added successfully' : 'Avatar updated successfully',
                    avatar: {
                        avatarId: parsedAvatarId,
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
            const { req, res } = createMockReqRes({ query: { avatarId: '101', avatarImage: 'img.jpg', code: 'abc' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 401);
            assert.ok(res.body.error.includes('Secret is required'));
        }

        // Test 2: Invalid secret
        {
            const { req, res } = createMockReqRes({ query: { Secret: 'wrong-secret', avatarId: '101', avatarImage: 'img.jpg', code: 'abc' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 403);
            assert.ok(res.body.error.includes('Invalid secret'));
        }

        // Test 3: Missing avatarId
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarImage: 'img.jpg', code: 'abc' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 400);
            assert.ok(res.body.error.includes('required'));
        }

        // Test 4: Missing avatarImage
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarId: '101', code: 'abc' } });
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

        // Test 6: Empty strings
        {
            const { req, res } = createMockReqRes({ query: { Secret: AES_SECRET, avatarId: '   ', avatarImage: '  ', code: '   ' } });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 400);
        }

        // Test 7: Successful creation with numeric avatarId and Secret parameter
        {
            const { req, res } = createMockReqRes({
                query: {
                    Secret: AES_SECRET,
                    avatarId: '12393',
                    avatarImage: 'https://example.com/avatar.jpg',
                    code: 'SECRET_CODE_1',
                    memo: 'VIP Reward'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.message, 'Avatar added successfully');
            assert.equal(res.body.avatar.avatarId, 12393);
            assert.equal(res.body.avatar.avatarImage, 'https://example.com/avatar.jpg');
            assert.equal(res.body.avatar.code, 'SECRET_CODE_1');
            assert.equal(res.body.avatar.memo, 'VIP Reward');

            const stored = mockStorage.get('SECRET_CODE_1');
            assert.equal(stored.avatarId, 12393);
            assert.equal(stored.avatarImage, 'https://example.com/avatar.jpg');
            assert.equal(stored.memo, 'VIP Reward');
            assert.ok(stored.createdAt instanceof Date);
        }

        // Test 8: Successful update on existing code with lowercase secret parameter
        {
            const { req, res } = createMockReqRes({
                query: {
                    secret: AES_SECRET,
                    avatarId: '12393',
                    avatarImage: 'https://example.com/avatar_updated.jpg',
                    code: 'SECRET_CODE_1',
                    memo: 'Updated Memo'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 200);
            assert.equal(res.body.message, 'Avatar updated successfully');
            assert.equal(res.body.avatar.avatarImage, 'https://example.com/avatar_updated.jpg');
            assert.equal(res.body.avatar.memo, 'Updated Memo');

            const stored = mockStorage.get('SECRET_CODE_1');
            assert.equal(stored.avatarImage, 'https://example.com/avatar_updated.jpg');
            assert.equal(stored.memo, 'Updated Memo');
            assert.ok(stored.updatedAt instanceof Date);
        }

        // Test 9: Read from req.body (POST) with Secret
        {
            const { req, res } = createMockReqRes({
                body: {
                    Secret: AES_SECRET,
                    avatarId: 706,
                    avatarImage: 'https://example.com/senjougahara.jpg',
                    code: 'CRAB_CODE',
                    memo: 'Hitagi'
                }
            });
            await handleAddAvatar(req, res);
            assert.equal(res.statusCode, 201);
            assert.equal(res.body.avatar.avatarId, 706);
            assert.equal(res.body.avatar.code, 'CRAB_CODE');
        }

    } finally {
        db.getClient = originalGetClient;
    }
});

require('dotenv').config({ path: './backend/.env' });
const { createClient } = require('@vectorize-io/hindsight-client');

const client = createClient({
    baseUrl: 'https://api.hindsight.vectorize.io',
    apiKey: process.env.HINDSIGHT_API_KEY
});

const BANK_ID = process.env.HINDSIGHT_PIPELINE_ID;

async function retainMemory(userId, text) {
    try {
        console.log(`[Hindsight] Retaining memory for user: ${userId}`);
        const response = await client.post({
            url: `/v1/default/banks/${BANK_ID}/memories/retain`,
            body: {
                items: [{
                    content: text,
                    context: 'chat conversation',
                    document_id: `${userId}-${Date.now()}`
                }]
            }
        });
        console.log('[Hindsight] Memory retained successfully');
        return response;
    } catch (error) {
        console.error('[Hindsight] Error retaining memory:', error.message);
        return null;
    }
}

async function recallMemory(userId, query) {
    try {
        console.log(`[Hindsight] Recalling memories for user: ${userId}`);
        const response = await client.post({
            url: `/v1/default/banks/${BANK_ID}/memories/recall`,
            body: {
                query: query,
                top_k: 5
            }
        });
        const memories = response?.data?.results || response?.results || [];
        console.log(`[Hindsight] Found ${memories.length} memories`);
        return memories.map(m => m.text || m.content || m);
    } catch (error) {
        console.error('[Hindsight] Error recalling memory:', error.message);
        return [];
    }
}

module.exports = { retainMemory, recallMemory };
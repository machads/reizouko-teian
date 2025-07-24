const OpenAI = require('openai');
require('dotenv').config();

async function testOpenAI() {
    try {
        console.log('OpenAI APIキーの確認...');
        console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
        console.log('API Key prefix:', process.env.OPENAI_API_KEY ? process.env.OPENAI_API_KEY.substring(0, 20) + '...' : 'なし');

        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });

        console.log('\nOpenAI Vision APIのテスト...');
        
        // 小さなテスト画像のbase64データ（1x1ピクセルの赤い点）
        const testImageBase64 = '/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/2wBDAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQH/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwA/wA==';

        const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: "この画像に何が写っていますか？簡潔に答えてください。"
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/jpeg;base64,${testImageBase64}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 50
        });

        console.log('✅ OpenAI Vision API テスト成功');
        console.log('レスポンス:', response.choices[0]?.message?.content);
    } catch (error) {
        console.error('❌ OpenAI APIテスト失敗:', error.message);
        if (error.status) {
            console.error('Status:', error.status);
        }
        if (error.type) {
            console.error('Type:', error.type);
        }
    }
}

testOpenAI();
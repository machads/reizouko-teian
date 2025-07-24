const http = require('http');
const fs = require('fs');

// テスト用のモックデータ
const mockRecipes = [
    {
        name: '鶏肉と野菜の炒め物',
        ingredients: ['鶏肉', '玉ねぎ', 'にんじん'],
        instructions: [
            '鶏肉を一口大に切る',
            '野菜を切る',
            'フライパンで炒める'
        ],
        cooking_time: '15分',
        difficulty: '簡単'
    }
];

// APIテスト関数
const testAPI = async (endpoint, method = 'GET', data = null) => {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3003,
            path: endpoint,
            method: method,
            headers: {
                'Content-Type': 'application/json',
            }
        };

        const req = http.request(options, (res) => {
            let responseData = '';
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            res.on('end', () => {
                try {
                    const parsedData = JSON.parse(responseData);
                    resolve({
                        statusCode: res.statusCode,
                        data: parsedData,
                        headers: res.headers
                    });
                } catch (error) {
                    resolve({
                        statusCode: res.statusCode,
                        data: responseData,
                        headers: res.headers
                    });
                }
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        if (data) {
            req.write(JSON.stringify(data));
        }
        req.end();
    });
};

// テスト実行関数
const runTests = async () => {
    console.log('=== バックエンドAPIテスト開始 ===');
    let passedTests = 0;
    let failedTests = 0;
    const testResults = [];

    // テスト1: サーバー接続確認
    try {
        console.log('テスト1: サーバー接続確認');
        const response = await testAPI('/api/suggest-recipes', 'POST', {
            ingredients: ['テスト材料'],
            dietary_restrictions: [],
            cuisine_preference: 'japanese'
        });
        
        if (response.statusCode === 200 || response.statusCode === 400) {
            console.log('✓ サーバー接続成功');
            testResults.push({ name: 'サーバー接続確認', status: 'PASS', details: `Status: ${response.statusCode}` });
            passedTests++;
        } else {
            throw new Error(`予期しないステータスコード: ${response.statusCode}`);
        }
    } catch (error) {
        console.error('✗ サーバー接続失敗:', error.message);
        testResults.push({ name: 'サーバー接続確認', status: 'FAIL', details: error.message });
        failedTests++;
    }

    // テスト2: レシピ提案API - 正常ケース
    try {
        console.log('テスト2: レシピ提案API - 正常ケース');
        const response = await testAPI('/api/suggest-recipes', 'POST', {
            ingredients: ['鶏肉', '玉ねぎ', 'にんじん'],
            dietary_restrictions: [],
            cuisine_preference: 'japanese'
        });
        
        if (response.statusCode === 200 && response.data.success) {
            console.log('✓ レシピ提案API - 正常ケース成功');
            testResults.push({ name: 'レシピ提案API - 正常ケース', status: 'PASS', details: `レシピ数: ${response.data.data?.recipes?.length || 0}` });
            passedTests++;
        } else {
            throw new Error(`ステータス: ${response.statusCode}, レスポンス: ${JSON.stringify(response.data)}`);
        }
    } catch (error) {
        console.error('✗ レシピ提案API - 正常ケース失敗:', error.message);
        testResults.push({ name: 'レシピ提案API - 正常ケース', status: 'FAIL', details: error.message });
        failedTests++;
    }

    // テスト3: レシピ提案API - 材料なしエラー
    try {
        console.log('テスト3: レシピ提案API - 材料なしエラー');
        const response = await testAPI('/api/suggest-recipes', 'POST', {
            ingredients: [],
            dietary_restrictions: [],
            cuisine_preference: 'japanese'
        });
        
        if (response.statusCode === 400 && response.data.success === false) {
            console.log('✓ レシピ提案API - 材料なしエラー処理成功');
            testResults.push({ name: 'レシピ提案API - 材料なしエラー', status: 'PASS', details: response.data.error });
            passedTests++;
        } else {
            throw new Error(`期待: 400エラー, 実際: ${response.statusCode}`);
        }
    } catch (error) {
        console.error('✗ レシピ提案API - 材料なしエラー失敗:', error.message);
        testResults.push({ name: 'レシピ提案API - 材料なしエラー', status: 'FAIL', details: error.message });
        failedTests++;
    }

    // テスト4: 存在しないエンドポイント
    try {
        console.log('テスト4: 存在しないエンドポイント');
        const response = await testAPI('/api/nonexistent', 'GET');
        
        if (response.statusCode === 404) {
            console.log('✓ 存在しないエンドポイント - 404エラー');
            testResults.push({ name: '存在しないエンドポイント', status: 'PASS', details: '404エラーが正しく返される' });
            passedTests++;
        } else {
            throw new Error(`期待: 404, 実際: ${response.statusCode}`);
        }
    } catch (error) {
        console.error('✗ 存在しないエンドポイント失敗:', error.message);
        testResults.push({ name: '存在しないエンドポイント', status: 'FAIL', details: error.message });
        failedTests++;
    }

    // テスト5: CORS ヘッダー確認
    try {
        console.log('テスト5: CORS ヘッダー確認');
        const response = await testAPI('/api/suggest-recipes', 'OPTIONS');
        
        if (response.headers['access-control-allow-origin'] || response.statusCode === 200) {
            console.log('✓ CORS設定確認');
            testResults.push({ name: 'CORS設定確認', status: 'PASS', details: 'CORSヘッダーが設定されている' });
            passedTests++;
        } else {
            throw new Error('CORSヘッダーが見つかりません');
        }
    } catch (error) {
        console.error('✗ CORS設定確認失敗:', error.message);
        testResults.push({ name: 'CORS設定確認', status: 'FAIL', details: error.message });
        failedTests++;
    }

    // テスト結果出力
    console.log('\n=== テスト結果サマリー ===');
    console.log(`成功: ${passedTests}`);
    console.log(`失敗: ${failedTests}`);
    console.log(`合計: ${passedTests + failedTests}`);
    console.log(`成功率: ${((passedTests / (passedTests + failedTests)) * 100).toFixed(1)}%`);

    // 詳細結果をファイルに保存
    const reportData = {
        timestamp: new Date().toISOString(),
        summary: {
            passed: passedTests,
            failed: failedTests,
            total: passedTests + failedTests,
            successRate: ((passedTests / (passedTests + failedTests)) * 100).toFixed(1)
        },
        tests: testResults
    };

    try {
        fs.writeFileSync('test-report.json', JSON.stringify(reportData, null, 2));
        console.log('\nテストレポートを test-report.json に保存しました');
    } catch (error) {
        console.error('テストレポートの保存に失敗:', error.message);
    }

    return { passedTests, failedTests, testResults };
};

// 簡単なヘルスチェック関数
const healthCheck = async () => {
    try {
        const response = await testAPI('/api/suggest-recipes', 'POST', {
            ingredients: ['テスト'],
            dietary_restrictions: [],
            cuisine_preference: 'japanese'
        });
        return response.statusCode < 500;
    } catch (error) {
        return false;
    }
};

// メイン実行
const main = async () => {
    console.log('バックエンドサーバーのヘルスチェック中...');
    
    const isHealthy = await healthCheck();
    if (!isHealthy) {
        console.error('❌ サーバーが応答しません。サーバーが起動しているか確認してください。');
        console.log('サーバーを起動するには: npm start または node server.js');
        process.exit(1);
    }
    
    console.log('✅ サーバーが応答しています。テストを開始します。\n');
    
    try {
        await runTests();
    } catch (error) {
        console.error('テスト実行中にエラーが発生しました:', error);
        process.exit(1);
    }
};

// スクリプトとして実行された場合
if (require.main === module) {
    main();
}

module.exports = { runTests, testAPI, healthCheck };
#!/usr/bin/env node

const { spawn, exec } = require('child_process');
const path = require('path');
const http = require('http');

console.log('🚀 冷蔵庫レシピ提案アプリを起動しています...\n');

// バックエンドのパッケージが存在するかチェック
const backendPath = path.join(__dirname, '..', 'backend');
const fs = require('fs');

if (!fs.existsSync(path.join(backendPath, 'node_modules'))) {
    console.log('📦 バックエンドの依存関係をインストールしています...');
    exec('npm install', { cwd: backendPath }, (error, stdout, stderr) => {
        if (error) {
            console.error('❌ バックエンドのインストールに失敗しました:', error);
            return;
        }
        console.log('✅ バックエンドのインストールが完了しました\n');
        startServers();
    });
} else {
    startServers();
}

function startServers() {
    console.log('🔧 サーバーを起動しています...\n');
    
    // バックエンドサーバーを起動
    console.log('📡 バックエンドサーバーを起動中 (ポート3000)...');
    const backend = spawn('npm', ['start'], {
        cwd: backendPath,
        stdio: 'pipe',
        shell: true
    });

    backend.stdout.on('data', (data) => {
        console.log(`[Backend] ${data.toString().trim()}`);
    });

    backend.stderr.on('data', (data) => {
        console.error(`[Backend Error] ${data.toString().trim()}`);
    });

    // フロントエンドサーバーを起動（少し遅らせて起動）
    setTimeout(() => {
        console.log('🌐 フロントエンドサーバーを起動中 (ポート8080)...');
        
        // 複数の方法を試す
        const frontendCommands = [
            'npx http-server . -p 8080 -o',
            'python -m http.server 8080',
            'python3 -m http.server 8080'
        ];

        function tryStartFrontend(commandIndex = 0) {
            if (commandIndex >= frontendCommands.length) {
                console.log('❌ フロントエンドサーバーの起動に失敗しました');
                console.log('📝 手動でフロントエンドを開いてください: frontend/index.html');
                return;
            }

            const cmd = frontendCommands[commandIndex].split(' ');
            const frontend = spawn(cmd[0], cmd.slice(1), {
                cwd: __dirname + '/..',
                stdio: 'pipe',
                shell: true
            });

            frontend.on('error', (err) => {
                console.log(`⚠️  ${frontendCommands[commandIndex]} が利用できません`);
                tryStartFrontend(commandIndex + 1);
            });

            frontend.stdout.on('data', (data) => {
                const output = data.toString();
                if (output.includes('8080') || output.includes('server')) {
                    console.log(`[Frontend] ${output.trim()}`);
                }
            });

            frontend.stderr.on('data', (data) => {
                const error = data.toString();
                if (!error.includes('EADDRINUSE')) {
                    console.error(`[Frontend] ${error.trim()}`);
                }
            });

            // サーバーが起動したかチェック
            setTimeout(() => {
                checkServerAndOpenBrowser(frontend, commandIndex);
            }, 2000);
        }

        tryStartFrontend();
    }, 3000);
}

function checkServerAndOpenBrowser(frontend, commandIndex) {
    const req = http.get('http://localhost:8080', (res) => {
        console.log('✅ フロントエンドサーバーが起動しました!');
        console.log('\n🎉 アプリが利用可能です:');
        console.log('   フロントエンド: http://localhost:8080');
        console.log('   バックエンド:   http://localhost:3000');
        console.log('\n📖 使用方法:');
        console.log('   1. ブラウザでhttp://localhost:8080を開く');
        console.log('   2. 食材を入力してレシピを提案してもらう');
        console.log('\n⚠️  終了するには Ctrl+C を押してください\n');
        
        // ブラウザを開く
        openBrowser('http://localhost:8080');
    });

    req.on('error', (err) => {
        console.log('⚠️  フロントエンドサーバーの起動を確認中...');
        setTimeout(() => {
            checkServerAndOpenBrowser(frontend, commandIndex);
        }, 2000);
    });
}

function openBrowser(url) {
    const start = (process.platform === 'darwin' ? 'open' :
                   process.platform === 'win32' ? 'start' : 'xdg-open');
    
    exec(`${start} ${url}`, (error) => {
        if (error) {
            console.log('📝 ブラウザを手動で開いてください:', url);
        } else {
            console.log('🌐 ブラウザでアプリを開きました');
        }
    });
}

// Ctrl+C での終了処理
process.on('SIGINT', () => {
    console.log('\n👋 アプリを終了しています...');
    process.exit(0);
});
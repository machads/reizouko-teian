class RecipeApp {
    constructor() {
        this.apiBaseUrl = window.location.hostname === 'localhost' 
            ? 'http://localhost:3000/api' 
            : `${window.location.origin}/api`;
        this.currentInputMethod = 'text';
        this.uploadedPhoto = null;
        this.extractedIngredients = [];
        this.selectedGenre = 'japanese'; // デフォルトは和風
        this.init();
    }

    async init() {
        // 認証チェック
        const isAuthenticated = await this.checkAuthStatus();
        if (!isAuthenticated) {
            window.location.href = '/login.html';
            return;
        }

        this.bindEvents();
        this.initInputMethods();
        this.initPhotoUpload();
        this.initGenreSelection();
    }

    async checkAuthStatus() {
        try {
            const response = await fetch(`${this.apiBaseUrl}/auth-status`, {
                credentials: 'include'
            });
            const result = await response.json();
            return result.authenticated;
        } catch (error) {
            console.error('認証状態確認エラー:', error);
            return false;
        }
    }

    initGenreSelection() {
        const genreButtons = document.querySelectorAll('.genre-btn');
        
        genreButtons.forEach(button => {
            button.addEventListener('click', () => {
                // 全てのボタンからactiveクラスを削除
                genreButtons.forEach(btn => btn.classList.remove('active'));
                // クリックされたボタンにactiveクラスを追加
                button.classList.add('active');
                // 選択されたジャンルを保存
                this.selectedGenre = button.dataset.genre;
            });
        });
    }

    bindEvents() {
        const suggestBtn = document.getElementById('suggest-btn');
        const retryBtn = document.getElementById('retry-btn');
        const ingredientsTextarea = document.getElementById('ingredients');

        suggestBtn.addEventListener('click', () => this.handleSuggestRecipes());
        retryBtn.addEventListener('click', () => this.handleSuggestRecipes());
        
        ingredientsTextarea.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                this.handleSuggestRecipes();
            }
        });
    }

    initInputMethods() {
        const textMethodBtn = document.getElementById('text-method-btn');
        const photoMethodBtn = document.getElementById('photo-method-btn');
        const textInputArea = document.getElementById('text-input-area');
        const photoInputArea = document.getElementById('photo-input-area');

        textMethodBtn.addEventListener('click', () => {
            this.switchInputMethod('text');
        });

        photoMethodBtn.addEventListener('click', () => {
            this.switchInputMethod('photo');
        });
    }

    switchInputMethod(method) {
        const textMethodBtn = document.getElementById('text-method-btn');
        const photoMethodBtn = document.getElementById('photo-method-btn');
        const textInputArea = document.getElementById('text-input-area');
        const photoInputArea = document.getElementById('photo-input-area');

        this.currentInputMethod = method;

        if (method === 'text') {
            textMethodBtn.classList.add('active');
            photoMethodBtn.classList.remove('active');
            textInputArea.style.display = 'block';
            photoInputArea.style.display = 'none';
        } else {
            photoMethodBtn.classList.add('active');
            textMethodBtn.classList.remove('active');
            textInputArea.style.display = 'none';
            photoInputArea.style.display = 'block';
        }
    }

    initPhotoUpload() {
        const photoUpload = document.getElementById('photo-upload');
        const photoUploadContainer = document.querySelector('.photo-upload-container');
        const photoPreview = document.getElementById('photo-preview');
        const previewImage = document.getElementById('preview-image');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const removePhotoBtn = document.getElementById('remove-photo');
        const editIngredientsBtn = document.getElementById('edit-ingredients-btn');

        // ファイル選択時の処理
        photoUpload.addEventListener('change', (e) => {
            if (e.target.files && e.target.files[0]) {
                this.handlePhotoUpload(e.target.files[0]);
            }
        });

        // ドラッグ&ドロップ
        photoUploadContainer.addEventListener('dragover', (e) => {
            e.preventDefault();
            photoUploadContainer.classList.add('dragover');
        });

        photoUploadContainer.addEventListener('dragleave', (e) => {
            e.preventDefault();
            photoUploadContainer.classList.remove('dragover');
        });

        photoUploadContainer.addEventListener('drop', (e) => {
            e.preventDefault();
            photoUploadContainer.classList.remove('dragover');
            
            if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                this.handlePhotoUpload(e.dataTransfer.files[0]);
            }
        });

        // 写真削除
        removePhotoBtn.addEventListener('click', () => {
            this.removePhoto();
        });

        // 食材編集
        editIngredientsBtn.addEventListener('click', () => {
            this.editExtractedIngredients();
        });
    }

    async handlePhotoUpload(file) {
        // ファイル形式チェック
        if (!file.type.startsWith('image/')) {
            this.showError('画像ファイルを選択してください');
            return;
        }

        try {
            // 圧縮中のローディング表示
            this.setLoadingState(true, '画像を圧縮中...');
            
            // 画像を圧縮
            const compressedFile = await this.compressImage(file);
            
            // 圧縮後のファイルサイズチェック（5MB以下）
            if (compressedFile.size > 5 * 1024 * 1024) {
                this.showError('圧縮後もファイルサイズが大きすぎます（5MB以下にしてください）');
                return;
            }

            this.uploadedPhoto = compressedFile;
            
            // プレビュー表示
            const reader = new FileReader();
            reader.onload = (e) => {
                const previewImage = document.getElementById('preview-image');
                const photoPreview = document.getElementById('photo-preview');
                const uploadPlaceholder = document.getElementById('upload-placeholder');
                
                previewImage.src = e.target.result;
                photoPreview.style.display = 'block';
                uploadPlaceholder.style.display = 'none';
            };
            reader.readAsDataURL(compressedFile);

            // 食材認識処理
            await this.extractIngredientsFromPhoto(compressedFile);
        } catch (error) {
            console.error('画像処理エラー:', error);
            this.showError('画像の処理中にエラーが発生しました');
        } finally {
            this.setLoadingState(false);
        }
    }

    async compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.8) {
        return new Promise((resolve, reject) => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const img = new Image();
            
            img.onload = () => {
                // 元の画像サイズを取得
                let { width, height } = img;
                
                // 最大サイズに合わせてリサイズ計算
                if (width > height) {
                    if (width > maxWidth) {
                        height = (height * maxWidth) / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = (width * maxHeight) / height;
                        height = maxHeight;
                    }
                }
                
                // キャンバスサイズを設定
                canvas.width = width;
                canvas.height = height;
                
                // 画像をキャンバスに描画
                ctx.drawImage(img, 0, 0, width, height);
                
                // JPEGとして圧縮
                canvas.toBlob((blob) => {
                    if (blob) {
                        // 元のファイル情報を保持した新しいFileオブジェクトを作成
                        const compressedFile = new File([blob], file.name, {
                            type: 'image/jpeg',
                            lastModified: Date.now()
                        });
                        
                        console.log(`画像圧縮完了: ${file.size} bytes → ${compressedFile.size} bytes`);
                        resolve(compressedFile);
                    } else {
                        reject(new Error('画像の圧縮に失敗しました'));
                    }
                }, 'image/jpeg', quality);
            };
            
            img.onerror = () => {
                reject(new Error('画像の読み込みに失敗しました'));
            };
            
            // FileをData URLとして読み込み
            const reader = new FileReader();
            reader.onload = (e) => {
                img.src = e.target.result;
            };
            reader.onerror = () => {
                reject(new Error('ファイルの読み込みに失敗しました'));
            };
            reader.readAsDataURL(file);
        });
    }

    async extractIngredientsFromPhoto(file) {
        try {
            // ローディング表示
            this.setLoadingState(true, '写真から食材を認識中...');
            
            // FormDataでファイルをアップロード
            const formData = new FormData();
            formData.append('photo', file);
            
            console.log('画像をアップロードしています...', file.name, file.size, 'bytes');
            
            const response = await fetch(`${this.apiBaseUrl}/upload-photo`, {
                method: 'POST',
                body: formData,
                credentials: 'include',
                headers: {
                    // Content-Typeは設定しない（ブラウザが自動でmultipart/form-dataに設定）
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const result = await response.json();
            console.log('画像認識結果:', result);
            
            if (result.success && result.ingredients) {
                this.extractedIngredients = result.ingredients;
                this.displayExtractedIngredients();
                
                // 成功メッセージを表示
                this.showMessage(result.message || `${result.ingredients.length}個の食材を認識しました`, 'success');
            } else {
                throw new Error(result.message || '画像の認識に失敗しました');
            }
            
        } catch (error) {
            console.error('画像認識エラー:', error);
            this.showMessage(`画像認識エラー: ${error.message}`, 'error');
            
            // エラー時はデフォルトの食材を表示
            this.extractedIngredients = ['認識に失敗しました'];
            this.displayExtractedIngredients();
        } finally {
            this.setLoadingState(false);
        }
    }

    displayExtractedIngredients() {
        const extractedIngredientsDiv = document.getElementById('extracted-ingredients');
        const ingredientsList = document.getElementById('ingredients-list');
        
        ingredientsList.innerHTML = '';
        this.extractedIngredients.forEach(ingredient => {
            const tag = document.createElement('span');
            tag.className = 'ingredient-tag';
            tag.textContent = ingredient;
            ingredientsList.appendChild(tag);
        });
        
        extractedIngredientsDiv.style.display = 'block';
    }

    editExtractedIngredients() {
        const newIngredients = prompt(
            '認識された食材を編集してください（カンマ区切り）:', 
            this.extractedIngredients.join(', ')
        );
        
        if (newIngredients !== null) {
            this.extractedIngredients = newIngredients
                .split(',')
                .map(item => item.trim())
                .filter(item => item);
            this.displayExtractedIngredients();
        }
    }

    removePhoto() {
        this.uploadedPhoto = null;
        this.extractedIngredients = [];
        
        const photoPreview = document.getElementById('photo-preview');
        const uploadPlaceholder = document.getElementById('upload-placeholder');
        const extractedIngredientsDiv = document.getElementById('extracted-ingredients');
        const photoUpload = document.getElementById('photo-upload');
        
        photoPreview.style.display = 'none';
        uploadPlaceholder.style.display = 'block';
        extractedIngredientsDiv.style.display = 'none';
        photoUpload.value = '';
    }

    initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const tabName = e.target.dataset.tab;
                this.switchTab(tabName);
            });
        });
    }

    switchTab(activeTab) {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.classList.remove('active');
            if (button.dataset.tab === activeTab) {
                button.classList.add('active');
            }
        });

        tabPanels.forEach(panel => {
            panel.classList.remove('active');
            if (panel.id === `${activeTab}-tab`) {
                panel.classList.add('active');
            }
        });
    }

    async handleSuggestRecipes() {
        let ingredientsList = [];
        
        // 入力方法に応じて食材を取得
        if (this.currentInputMethod === 'text') {
            const ingredients = document.getElementById('ingredients').value.trim();
            if (!ingredients) {
                this.showError('食材を入力してください。');
                return;
            }
            ingredientsList = ingredients.split(',').map(item => item.trim()).filter(item => item);
        } else {
            // 写真入力の場合
            if (this.extractedIngredients.length === 0) {
                this.showError('写真から食材を認識できませんでした。食材を手動で入力してください。');
                return;
            }
            ingredientsList = this.extractedIngredients;
        }

        if (ingredientsList.length === 0) {
            this.showError('有効な食材を入力してください。');
            return;
        }

        const seasoning = document.getElementById('seasoning').value.trim();
        const moodSelect = document.getElementById('mood-select').value;
        const moodText = document.getElementById('mood-text').value.trim();
        
        // 気分・雰囲気の要望をまとめる
        let moodRequests = [];
        if (moodSelect) moodRequests.push(moodSelect);
        if (moodText) moodRequests.push(moodText);
        const moodRequest = moodRequests.join('、');

        this.setLoadingState(true);
        this.hideError();
        this.hideResults();

        try {
            const requestData = {
                ingredients: ingredientsList,
                requiredSeasoning: seasoning || undefined,
                moodRequest: moodRequest || undefined,
                selectedGenre: this.selectedGenre
            };

            // 進捗表示の更新
            this.setLoadingState(true, 'レシピ考え中...');
            
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 45000); // 45秒でタイムアウト
            
            const response = await fetch(`${this.apiBaseUrl}/suggest-recipes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify(requestData),
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `サーバーエラー: ${response.status}`);
            }

            this.setLoadingState(true, 'レシピを解析中...');
            const recipes = await response.json();
            this.displayRecipes(recipes);
            this.showResults();

        } catch (error) {
            console.error('Recipe suggestion error:', error);
            this.showError(this.getErrorMessage(error));
        } finally {
            this.setLoadingState(false);
        }
    }

    getErrorMessage(error) {
        if (error.name === 'AbortError') {
            return '処理に時間がかかりすぎました。食材を減らすか、もう一度お試しください。';
        }
        if (error.message.includes('fetch')) {
            return 'サーバーに接続できませんでした。バックエンドが起動しているか確認してください。';
        }
        if (error.message.includes('JSON')) {
            return 'サーバーからの応答を解析できませんでした。';
        }
        if (error.message.includes('timeout') || error.message.includes('Request timed out')) {
            return '処理に時間がかかりすぎました。食材を減らすか、もう一度お試しください。';
        }
        return error.message || '予期しないエラーが発生しました。';
    }

    setLoadingState(isLoading, message = 'レシピを生成中...') {
        const suggestBtn = document.getElementById('suggest-btn');
        const buttonText = suggestBtn.querySelector('.button-text');
        const loading = suggestBtn.querySelector('.loading');

        if (isLoading) {
            buttonText.style.display = 'none';
            loading.style.display = 'flex';
            loading.querySelector('span').textContent = message;
            suggestBtn.disabled = true;
        } else {
            buttonText.style.display = 'block';
            loading.style.display = 'none';
            loading.querySelector('span').textContent = '提案中...';
            suggestBtn.disabled = false;
        }
    }

    displayRecipes(recipes) {
        const singleRecipeElement = document.getElementById('single-recipe');
        const recipeTitleElement = document.getElementById('recipe-title');
        
        // 選択されたジャンルのレシピを表示
        const selectedRecipe = recipes[this.selectedGenre];
        
        if (singleRecipeElement && selectedRecipe) {
            singleRecipeElement.innerHTML = this.formatRecipe(selectedRecipe);
            
            // タイトルを更新
            const genreNames = {
                'japanese': '和風レシピ',
                'western': '洋風レシピ',
                'chinese': '中華レシピ'
            };
            recipeTitleElement.textContent = genreNames[this.selectedGenre] || 'レシピ提案';
        }

        // 追加食材提案を表示
        this.displayAdditionalIngredients(recipes);
    }

    displayAdditionalIngredients(recipes) {
        const additionalSection = document.getElementById('additional-ingredients-section');
        const additionalContent = document.getElementById('additional-ingredients-content');
        
        // レシピから追加食材提案を抽出
        const additionalSuggestions = this.extractAdditionalIngredients(recipes);
        
        if (additionalSuggestions.length > 0) {
            additionalContent.innerHTML = this.formatAdditionalIngredients(additionalSuggestions);
            additionalSection.style.display = 'block';
        } else {
            additionalSection.style.display = 'none';
        }
    }

    extractAdditionalIngredients(recipes) {
        const suggestions = [];
        const recipeTypes = ['japanese', 'western', 'chinese'];
        
        recipeTypes.forEach(type => {
            if (recipes[type]) {
                // レシピがオブジェクトの場合はcontentプロパティを使用
                const recipeText = typeof recipes[type] === 'string' ? recipes[type] : recipes[type].content;
                
                if (recipeText) {
                    const match = recipeText.match(/【追加食材提案】([\s\S]*?)$/);
                    if (match) {
                        const additionalText = match[1].trim();
                        const lines = additionalText.split('\n');
                        
                        lines.forEach(line => {
                            const trimmedLine = line.trim();
                            if (trimmedLine.startsWith('・')) {
                                const suggestion = trimmedLine.substring(1).trim();
                                if (suggestion && !suggestions.includes(suggestion)) {
                                    suggestions.push(suggestion);
                                }
                            }
                        });
                    }
                }
            }
        });
        
        return suggestions;
    }

    formatAdditionalIngredients(suggestions) {
        if (suggestions.length === 0) return '';
        
        const listItems = suggestions.map(suggestion => {
            const parts = suggestion.split('：');
            if (parts.length >= 2) {
                const ingredient = parts[0].trim();
                const recipe = parts.slice(1).join('：').trim();
                return `<li>
                    <div class="ingredient-suggestion">
                        <span class="ingredient-name">${ingredient}</span>
                        <span class="recipe-suggestion">：${recipe}</span>
                    </div>
                </li>`;
            } else {
                return `<li>
                    <div class="ingredient-suggestion">
                        <span class="recipe-suggestion">${suggestion}</span>
                    </div>
                </li>`;
            }
        }).join('');
        
        return `<ul>${listItems}</ul>`;
    }

    formatRecipe(recipe) {
        if (typeof recipe === 'string') {
            // 従来の文字列形式
            return this.formatRecipeText(recipe);
        } else if (recipe && typeof recipe === 'object') {
            // 新しいオブジェクト形式（画像付き）
            let result = '';
            
            // 画像があれば表示
            if (recipe.image) {
                result += `<div class="recipe-image">
                    <img src="${recipe.image}" alt="${recipe.title || 'レシピ画像'}" loading="lazy">
                </div>`;
            }
            
            // レシピテキストをフォーマット
            result += this.formatRecipeText(recipe.content || recipe);
            
            return result;
        }
        
        return '<p>レシピが取得できませんでした。</p>';
    }

    formatRecipeText(recipeText) {
        if (!recipeText) return '<p>レシピが取得できませんでした。</p>';

        let formatted = recipeText.replace(/【([^】]+)】/g, '<h3>$1</h3>');
        
        formatted = formatted.replace(/\n\n/g, '\n');
        
        const lines = formatted.split('\n').map(line => line.trim()).filter(line => line);
        
        let result = '';
        let currentSection = '';
        let sectionClass = '';
        
        lines.forEach(line => {
            if (line.startsWith('<h3>')) {
                if (currentSection) {
                    result += '</div>';
                }
                
                // セクションのクラスを決定
                const sectionTitle = line.replace(/<\/?h3>/g, '');
                if (sectionTitle.includes('料理名')) {
                    sectionClass = 'recipe-title-section';
                } else if (sectionTitle.includes('調理時間')) {
                    sectionClass = 'recipe-time-section';
                } else if (sectionTitle.includes('材料')) {
                    sectionClass = 'recipe-ingredients-section';
                } else if (sectionTitle.includes('作り方') || sectionTitle.includes('詳細な作り方')) {
                    sectionClass = 'recipe-steps-section';
                } else if (sectionTitle.includes('ポイント')) {
                    sectionClass = 'recipe-tips-section';
                } else {
                    sectionClass = 'recipe-section';
                }
                
                result += `<div class="recipe-item-box ${sectionClass}">`;
                result += line;
                currentSection = 'section';
            } else if (line.includes('：') || line.includes(':')) {
                const parts = line.split(/：|:/);
                if (parts.length >= 2) {
                    result += `<h4>${parts[0].trim()}</h4>`;
                    result += `<p>${parts.slice(1).join(':').trim()}</p>`;
                } else {
                    result += `<p>${line}</p>`;
                }
            } else if (line.match(/^\d+\./)) {
                result += `<p class="step">${line}</p>`;
            } else {
                result += `<p>${line}</p>`;
            }
        });
        
        if (currentSection) {
            result += '</div>';
        }
        
        return result;
    }

    showResults() {
        const resultsSection = document.getElementById('results-section');
        resultsSection.style.display = 'block';
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    hideResults() {
        document.getElementById('results-section').style.display = 'none';
    }

    showError(message) {
        const errorSection = document.getElementById('error-section');
        const errorText = document.getElementById('error-text');
        
        errorText.textContent = message;
        errorSection.style.display = 'block';
        errorSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    hideError() {
        document.getElementById('error-section').style.display = 'none';
    }

    showMessage(message, type = 'info') {
        // メッセージ表示用の要素を作成または取得
        let messageContainer = document.getElementById('message-container');
        if (!messageContainer) {
            messageContainer = document.createElement('div');
            messageContainer.id = 'message-container';
            messageContainer.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 1000;
                max-width: 400px;
            `;
            document.body.appendChild(messageContainer);
        }

        // メッセージ要素を作成
        const messageElement = document.createElement('div');
        messageElement.style.cssText = `
            padding: 12px 16px;
            margin-bottom: 10px;
            border-radius: 4px;
            color: white;
            font-size: 14px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            animation: slideIn 0.3s ease-out;
            background-color: ${type === 'error' ? '#e74c3c' : type === 'success' ? '#27ae60' : '#3498db'};
        `;
        messageElement.textContent = message;

        // アニメーション用CSS（まだ追加されていない場合）
        if (!document.getElementById('message-animation-styles')) {
            const styleSheet = document.createElement('style');
            styleSheet.id = 'message-animation-styles';
            styleSheet.textContent = `
                @keyframes slideIn {
                    from { transform: translateX(100%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes slideOut {
                    from { transform: translateX(0); opacity: 1; }
                    to { transform: translateX(100%); opacity: 0; }
                }
            `;
            document.head.appendChild(styleSheet);
        }

        messageContainer.appendChild(messageElement);

        // 5秒後に自動で削除
        setTimeout(() => {
            messageElement.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => {
                if (messageElement.parentNode) {
                    messageElement.parentNode.removeChild(messageElement);
                }
            }, 300);
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new RecipeApp();
});
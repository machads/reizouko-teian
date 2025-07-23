class RecipeApp {
    constructor() {
        this.apiBaseUrl = 'http://localhost:3000/api';
        this.currentInputMethod = 'text';
        this.uploadedPhoto = null;
        this.extractedIngredients = [];
        this.init();
    }

    init() {
        this.bindEvents();
        this.initTabs();
        this.initInputMethods();
        this.initPhotoUpload();
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
        // ファイルサイズチェック（10MB以下）
        if (file.size > 10 * 1024 * 1024) {
            this.showError('ファイルサイズが大きすぎます（10MB以下にしてください）');
            return;
        }

        // ファイル形式チェック
        if (!file.type.startsWith('image/')) {
            this.showError('画像ファイルを選択してください');
            return;
        }

        this.uploadedPhoto = file;
        
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
        reader.readAsDataURL(file);

        // 食材認識処理（今は仮の実装）
        await this.extractIngredientsFromPhoto(file);
    }

    async extractIngredientsFromPhoto(file) {
        // 現在は仮の実装（デモ用）
        // 実際にはGoogle Cloud Vision APIやOpenAI Vision APIを使用
        const demoIngredients = ['鶏肉', 'キャベツ', '人参', '玉ねぎ', '卵', 'じゃがいも'];
        
        // ローディング表示
        this.setLoadingState(true, '写真から食材を認識中...');
        
        // 仮の遅延
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        this.extractedIngredients = demoIngredients;
        this.displayExtractedIngredients();
        this.setLoadingState(false);
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
                moodRequest: moodRequest || undefined
            };

            const response = await fetch(`${this.apiBaseUrl}/suggest-recipes`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `サーバーエラー: ${response.status}`);
            }

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
        if (error.message.includes('fetch')) {
            return 'サーバーに接続できませんでした。バックエンドが起動しているか確認してください。';
        }
        if (error.message.includes('JSON')) {
            return 'サーバーからの応答を解析できませんでした。';
        }
        return error.message || '予期しないエラーが発生しました。';
    }

    setLoadingState(isLoading, message = '提案中...') {
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
        const recipeTypes = ['japanese', 'western', 'chinese'];
        
        recipeTypes.forEach(type => {
            const element = document.getElementById(`${type}-recipe`);
            if (element && recipes[type]) {
                element.innerHTML = this.formatRecipe(recipes[type]);
            }
        });
    }

    formatRecipe(recipeText) {
        if (!recipeText) return '<p>レシピが取得できませんでした。</p>';

        let formatted = recipeText.replace(/【([^】]+)】/g, '<h3>$1</h3>');
        
        formatted = formatted.replace(/\n\n/g, '\n');
        
        const lines = formatted.split('\n').map(line => line.trim()).filter(line => line);
        
        let result = '';
        let currentSection = '';
        
        lines.forEach(line => {
            if (line.startsWith('<h3>')) {
                if (currentSection) {
                    result += '</div>';
                }
                result += line;
                currentSection = 'section';
                result += '<div class="recipe-section">';
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
}

document.addEventListener('DOMContentLoaded', () => {
    new RecipeApp();
});
const bcrypt = require('bcrypt');

async function generateHash() {
    const password = 'recipe123';
    const saltRounds = 12;
    
    try {
        const hash = await bcrypt.hash(password, saltRounds);
        console.log('Password:', password);
        console.log('Hash:', hash);
        
        // 検証
        const isValid = await bcrypt.compare(password, hash);
        console.log('Verification:', isValid);
        
    } catch (error) {
        console.error('Error:', error);
    }
}

generateHash();
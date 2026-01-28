const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log('🔧 Initializing Git Configuration...');

const projectRoot = path.join(__dirname);
const gitIgnorePath = path.join(projectRoot, '.gitignore');

// 1. 创建标准的 .gitignore 文件 (如果不存在)
const gitIgnoreContent = `
# Dependencies
node_modules
.pnpm-store

# Production
dist
build
out

# Misc
.DS_Store
.env
.vscode
.idea
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# OS
Thumbs.db
`;

if (!fs.existsSync(gitIgnorePath)) {
    fs.writeFileSync(gitIgnorePath, gitIgnoreContent.trim());
    console.log('✅ Created .gitignore file (Excluded node_modules/dist).');
} else {
    console.log('ℹ️ .gitignore already exists.');
}

// 2. 初始化 Git 仓库
try {
    if (!fs.existsSync(path.join(projectRoot, '.git'))) {
        execSync('git init', { stdio: 'inherit' });
        console.log('✅ Git repository initialized.');
    } else {
        console.log('ℹ️ Git repository already exists.');
    }
} catch (e) {
    console.error('❌ Failed to run git init. Please install Git first.');
}

console.log('\n👉 Next Step: Run the following commands in your terminal:');
console.log('   git add .');
console.log('   git commit -m "Initial backup"');
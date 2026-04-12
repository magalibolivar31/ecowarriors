import fs from 'fs';
import path from 'path';

function findNestedButtons(dir: string) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git' && file !== 'dist') {
        findNestedButtons(fullPath);
      }
    } else if (file.endsWith('.tsx') || file.endsWith('.jsx')) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const lines = content.split('\n');
      let inButton = false;
      let buttonDepth = 0;
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const openMatches = line.match(/<button/g);
        const closeMatches = line.match(/<\/button/g);
        
        if (openMatches) {
          for (const match of openMatches) {
            buttonDepth++;
            if (buttonDepth > 1) {
              console.log(`Nested button found in ${fullPath} at line ${i + 1}`);
            }
          }
        }
        if (closeMatches) {
          for (const match of closeMatches) {
            buttonDepth--;
          }
        }
      }
    }
  }
}

findNestedButtons('.');

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
      let buttonStack: number[] = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        
        // This is a very rough parser and won't handle all cases (like buttons in strings or comments)
        // but it should be better than the previous one.
        
        let pos = 0;
        while (pos < line.length) {
          const openMatch = line.indexOf('<button', pos);
          const closeMatch = line.indexOf('</button>', pos);
          const selfCloseMatch = line.indexOf('/>', pos);
          
          // If we find an open tag
          if (openMatch !== -1 && (closeMatch === -1 || openMatch < closeMatch)) {
            // Check if it's self-closing on the same line
            const nextClose = line.indexOf('>', openMatch);
            if (nextClose !== -1 && line[nextClose - 1] === '/') {
              // Self-closing on the same line, do nothing
              pos = nextClose + 1;
            } else {
              // Not self-closing on the same line, but might be on a later line
              // For now, assume it's opened
              buttonStack.push(i + 1);
              if (buttonStack.length > 1) {
                console.log(`Nested button found in ${fullPath} at line ${i + 1}. Parent at line ${buttonStack[buttonStack.length - 2]}`);
              }
              pos = openMatch + 7;
            }
          } else if (closeMatch !== -1) {
            buttonStack.pop();
            pos = closeMatch + 9;
          } else if (selfCloseMatch !== -1 && buttonStack.length > 0) {
            // This is tricky because /> can close any tag.
            // But if we are in a button, and we see />, it might be closing the button.
            // Let's check if there's a > before it that doesn't have a /
            buttonStack.pop();
            pos = selfCloseMatch + 2;
          } else {
            break;
          }
        }
      }
    }
  }
}

findNestedButtons('.');

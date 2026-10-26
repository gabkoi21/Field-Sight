import { defineConfig } from '../node_modules/vite/dist/node/index.js';
export default defineConfig({root:new URL('../',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'),server:{host:'localhost',port:5175,strictPort:true,proxy:{'/api':{target:'http://127.0.0.1:8015',changeOrigin:true,rewrite:p=>p.replace(/^\/api/,''),cookiePathRewrite:{'/auth':'/api/auth'}}}}});

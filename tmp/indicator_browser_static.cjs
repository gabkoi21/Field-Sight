const http=require('node:http'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../fieldsight-frontend/dist');
http.createServer((req,res)=>{
 if(req.url.startsWith('/api/')){
  const upstream=http.request({host:'127.0.0.1',port:8198,path:req.url.slice(4),method:req.method,headers:{...req.headers,host:'127.0.0.1:8198'}},r=>{
   const headers={...r.headers}; if(headers['set-cookie'])headers['set-cookie']=headers['set-cookie'].map(s=>s.replace('Path=/auth','Path=/api/auth'));
   res.writeHead(r.statusCode,headers);r.pipe(res);
  });upstream.on('error',()=>{res.writeHead(502);res.end('Isolated API unavailable');});req.pipe(upstream);return;
 }
 let file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
 if(!file.startsWith(root+path.sep))file=path.join(root,'index.html');
 if(!fs.existsSync(file)||fs.statSync(file).isDirectory())file=path.join(root,'index.html');
 const type={'.js':'text/javascript','.css':'text/css','.html':'text/html','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':type});fs.createReadStream(file).pipe(res);
}).listen(5198,'127.0.0.1',()=>console.log('Isolated static browser build on 5198'));

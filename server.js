/**
 * FrameWhisper - Dev Server
 * 静态文件服务 + WebSocket ASR 代理
 * 浏览器原生 WebSocket 无法设置自定义 Header，
 * 所以通过此代理转发到火山引擎 ASR 并附加鉴权 Header
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');

const PORT = 3000;
const ASR_URL = 'wss://openspeech.bytedance.com/api/v3/sauc/bigmodel';
const SEEDANCE_BASE = 'https://ark.cn-beijing.volces.com/api/v3/contents/generations/tasks';

// 从 config.js 中读取配置（简单解析）
function loadConfig() {
  try {
    const configContent = fs.readFileSync(path.join(__dirname, 'js/config.js'), 'utf-8');
    const appIdMatch = configContent.match(/APP_ID:\s*'([^']*)'/);
    const tokenMatch = configContent.match(/TOKEN:\s*'([^']*)'/);
    const resourceIdMatch = configContent.match(/RESOURCE_ID:\s*'([^']*)'/);
    return {
      appId: appIdMatch ? appIdMatch[1] : '',
      token: tokenMatch ? tokenMatch[1] : '',
      resourceId: resourceIdMatch ? resourceIdMatch[1] : 'volc.bigasr.sauc.duration',
    };
  } catch (e) {
    console.error('无法读取 config.js:', e.message);
    return { appId: '', token: '', resourceId: 'volc.bigasr.sauc.duration' };
  }
}

// MIME 类型
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
};

// ==================== Seedance API 代理 ====================

function loadSeedanceKey() {
  try {
    const content = fs.readFileSync(path.join(__dirname, 'js/config.js'), 'utf-8');
    const match = content.match(/API_KEY:\s*'([^']*)'/)
    return match ? match[1] : '';
  } catch (e) { return ''; }
}

/**
 * 代理转发 HTTPS 请求到火山引擎
 */
function proxyToVolcengine(method, urlPath, body, apiKey) {
  return new Promise((resolve, reject) => {
    const postData = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'ark.cn-beijing.volces.com',
      port: 443,
      path: urlPath,
      method: method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
    };
    if (postData) options.headers['Content-Length'] = Buffer.byteLength(postData);

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, data: { error: { message: data.substring(0, 500) } } });
        }
      });
    });
    req.on('error', (e) => reject(e));
    if (postData) req.write(postData);
    req.end();
  });
}

/** 读取请求体 */
function readBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => resolve(body));
  });
}

/** 发送 JSON 响应 */
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(JSON.stringify(data));
}

// ==================== HTTP 服务 ====================

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];

  // CORS 预检
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // ---- Seedance: 创建任务 ----
  if (urlPath === '/api/seedance/create' && req.method === 'POST') {
    const apiKey = loadSeedanceKey();
    if (!apiKey) return sendJSON(res, 400, { error: { message: '请在 config.js 中配置 Seedance API_KEY' } });

    try {
      const body = JSON.parse(await readBody(req));
      console.log(`[Seedance] 创建任务: model=${body.model}`);
      const result = await proxyToVolcengine('POST', '/api/v3/contents/generations/tasks', body, apiKey);
      console.log(`[Seedance] 返回: status=${result.status}, id=${result.data?.id || 'N/A'}`);
      sendJSON(res, result.status, result.data);
    } catch (e) {
      console.error('[Seedance] 创建任务失败:', e.message);
      sendJSON(res, 500, { error: { message: e.message } });
    }
    return;
  }

  // ---- Seedance: 查询任务状态 ----
  const statusMatch = urlPath.match(/^\/api\/seedance\/status\/(.+)$/);
  if (statusMatch && req.method === 'GET') {
    const taskId = statusMatch[1];
    const apiKey = loadSeedanceKey();
    if (!apiKey) return sendJSON(res, 400, { error: { message: '请在 config.js 中配置 Seedance API_KEY' } });

    try {
      const result = await proxyToVolcengine('GET', `/api/v3/contents/generations/tasks/${taskId}`, null, apiKey);
      sendJSON(res, result.status, result.data);
    } catch (e) {
      console.error('[Seedance] 查询任务失败:', e.message);
      sendJSON(res, 500, { error: { message: e.message } });
    }
    return;
  }

  // ---- 静态文件服务 ----
  let filePath = urlPath === '/' ? '/index.html' : urlPath;
  filePath = path.join(__dirname, filePath);

  const ext = path.extname(filePath);
  const contentType = MIME[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

// WebSocket 代理（路径: /asr-proxy）
const wss = new WebSocketServer({ server, path: '/asr-proxy' });

wss.on('connection', (clientWs) => {
  const config = loadConfig();
  if (!config.appId || !config.token) {
    clientWs.send(JSON.stringify({ type: 'error', message: '请先在 config.js 中配置 APP_ID 和 TOKEN' }));
    clientWs.close();
    return;
  }

  const requestId = generateUUID();
  console.log(`[ASR] 新连接 requestId=${requestId}`);

  // 连接火山引擎 ASR
  const volcWs = new WebSocket(ASR_URL, {
    headers: {
      'X-Api-App-Key': config.appId,
      'X-Api-Access-Key': config.token,
      'X-Api-Resource-Id': config.resourceId,
      'X-Api-Request-Id': requestId,
      'X-Api-Sequence': '-1',
    },
  });

  volcWs.on('open', () => {
    console.log(`[ASR] 已连接火山引擎 ASR`);
    // 通知客户端连接就绪
    clientWs.send(JSON.stringify({ type: 'connected', requestId }));
  });

  volcWs.on('message', (data) => {
    // 转发火山引擎的二进制响应给客户端
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(data);
    }
  });

  volcWs.on('error', (err) => {
    console.error(`[ASR] 火山引擎连接错误:`, err.message);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(JSON.stringify({ type: 'error', message: '火山引擎 ASR 连接失败: ' + err.message }));
    }
  });

  volcWs.on('close', (code, reason) => {
    console.log(`[ASR] 火山引擎连接关闭 code=${code}`);
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  // 转发客户端消息到火山引擎
  clientWs.on('message', (data) => {
    if (volcWs.readyState === WebSocket.OPEN) {
      volcWs.send(data);
    }
  });

  clientWs.on('close', () => {
    console.log(`[ASR] 客户端断开`);
    if (volcWs.readyState === WebSocket.OPEN) {
      volcWs.close();
    }
  });
});

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

server.listen(PORT, () => {
  console.log(`\n  ✨ FrameWhisper 启动成功\n`);
  console.log(`  📡 地址: http://localhost:${PORT}`);
  console.log(`  🎙️  ASR 代理: ws://localhost:${PORT}/asr-proxy`);
  console.log(`  🎬 Seedance 代理: http://localhost:${PORT}/api/seedance/*\n`);
});

(function (root) {
  'use strict';
  class MCPClient {
    constructor(url, token = '', fetcher = (...args) => globalThis.fetch(...args)) {
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) throw Error('请使用 HTTPS MCP 地址');
      if (parsed.username || parsed.password || parsed.hash) throw Error('地址不能包含用户名、密码或 # 片段');
      this.url = parsed.href; this.token = token; this.fetcher = fetcher; this.id = 0;
      this.version = '2025-06-18'; this.session = ''; this.ready = false;
    }
    async rpc(method, params, notify = false) {
      const id = ++this.id;
      const headers = {'Content-Type':'application/json', Accept:'application/json, text/event-stream'};
      if (this.token) headers.Authorization = 'Bearer ' + this.token;
      if (this.session) headers['Mcp-Session-Id'] = this.session;
      if (method !== 'initialize') headers['MCP-Protocol-Version'] = this.version;
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 60000);
      try {
        const response = await this.fetcher(this.url, {method:'POST', headers, body:JSON.stringify({jsonrpc:'2.0', ...(!notify && {id}), method, ...(params !== undefined && {params})}), signal:controller.signal, redirect:'error', credentials:'omit'});
        if (!response.ok) {
          if (response.status === 404 && this.session) {this.ready = false; this.session = ''; throw Error('会话已过期，请重新连接；工具没有自动重试');}
          throw Error(response.status === 401 ? '认证失败，请检查 Token；此版不支持 OAuth 登录' : response.status === 403 ? '服务拒绝访问，请检查权限和允许的 Origin' : 'MCP HTTP ' + response.status);
        }
        if (method === 'initialize') this.session = response.headers.get('Mcp-Session-Id') || '';
        if (notify) { await response.body?.cancel(); return; }
        let message;
        if ((response.headers.get('content-type') || '').includes('text/event-stream')) {
          const reader = response.body.getReader(), decoder = new TextDecoder(); let buffer = '', bytes = 0;
          try {
            while (!message) {
              const chunk = await reader.read();
              if (chunk.done) break;
              bytes += chunk.value.length; if (bytes > 2e6) throw Error('MCP 响应过大');
              buffer += decoder.decode(chunk.value, {stream:true});
              let match;
              while ((match = /\r?\n\r?\n/.exec(buffer))) {
                const frame = buffer.slice(0, match.index); buffer = buffer.slice(match.index + match[0].length);
                const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).replace(/^ /, '')).join('\n');
                if (!data) continue;
                const value = JSON.parse(data);
                if (value.id === id && !value.method) {message = value; break;}
                if (value.method && value.id !== undefined) throw Error('该服务要求额外客户端能力，此版仅支持工具调用');
              }
            }
          } finally {await reader.cancel().catch(() => {});}
        } else {
          const body = await response.text(); if (body.length > 2e6) throw Error('MCP 响应过大'); message = JSON.parse(body);
        }
        if (!message || message.jsonrpc !== '2.0' || message.id !== id) throw Error('没有收到匹配的 MCP 响应，请检查服务地址');
        if (message.error) throw Error(String(message.error.message || 'MCP 请求失败'));
        if (!Object.hasOwn(message, 'result')) throw Error('MCP 响应缺少 result');
        return message.result;
      } catch (e) {
        if (e.name === 'AbortError') throw Error('请求超过 60 秒，执行结果可能尚未返回，请勿直接重复操作');
        if (e instanceof TypeError) throw Error('网络或跨域连接失败。服务需允许此网页 Origin，并开放 MCP 请求头和会话响应头');
        throw e;
      } finally {clearTimeout(timer);}
    }
    async connect() {
      this.ready = false; this.session = '';
      const result = await this.rpc('initialize', {protocolVersion:'2025-06-18', capabilities:{}, clientInfo:{name:'kiss-mcp', version:'1.0.0'}});
      if (!['2025-06-18','2025-03-26','2025-11-25'].includes(result.protocolVersion)) throw Error('服务返回了暂不支持的协议版本');
      if (!result.capabilities?.tools) throw Error('这个 MCP 服务没有提供 tools 能力');
      this.version = result.protocolVersion; this.info = result.serverInfo;
      await this.rpc('notifications/initialized', undefined, true); this.ready = true;
      return this.listTools();
    }
    async listTools() {
      const tools = [], seen = new Set(); let cursor;
      for (let page = 0; page < 100; page++) {
        const result = await this.rpc('tools/list', cursor ? {cursor} : {});
        if (!Array.isArray(result.tools)) throw Error('服务返回的工具列表格式不正确');
        tools.push(...result.tools); if (!result.nextCursor) return tools;
        cursor = result.nextCursor; if (seen.has(cursor)) throw Error('工具列表分页游标重复'); seen.add(cursor);
      }
      throw Error('工具列表超过分页上限');
    }
    async callTool(name, args) {
      if (!this.ready) throw Error('请先连接 MCP 服务');
      if (!args || Array.isArray(args) || typeof args !== 'object') throw Error('参数必须是 JSON 对象');
      return this.rpc('tools/call', {name, arguments:args});
    }
    async close() {
      this.ready = false;
      if (this.session) {
        const headers = {'Mcp-Session-Id':this.session, 'MCP-Protocol-Version':this.version};
        if (this.token) headers.Authorization = 'Bearer ' + this.token;
        await this.fetcher(this.url, {method:'DELETE', headers, credentials:'omit', redirect:'error', signal:AbortSignal.timeout(5000)}).catch(() => {});
      }
      this.session = '';
    }
  }
  root.MCPClient = MCPClient;
})(globalThis);

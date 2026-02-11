// Cloudflare Pages Functions - API路由入口
// 这个文件确保所有/api/*请求都被正确路由到gemini.ts

export { onRequestPost, onRequestOptions } from './gemini';

import { handleApiRequest } from '../backend/tmdbProxy.js';

export default async function handler(req, res) {
  const parsedUrl = new URL(req.url || '/', `https://${req.headers.host || 'localhost'}`);
  await handleApiRequest(req, res, parsedUrl);
}

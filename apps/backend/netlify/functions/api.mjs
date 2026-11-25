// Netlify Function: serves https://<backend-site>/api/*
import { handle } from '../../api/core.mjs';

export default (req) => handle(req);

export const config = { path: ['/api', '/api/*'] };

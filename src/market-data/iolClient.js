import axios from 'axios';
import { getAuthHeaders } from '../auth/tokenManager.js';
import logger from '../shared/logger.js';

const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [1000, 2000, 4000];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function get(endpoint) {
  let lastError;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const headers = await getAuthHeaders();
      const url = `${process.env.IOL_BASE_URL}${endpoint}`;
      const response = await axios.get(url, { headers });
      return response.data;
    } catch (err) {
      lastError = err;
      logger.error('Error en request a IOL', {
        endpoint,
        attempt,
        maxAttempts: MAX_ATTEMPTS,
        status: err.response?.status ?? 'network_error',
        message: err.message,
      });

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAYS_MS[attempt - 1]);
      }
    }
  }

  throw lastError;
}

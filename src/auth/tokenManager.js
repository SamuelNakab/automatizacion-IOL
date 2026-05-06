import axios from 'axios';
import logger from '../shared/logger.js';

// Renovar a los 12 minutos, antes de que el token expire a los 15
const RENEWAL_THRESHOLD_MS = 12 * 60 * 1000;

const state = {
  accessToken: null,
  refreshToken: null,
  obtainedAt: null,
};

async function obtainToken() {
  const params = new URLSearchParams({
    username: process.env.IOL_USERNAME,
    password: process.env.IOL_PASSWORD,
    grant_type: 'password',
  });

  const response = await axios.post(
    `${process.env.IOL_BASE_URL}/token`,
    params.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );

  state.accessToken = response.data.access_token;
  state.refreshToken = response.data.refresh_token;
  state.obtainedAt = Date.now();

  logger.info('Token obtenido', { grantType: 'password' });
}

async function renewToken() {
  try {
    const params = new URLSearchParams({
      refresh_token: state.refreshToken,
      grant_type: 'refresh_token',
    });

    const response = await axios.post(
      `${process.env.IOL_BASE_URL}/token`,
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );

    state.accessToken = response.data.access_token;
    state.refreshToken = response.data.refresh_token;
    state.obtainedAt = Date.now();

    logger.info('Token renovado', { grantType: 'refresh_token' });
  } catch (err) {
    logger.warn('Renovación con refresh_token fallida, reintentando con credenciales originales', {
      error: err.message,
    });
    await obtainToken();
  }
}

function needsRenewal() {
  if (!state.obtainedAt) return true;
  return Date.now() - state.obtainedAt >= RENEWAL_THRESHOLD_MS;
}

export async function getAuthHeaders() {
  if (!state.accessToken || needsRenewal()) {
    if (state.refreshToken && state.obtainedAt !== null) {
      await renewToken();
    } else {
      await obtainToken();
    }
  }
  return { Authorization: `Bearer ${state.accessToken}` };
}

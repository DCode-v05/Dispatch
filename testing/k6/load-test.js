import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

const errorRate = new Rate('errors');
const messageLatency = new Trend('message_latency');

export const options = {
  stages: [
    { duration: '30s', target: 50 },
    { duration: '1m', target: 50 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    errors: ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export function setup() {
  const uniqueId = Date.now();
  const registerRes = http.post(
    `${BASE_URL}/api/auth/register`,
    JSON.stringify({
      username: `loadtest_${uniqueId}`,
      email: `loadtest_${uniqueId}@test.com`,
      password: 'LoadTest1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const loginRes = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({
      email: `loadtest_${uniqueId}@test.com`,
      password: 'LoadTest1234!',
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );

  const body = JSON.parse(loginRes.body);
  return { token: body.accessToken };
}

export default function (data) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${data.token}`,
  };

  // Test 1: GET rooms
  const roomsRes = http.get(`${BASE_URL}/api/rooms`, { headers });
  check(roomsRes, { 'get rooms 200': (r) => r.status === 200 });
  errorRate.add(roomsRes.status !== 200);

  // Test 2: GET health
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, { 'gateway healthy': (r) => r.status === 200 });

  // Test 3: GET user profile
  const profileRes = http.get(`${BASE_URL}/api/users/me`, { headers });
  check(profileRes, { 'get profile 200': (r) => r.status === 200 });
  errorRate.add(profileRes.status !== 200);

  sleep(1);
}

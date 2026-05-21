import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 200 },
    { duration: '5m', target: 200 },
    { duration: '2m', target: 500 },
    { duration: '1m', target: 500 },
    { duration: '2m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<2000'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:80';

export default function () {
  const res = http.get(`${BASE_URL}/health`);
  check(res, {
    'status is 200 or 429': (r) => r.status === 200 || r.status === 429,
  });
  sleep(0.5);
}

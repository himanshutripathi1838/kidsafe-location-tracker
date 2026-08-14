const axios = require('axios');

async function testReport() {
  try {
    const res = await axios.get('http://127.0.0.1:5000/api/reports/daily/c-uuid-1?date=2026-08-13');
    console.log('API Response status:', res.status);
    console.log('API Response body:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error fetching report:', err.response ? err.response.data : err.message);
  }
}

testReport();

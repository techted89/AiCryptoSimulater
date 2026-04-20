const http = require('http');

let fetchCount = 0;
const start = Date.now();

const doFetch = () => {
  const req = http.get('http://localhost:8000/api/stats', (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      fetchCount++;
      if (Date.now() - start < 10000) {
        setTimeout(doFetch, 2000);
      } else {
        console.log(`Made ${fetchCount} requests in 10 seconds.`);
      }
    });
  });
  req.on('error', (e) => {
    console.error(`Problem with request: ${e.message}`);
  });
};

// doFetch();

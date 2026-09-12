async function testServer() {
  const ports = [3000, 3001, 3002, 5173, 8080];
  for (const port of ports) {
    try {
      const res = await fetch(`http://localhost:${port}/`, { signal: AbortSignal.timeout(2000) });
      console.log(`Port ${port} is UP! Status: ${res.status}`);
    } catch (e) {
      console.log(`Port ${port}: ${e.message}`);
    }
  }
}

testServer();

const https = require('https');

const servers = [
  'meet.guifi.net',
  'jitsi.linux.it',
  'meet.systemli.org',
  'meet.greenhost.net',
  'jitsi.tchncs.de',
  'meet.artemis.eco',
  'vc.autistici.org'
];

async function checkServer(host) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: host,
      path: '/',
      method: 'HEAD',
      timeout: 3000
    }, (res) => {
      const csp = res.headers['content-security-policy'] || '';
      const xFrame = res.headers['x-frame-options'] || '';
      if (!csp.includes('frame-ancestors') && !xFrame) {
        resolve(`${host} ALLOWS iframes!`);
      } else {
        resolve(`${host} blocks iframes (CSP: ${csp}, X-Frame: ${xFrame})`);
      }
    });
    
    req.on('error', () => resolve(`${host} error/timeout`));
    req.on('timeout', () => { req.destroy(); resolve(`${host} timeout`); });
    req.end();
  });
}

async function main() {
  for (const s of servers) {
    console.log(await checkServer(s));
  }
}
main();

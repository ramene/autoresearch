#!/bin/bash
NODE="/Users/ramene/.nvm/versions/node/v23.11.1/bin/node"
$NODE -e "
const fs = require('fs');
const key = fs.readFileSync('/usr/local/etc/autoresearch-credentials/resend-api-key.txt', 'utf8').trim();
const d = new Date();
d.setMinutes(d.getMinutes() + 30);
const t = d.toLocaleTimeString('en-US', {hour:'2-digit',minute:'2-digit',timeZone:'America/Merida'});
fetch('https://api.resend.com/emails', {
  method: 'POST',
  headers: {'Authorization':'Bearer '+key, 'Content-Type':'application/json'},
  body: JSON.stringify({
    from: 'Autoresearch <alerts@micropaymnts.ai>',
    to: 'ramene.anthony@gmail.com',
    subject: '🔔 Cron fires in 30 min ('+t+')',
    text: 'Autoresearch cron fires in 30 minutes at '+t+'.\nYou will receive the report after completion.\n\nFleet: 52 skills | 35 perfect | 8-hour cycle'
  })
}).then(r=>r.json()).then(d=>console.log('Reminder: '+(d.id||JSON.stringify(d))));
"

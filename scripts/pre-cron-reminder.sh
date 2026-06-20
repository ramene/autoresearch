#!/bin/bash
NODE="/Users/ramene/.nvm/versions/node/v23.11.1/bin/node"
$NODE -e "
const fs = require('fs');
const key = fs.readFileSync('/usr/local/etc/autoresearch-credentials/resend-api-key.txt', 'utf8').trim();

// Live fleet stats from self-model.json (same source as the loop report)
let fleet = 'Fleet stats unavailable';
try {
  const sm = JSON.parse(fs.readFileSync('/Users/ramene/.remote/@autoresearch/self-model.json', 'utf8'));
  const s = sm.summary || {};
  const avg = s.avg_ratio ? (s.avg_ratio * 100).toFixed(1) + '%' : '?';
  fleet = 'Fleet: ' + (s.total_skills||'?') + ' skills | ' + (s.skills_at_target||'?') + ' perfect | ' + (s.skills_stuck||'?') + ' stuck | ' + (s.skills_untested||'?') + ' untested | \$' + (s.total_cost ? s.total_cost.toFixed(2) : '?') + ' spent | ' + (s.total_rounds||'?') + ' rounds | Avg: ' + avg + ' | 8-hour cycle';
} catch {}

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
    text: 'Autoresearch cron fires in 30 minutes at '+t+'.\nYou will receive the report after completion.\n\n' + fleet
  })
}).then(r=>r.json()).then(d=>console.log('Reminder: '+(d.id||JSON.stringify(d))));
"

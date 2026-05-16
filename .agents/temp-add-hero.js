const fs = require('fs');
const locales = JSON.parse(fs.readFileSync('C:/Users/osman/Documents/GitHub/NorthStar/.agents/temp-hero.json','utf8'));
for(const[l,t] of Object.entries(locales)){
  const p = 'C:/Users/osman/Documents/GitHub/NorthStar/apps/web/src/locales/'+l+'/translation.json';
  let j = JSON.parse(fs.readFileSync(p,'utf8'));
  j.home.hero = {badge:t.badge, heading:t.heading, headingHighlight:t.headingHighlight, subtitle:t.subtitle};
  fs.writeFileSync(p, JSON.stringify(j, null, 2)+'\n');
  console.log(l+': OK');
}

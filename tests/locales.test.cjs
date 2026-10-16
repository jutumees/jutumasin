const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');
const context = {window:{}};
vm.createContext(context);
for(const code of ['et','en']) vm.runInContext(fs.readFileSync(path.join(__dirname,`../locales/${code}.js`),'utf8'),context);
const {et,en} = context.window.JUTUMASIN_LOCALES;
test('language catalogs cover identical UI keys, placeholders and stable card IDs',()=>{
 assert.deepEqual(Object.keys(et.ui),Object.keys(en.ui));
 for(const key of Object.keys(et.ui)){
  assert(en.ui[key].trim(),key);
  assert.deepEqual(et.ui[key].match(/\{\w+\}/g),en.ui[key].match(/\{\w+\}/g),key);
 }
 assert.deepEqual(Object.keys(et.decks),Object.keys(en.decks));
 const seen=new Set();
 for(const deck of Object.keys(et.decks)){
  assert.equal(et.decks[deck].length,en.decks[deck].length);
  et.decks[deck].forEach((card,index)=>{
   const translated=en.decks[deck][index];
   assert.equal(card.id,translated.id);
   assert(!seen.has(card.id),`duplicate ID ${card.id}`);seen.add(card.id);
   assert.deepEqual(Object.keys(card),Object.keys(translated));
   for(const key of ['title','desc','foot']) assert(translated[key].trim(),`${card.id}.${key}`);
   assert.notEqual(card.desc,translated.desc,`untranslated card ${card.id}`);
  });
 }
 assert.equal(seen.size,170);
});

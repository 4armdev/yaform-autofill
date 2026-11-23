const $ = id => document.getElementById(id);
let table = null;

function parseCSV(text) {
  text = text.replace(/^\uFEFF/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  const commas = (first.match(/,/g)||[]).length;
  const semis = (first.match(/;/g)||[]).length;
  const delimiter = semis > commas ? ';' : ',';
  const rows=[]; let row=[], cell='', quoted=false;
  for(let i=0;i<text.length;i++){
    const c=text[i], n=text[i+1];
    if(c === '"' && quoted && n === '"'){cell+='"';i++;}
    else if(c === '"'){quoted=!quoted;}
    else if(c===delimiter && !quoted){row.push(cell);cell='';}
    else if((c==='\n'||c==='\r')&&!quoted){
      if(c==='\r'&&n==='\n')i++;
      row.push(cell); if(row.some(v=>v.trim()!=='')) rows.push(row);
      row=[];cell='';
    } else cell+=c;
  }
  row.push(cell); if(row.some(v=>v.trim()!=='')) rows.push(row);
  if(rows.length<2) throw new Error('В csv должны быть заголовки и хотя бы одна строка профиля.');
  const headers=rows[0].map(v=>v.trim());
  if(headers.some(v=>!v)) throw new Error('В первой строке есть пустой заголовок.');
  return {headers, profiles:rows.slice(1).map(r=>headers.map((_,i)=>(r[i]??'').trim()))};
}
async function save(data){await browserAPI.storage.set({csvData:data});}
const browserAPI = (() => {
  if (typeof browser !== 'undefined' && browser.runtime) return {
    storage:{set:v=>browser.storage.local.set(v),get:k=>browser.storage.local.get(k),remove:k=>browser.storage.local.remove(k)},
    activeTab:async()=>{const tabs=await browser.tabs.query({active:true,currentWindow:true});return tabs[0];},
    formTabs:async()=>browser.tabs.query({url:'https://forms.yandex.ru/*'}),
    send:(id,msg)=>browser.tabs.sendMessage(id,msg)
  };
  return {
    storage:{set:v=>chrome.storage.local.set(v),get:k=>chrome.storage.local.get(k),remove:k=>chrome.storage.local.remove(k)},
    activeTab:async()=>new Promise(resolve=>chrome.tabs.query({active:true,currentWindow:true},t=>resolve(t[0]))),
    formTabs:async()=>new Promise(resolve=>chrome.tabs.query({url:'https://forms.yandex.ru/*'},resolve)),
    send:(id,msg)=>new Promise((resolve,reject)=>chrome.tabs.sendMessage(id,msg,r=>{const e=chrome.runtime.lastError;if(e)reject(e);else resolve(r);}))
  };
})();
function showProfiles(){
  $('profile').innerHTML='';
  table.profiles.forEach((_,i)=>{const o=document.createElement('option');o.value=i;o.textContent=`${i+1} — строка CSV`; $('profile').append(o);});
  $('profile').disabled=false;$('fill').disabled=false;
}
$('csv').addEventListener('change', async e=>{
  try{
    const file=e.target.files[0]; if(!file)return;
    table=parseCSV(await file.text());
    await save(table);showProfiles();
    $('status').textContent=`загружено профилей: ${table.profiles.length}\nКолонок: ${table.headers.length}`;
  }catch(err){$('status').textContent='ошибка csv: '+err.message;}
});
$('fill').addEventListener('click',async()=>{
  try{
    if(!table){const v=await browserAPI.storage.get('csvData');table=v.csvData;}
    if(!table)throw new Error('сначала загрузите csv!');
    const tabs=await browserAPI.formTabs();
    if(!tabs?.length) throw new Error('Не найдена открытая вкладка forms.yandex.ru. Откройте и прогрузите страницу с формой');
    const tab=tabs.find(t=>t.active) || tabs[0];
    const result=await browserAPI.send(tab.id,{type:'FILL_PROFILE',headers:table.headers,row:table.profiles[Number($('profile').value)]});
    $('status').textContent=result?.message||'Команда выполнена. Проверьте форму.';
  }catch(err){$('status').textContent='не удалось заполнить: '+err.message;}
});
$('clear').addEventListener('click',async()=>{
  await browserAPI.storage.remove('csvData');table=null;$('csv').value='';$('profile').innerHTML='<option>Сначала загрузите csv</option>';$('profile').disabled=true;$('fill').disabled=true;$('status').textContent='Сохранённый CSV очищен.';
});
(async()=>{try{const v=await browserAPI.storage.get('csvData');if(v.csvData){table=v.csvData;showProfiles();$('status').textContent=`Восстановлен csv: ${table.profiles.length} профилей`;}}catch(e){}})();

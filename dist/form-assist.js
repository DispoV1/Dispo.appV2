// AddressComplete receives only address search text, never other contact fields.
const foldText=s=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function enhanceForms(){
 document.querySelectorAll('select[name="sector"],#filter-sector').forEach(select=>{
  const parent=select.closest('label');if(!parent)return;
  let box=parent.nextElementSibling;if(!box?.classList.contains('other-sector')){box=document.createElement('label');box.className='other-sector';parent.after(box)}
  const other=[...select.selectedOptions].some(o=>o.value==='Autre');
  if(other&&!box.querySelector('input')){box.innerHTML=tr('Précisez le secteur (obligatoire)','Specify the sector (required)')+'<input name="otherSector" maxlength="80" required placeholder="'+tr('Ex. Agriculture','E.g. Agriculture')+'">';const input=box.querySelector('input');input.value=select.id==='filter-sector'?(state.otherSector||''):(state.profile[state.role]?.otherSector||'');input.addEventListener('input',()=>{input.setCustomValidity(input.value.trim()?'':tr('Précisez le secteur.','Specify the sector.'));if(select.id==='filter-sector')state.otherSector=input.value.trim()});input.addEventListener('change',()=>{if(select.id==='filter-sector'){if(!input.value.trim()){input.reportValidity();return}render()}})}
  if(!other&&box.childNodes.length)box.replaceChildren();box.hidden=!other;
  if(!select.dataset.assist){select.dataset.assist='1';select.addEventListener('change',enhanceForms)}
 });
 document.querySelectorAll('input[name="street"]').forEach(attachAddress);
 document.querySelectorAll('input[name="city"]').forEach(attachProfileCity);
}
function attachAddress(input){
 if(input.dataset.assist)return;input.dataset.assist='1';const form=input.form;if(!form)return;
 const wrap=document.createElement('div');wrap.className='address-assist';input.closest('label').after(wrap);
 const note=document.createElement('small'),results=document.createElement('div'),status=document.createElement('small');
 results.className='address-results';results.setAttribute('role','group');results.setAttribute('aria-label',tr('Adresses proposées','Suggested addresses'));status.setAttribute('role','status');wrap.append(note,results,status);
 const key=window.DISPO_ADDRESSCOMPLETE?.key?.trim();
 if(!key){note.textContent=tr('Saisie manuelle pour le moment. Les suggestions Postes Canada sont en attente d’activation. Les villes du Québec sont proposées dans le champ Ville.','Manual entry for now. Canada Post suggestions are awaiting activation. Québec municipalities are suggested in the City field.');return}
 note.textContent=tr('Suggestions Postes Canada. Le texte saisi pour l’adresse et la ville est envoyé à AdresseComplète.','Canada Post suggestions. Address and city search text is sent to AddressComplete.');
 let timer,controller,sequence=0;
 const cancel=()=>{clearTimeout(timer);controller?.abort();sequence++;results.replaceChildren()};
 async function lookup(lastId='',retrieve=false){
  cancel();const ticket=sequence;controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),8000);status.textContent=tr('Recherche…','Searching…');
  try{
   const city=form.elements.namedItem('city')?.value.trim()||'';
   const params=retrieve?{Id:lastId}:{SearchTerm:lastId?'':input.value.trim()+', '+(city?city+', ':'')+'QC',LastId:lastId,Country:'CAN',LanguagePreference:state.lang,MaxSuggestions:'8'};
   const items=await canadaPostRequest(key,retrieve?'Retrieve':'Find',params,controller.signal);
   if(ticket!==sequence||!input.isConnected)return;
   if(retrieve){
    const address=items.find(isCanadaPostQuebec);
    if(!address){status.textContent=tr('Cette adresse n’est pas au Québec. Précisez la ville ou saisissez l’adresse manuellement.','This address is outside Québec. Specify the city or enter the address manually.');return}
    const values={street:[address.Line1,address.Line2].filter(Boolean).join(', '),city:address.City,province:address.ProvinceName||'Québec',postal:address.PostalCode,country:'Canada'};
    for(const [name,value] of Object.entries(values)){const el=form.elements.namedItem(name);if(el)el.value=value||''}
    status.textContent=tr('Adresse remplie. Vérifiez les renseignements.','Address filled. Check the details.');return;
   }
   status.textContent=items.length?tr('Choisissez une adresse ou précisez la suggestion.','Select an address or narrow a suggestion.'):tr('Aucun résultat. Précisez la ville ou saisissez l’adresse manuellement.','No results. Specify the city or enter the address manually.');
   for(const item of items){if(!item.Id||!['Find','Retrieve'].includes(item.Next))continue;const b=document.createElement('button');b.type='button';b.className='address-choice';b.textContent=[item.Text,item.Description].filter(Boolean).join(' — ');b.addEventListener('click',()=>lookup(item.Id,item.Next==='Retrieve'));results.append(b)}
  }catch(e){if(ticket===sequence&&input.isConnected)status.textContent=tr('Suggestions Postes Canada indisponibles. Vous pouvez saisir l’adresse manuellement.','Canada Post suggestions unavailable. You can enter the address manually.')}finally{clearTimeout(timeout)}
 }
 input.addEventListener('input',()=>{cancel();status.textContent='';if(input.value.trim().length>=3)timer=setTimeout(()=>lookup(),450)});
 form.elements.namedItem('city')?.addEventListener('change',()=>{if(input.value.trim().length>=3)input.dispatchEvent(new Event('input',{bubbles:true}))});
 input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&results.firstElementChild){e.preventDefault();results.firstElementChild.focus()}if(e.key==='Escape'){cancel();status.textContent=''}});
 results.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();(e.key==='ArrowDown'?e.target.nextElementSibling:e.target.previousElementSibling)?.focus()}if(e.key==='Escape'){cancel();input.focus()}});
}
async function canadaPostRequest(key,method,params,signal){
 const version=method==='Retrieve'?'2.11':'2.10';
 const url=new URL('https://ws1.postescanada-canadapost.ca/AddressComplete/Interactive/'+method+'/v'+version+'/json3.ws');
 url.search=new URLSearchParams({Key:key,...params});
 const response=await fetch(url,{signal,referrerPolicy:'strict-origin-when-cross-origin'});
 if(!response.ok)throw Error('AddressComplete unavailable');const data=await response.json();
 if(!Array.isArray(data.Items)||data.Items.some(item=>item.Error!==undefined))throw Error('AddressComplete unavailable');return data.Items;
}
function isCanadaPostQuebec(a){return (a.CountryIso2==='CA'||a.CountryIso3==='CAN')&&[a.ProvinceCode,a.Province,a.ProvinceName].some(v=>['qc','quebec'].includes(foldText(v||'').trim()))}
function profileCityMatches(value){const q=foldText(value.trim()).replace(/[-’']/g,' ');if(!q)return [];const words=q.split(/\s+/);return qcSorted.filter(m=>words.every(w=>foldText(m.name).replace(/[-’']/g,' ').includes(w))).sort((a,b)=>Number(!foldText(a.name).startsWith(q))-Number(!foldText(b.name).startsWith(q))).slice(0,10)}
let citySuggestionId=0;
function attachProfileCity(input){if(input.dataset.cityAssist)return;input.dataset.cityAssist='1';input.autocomplete='off';const wrap=document.createElement('div');wrap.className='profile-city-suggestions';wrap.id='profile-cities-'+(++citySuggestionId);wrap.setAttribute('role','group');wrap.setAttribute('aria-label',tr('Municipalités suggérées','Suggested municipalities'));input.closest('label').append(wrap);input.setAttribute('aria-controls',wrap.id);input.setAttribute('aria-expanded','false');const clear=()=>{wrap.replaceChildren();input.setAttribute('aria-expanded','false')};const show=()=>{clear();if(!input.value.trim())return;const matches=profileCityMatches(input.value);input.setAttribute('aria-expanded','true');if(!matches.length){const hint=document.createElement('small');hint.textContent=tr('Aucune municipalité trouvée. Vous pouvez conserver votre saisie.','No municipality found. You may keep your entry.');wrap.append(hint);return}matches.forEach(m=>{const b=document.createElement('button');b.type='button';b.className='address-choice';b.textContent=m.name+' — '+m.region+' · '+m.type;b.addEventListener('click',()=>{input.value=m.name;const form=input.form;for(const [key,value] of Object.entries({province:'Québec',country:'Canada'})){const el=form?.elements.namedItem(key);if(el)el.value=value}clear();input.focus();input.dispatchEvent(new Event('change',{bubbles:true}))});wrap.append(b)})};input.addEventListener('input',show);input.addEventListener('keydown',e=>{if(e.key==='ArrowDown'&&wrap.firstElementChild?.tagName==='BUTTON'){e.preventDefault();wrap.firstElementChild.focus()}if(e.key==='Escape'){e.stopPropagation();clear()}});wrap.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();const next=e.key==='ArrowDown'?e.target.nextElementSibling:e.target.previousElementSibling;(next||input).focus()}if(e.key==='Escape'){e.stopPropagation();clear();input.focus()}});input.closest('label').addEventListener('focusout',e=>{if(!input.closest('label').contains(e.relatedTarget))clear()});}

new MutationObserver(enhanceForms).observe(document.getElementById('app'),{childList:true,subtree:true});enhanceForms();
document.addEventListener('submit',e=>{const input=e.target.querySelector('input[name="otherSector"]');if(input&&!input.value.trim()){e.preventDefault();e.stopImmediatePropagation();input.setCustomValidity(tr('Précisez le secteur.','Specify the sector.'));input.reportValidity()}},true);
document.addEventListener('input',e=>{if(e.target.id==='filter-municipality')e.target.setCustomValidity('')});
